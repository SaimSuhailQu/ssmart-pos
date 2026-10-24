import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/utils/incremental_collection.dart';

class _Item {
  _Item(this.key, this.value);
  final String key;
  final int value;
}

IncrementalState<_Item> _state({bool withDecorate = false}) {
  return IncrementalState<_Item>(
    parse: (key, value) => _Item(key, (value['v'] as num).toInt()),
    compare: (a, b) => a.value.compareTo(b.value),
    decorate: withDecorate
        ? (key, item) => _Item(item.key, item.value * 10)
        : null,
  );
}

void main() {
  group('IncrementalState', () {
    test('add then sorted snapshot', () {
      final s = _state();
      expect(s.applyAddedOrChanged('b', {'v': 2}), isTrue);
      expect(s.applyAddedOrChanged('a', {'v': 1}), isTrue);
      expect(s.snapshot().map((i) => i.key), ['a', 'b']);
    });

    test('change replaces, remove drops', () {
      final s = _state();
      s.applyAddedOrChanged('a', {'v': 1});
      s.applyAddedOrChanged('b', {'v': 2});
      s.applyAddedOrChanged('a', {'v': 5});
      expect(s.snapshot().map((i) => i.value), [2, 5]);
      expect(s.applyRemoved('b'), isTrue);
      expect(s.snapshot().map((i) => i.key), ['a']);
      expect(s.applyRemoved('missing'), isFalse);
    });

    test('null value removes, non-map value is ignored', () {
      final s = _state();
      s.applyAddedOrChanged('a', {'v': 1});
      expect(s.applyAddedOrChanged('a', null), isTrue);
      expect(s.isEmpty, isTrue);
      s.applyAddedOrChanged('a', {'v': 1});
      expect(s.applyAddedOrChanged('a', 'scalar'), isFalse);
      expect(s.length, 1);
    });

    test('unparseable child is skipped, rest survive', () {
      final s = _state();
      s.applyAddedOrChanged('good', {'v': 1});
      expect(s.applyAddedOrChanged('bad', {'no-v': true}), isFalse);
      expect(s.snapshot().map((i) => i.key), ['good']);
    });

    test('decorator applies at snapshot time', () {
      final s = _state(withDecorate: true);
      s.applyAddedOrChanged('a', {'v': 3});
      expect(s.snapshot().single.value, 30);
    });

    test('sameStateAs detects changes between snapshots', () {
      final s = _state();
      s.applyAddedOrChanged('a', {'v': 1});
      final before = s.copyItems();
      expect(s.sameStateAs(before), isTrue);
      s.applyAddedOrChanged('b', {'v': 2});
      expect(s.sameStateAs(before), isFalse);
      // Same keys, replaced instance -> also a change.
      final before2 = s.copyItems();
      s.applyAddedOrChanged('b', {'v': 9});
      expect(s.sameStateAs(before2), isFalse);
    });

    test('clear drops everything', () {
      final s = _state();
      s.applyAddedOrChanged('a', {'v': 1});
      s.clear();
      expect(s.isEmpty, isTrue);
      expect(s.snapshot(), isEmpty);
    });
  });
}
