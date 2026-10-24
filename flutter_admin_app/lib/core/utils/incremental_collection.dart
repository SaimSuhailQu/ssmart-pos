import 'dart:async';

import 'package:firebase_database/firebase_database.dart';

/// Why this file exists (Oct 2026, downloads blew past the 10 GB free tier):
///
/// An `onValue` listener re-downloads the ENTIRE node on EVERY change, to
/// EVERY subscriber. One khata entry changed meant the whole customers node
/// re-downloaded to every customers StreamBuilder on every device. With
/// several builders per screen and several devices, a 33 MB database turned
/// into 10.47 GB of downloads in one month.
///
/// Child events (`onChildAdded/Changed/Removed`) download only the child
/// that changed. This file converts a whole-collection `onValue` stream into
/// a shared, incremental one:
///
/// - ONE Firebase subscription per collection, shared by all UI listeners
///   (the vendors screen alone had four simultaneous purchase-order
///   subscriptions; now it has one).
/// - After a change, only the changed child crosses the wire; the emitted
///   list is rebuilt from local state.
/// - New listeners replay the current list immediately instead of
///   re-downloading it.
/// - When the last listener leaves, the subscription detaches after a
///   short grace period (so flipping between two screens that share a
///   collection does not thrash attach/detach and re-download).
///
/// What this does NOT do: the first sight of a collection still downloads
/// it in full — that is unavoidable, the data has to arrive once. The
/// saving is everything after that: changes cost one child, not the node.
///
/// `IncrementalState` is pure and unit-tested; `IncrementalCollection` is
/// the thin Firebase glue around it.

typedef CollectionParser<T> = T Function(
    String key, Map<dynamic, dynamic> value);
typedef CollectionDecorator<T> = T Function(String key, T item);

/// Pure per-collection state: keyed items, upsert/remove, sorted snapshot.
/// No Firebase types here, so tests drive it directly.
class IncrementalState<T> {
  IncrementalState({
    required this.parse,
    required this.compare,
    this.decorate,
  });

  final CollectionParser<T> parse;
  final int Function(T a, T b) compare;
  final CollectionDecorator<T>? decorate;

  final Map<String, T> _items = {};

  int get length => _items.length;
  bool get isEmpty => _items.isEmpty;

  /// Insert or replace one child. Returns true when the state changed.
  /// Unparseable children are skipped (and logged), like the old streams
  /// skipped unparseable rows instead of failing the whole list.
  bool applyAddedOrChanged(String key, dynamic value) {
    if (value is! Map) {
      if (value == null) return applyRemoved(key);
      return false;
    }
    try {
      final parsed = parse(key, Map<dynamic, dynamic>.from(value));
      final old = _items[key];
      _items[key] = parsed;
      return !identical(old, parsed);
    } catch (e) {
      print('IncrementalState: skipping unparseable child $key: $e');
      return false;
    }
  }

  /// Remove one child. Returns true when something was actually removed.
  bool applyRemoved(String key) => _items.remove(key) != null;

  /// Snapshot of the current state: decorated (if a decorator is set),
  /// then sorted. A fresh list every time, like the old streams built.
  List<T> snapshot() {
    final items = decorate == null
        ? _items.values.toList()
        : _items.entries.map((e) => decorate!(e.key, e.value)).toList();
    items.sort(compare);
    return items;
  }

  /// True when [other] holds exactly the same keys bound to the same
  /// (identical) item instances. Used to detect a state change that landed
  /// between a replay and a live subscription.
  bool sameStateAs(Map<String, T> other) {
    if (_items.length != other.length) return false;
    for (final key in _items.keys) {
      if (!other.containsKey(key)) return false;
      if (!identical(_items[key], other[key])) return false;
    }
    return true;
  }

  /// A shallow copy of the keyed items, for same-state comparisons.
  Map<String, T> copyItems() => Map<String, T>.of(_items);

  /// Drop all state. Required on detach: children deleted while detached
  /// produce no event on re-attach, so kept state would show ghosts.
  void clear() => _items.clear();
}

/// Firebase glue: child-event subscriptions + shared broadcast + replay.
///
/// One instance per collection, owned by FirebaseService. Callers use
/// [stream]; every caller shares the same underlying subscription.
class IncrementalCollection<T> {
  IncrementalCollection({
    required DatabaseReference ref,
    required CollectionParser<T> parse,
    required int Function(T a, T b) compare,
    CollectionDecorator<T>? decorate,
    this.quietTimeout = const Duration(milliseconds: 1500),
    this.emitDebounce = const Duration(milliseconds: 100),
    this.detachGrace = const Duration(seconds: 5),
  })  : _ref = ref,
        _state = IncrementalState<T>(
          parse: parse,
          compare: compare,
          decorate: decorate,
        );

  final DatabaseReference _ref;
  final IncrementalState<T> _state;

  /// How long to wait for a first child event before treating the node as
  /// empty. Child listeners have no "initial load complete" signal, so an
  /// empty node would otherwise never emit. Slow networks can beat this
  /// timer; the stream self-corrects on the next event, but a `.first`
  /// caller may see an empty list in that edge case.
  final Duration quietTimeout;

  /// Coalesces bursts (initial load, bulk writes) into few emissions.
  /// Live single changes surface at most this late — imperceptible here.
  final Duration emitDebounce;

  /// Grace period after the last listener leaves before detaching, so
  /// quick screen flips do not re-download the collection.
  final Duration detachGrace;

  final StreamController<List<T>> _updates =
      StreamController<List<T>>.broadcast();

  StreamSubscription<DatabaseEvent>? _subAdded;
  StreamSubscription<DatabaseEvent>? _subChanged;
  StreamSubscription<DatabaseEvent>? _subRemoved;
  Timer? _quietTimer;
  Timer? _emitTimer;
  Timer? _detachTimer;

  bool _attached = false;
  bool _ready = false;
  bool _emitPending = false;
  int _listeners = 0;

  /// Current snapshot (sorted, decorated). Cheap to call; used for replay.
  List<T> get current => _state.snapshot();

  void _ensureAttached() {
    if (_attached) {
      _detachTimer?.cancel();
      _detachTimer = null;
      return;
    }
    _attached = true;
    _ready = false;
    _subAdded = _ref.onChildAdded.listen(_onAdded, onError: _onError);
    _subChanged = _ref.onChildChanged.listen(_onChanged, onError: _onError);
    _subRemoved = _ref.onChildRemoved.listen(_onRemoved, onError: _onError);
    _quietTimer = Timer(quietTimeout, () {
      if (!_ready) {
        _ready = true;
        _scheduleEmit();
      }
    });
  }

  void _onAdded(DatabaseEvent event) => _applyEvent(event);
  void _onChanged(DatabaseEvent event) => _applyEvent(event);

  void _onRemoved(DatabaseEvent event) {
    final key = event.snapshot.key;
    if (key == null) return;
    if (_state.applyRemoved(key)) _markChanged();
  }

  void _applyEvent(DatabaseEvent event) {
    final key = event.snapshot.key;
    if (key == null) return;
    if (_state.applyAddedOrChanged(key, event.snapshot.value)) {
      _markChanged();
    }
  }

  void _onError(Object error) {
    print('IncrementalCollection error on ${_ref.path}: $error');
    // Keep serving the last-known state; do not close the stream.
    if (_ready) _scheduleEmit();
  }

  void _markChanged() {
    if (!_ready) {
      _ready = true;
      _quietTimer?.cancel();
      _quietTimer = null;
    }
    _scheduleEmit();
  }

  void _scheduleEmit() {
    if (_emitPending || !_ready) return;
    _emitPending = true;
    _emitTimer = Timer(emitDebounce, () {
      _emitPending = false;
      if (!_updates.isClosed) _updates.add(_state.snapshot());
    });
  }

  void _detach() {
    _subAdded?.cancel();
    _subChanged?.cancel();
    _subRemoved?.cancel();
    _subAdded = null;
    _subChanged = null;
    _subRemoved = null;
    _quietTimer?.cancel();
    _emitTimer?.cancel();
    _quietTimer = null;
    _emitTimer = null;
    _attached = false;
    _ready = false;
    _emitPending = false;
    // State MUST be cleared: children deleted while detached produce no
    // event on re-attach, so kept state would show ghosts.
    _state.clear();
  }

  /// Shared stream for this collection. Every caller gets the same
  /// underlying Firebase subscription; new callers replay the current
  /// list immediately, then follow live updates.
  Stream<List<T>> get stream {
    _ensureAttached();
    final controller = StreamController<List<T>>();
    late StreamSubscription<List<T>> sub;
    controller.onListen = () {
      _listeners++;
      final itemsBefore = _state.copyItems();
      controller.add(_state.snapshot());
      sub = _updates.stream.listen(
        controller.add,
        onError: controller.addError,
      );
      // Close the race: a change landing between the replay and the live
      // subscription is re-emitted from current state.
      if (!_state.sameStateAs(itemsBefore)) {
        controller.add(_state.snapshot());
      }
    };
    controller.onCancel = () async {
      await sub.cancel();
      _listeners--;
      if (_listeners <= 0) {
        _detachTimer?.cancel();
        _detachTimer = Timer(detachGrace, _detach);
      }
    };
    return controller.stream;
  }
}
