import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// The app-wide page transition: a quick fade with a subtle rise + settle,
/// plus an iOS-style edge swipe to go back.
///
/// Replaces the stock iOS slide so every push in the app feels like one
/// calm, premium motion system. 300ms, ease-out — fast enough to never
/// feel in the way. Dragging from the left edge pops the route, the same
/// gesture iPhone users expect.
class GraphitePageRoute<T> extends PageRouteBuilder<T> {
  GraphitePageRoute({required WidgetBuilder builder, RouteSettings? settings})
      : super(
          settings: settings,
          transitionDuration: const Duration(milliseconds: 300),
          reverseTransitionDuration: const Duration(milliseconds: 240),
          pageBuilder: (context, animation, secondaryAnimation) =>
              builder(context),
          transitionsBuilder:
              (context, animation, secondaryAnimation, child) {
            final fade = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            );
            final rise = Tween<Offset>(
              begin: const Offset(0, 0.04),
              end: Offset.zero,
            ).animate(fade);
            final settle = Tween<double>(begin: 0.985, end: 1.0).animate(fade);
            return _EdgeSwipeBack(
              child: FadeTransition(
                opacity: fade,
                child: SlideTransition(
                  position: rise,
                  child: ScaleTransition(scale: settle, child: child),
                ),
              ),
            );
          },
        );
}

/// Push a screen with the graphite transition.
Future<T?> graphitePush<T>(BuildContext context, Widget screen) {
  return Navigator.push<T>(
    context,
    GraphitePageRoute<T>(builder: (_) => screen),
  );
}

/// Recognizer for the edge-swipe-back gesture.
///
/// A plain [GestureDetector] drag recognizer loses the gesture arena to
/// inner horizontal scrollers (e.g. a [TabBarView], as on the Vendors
/// screen) because the inner recognizer joins the arena first. This
/// recognizer instead claims the gesture on the first clearly-horizontal
/// move that starts inside the edge zone — before any inner scroller's
/// touch slop is reached — so the back swipe always wins at the edge,
/// exactly like iOS.
///
/// Taps and vertical scrolls are never stolen: with no significant
/// movement the gesture stays undecided (taps complete normally), and
/// predominantly vertical movement rejects immediately, handing the
/// gesture to the underlying scrollable.
class _EdgeSwipeGestureRecognizer extends OneSequenceGestureRecognizer {
  _EdgeSwipeGestureRecognizer({required this.edgeWidth});

  final double edgeWidth;

  bool Function()? canStart;
  VoidCallback? onStart;
  GestureDragUpdateCallback? onUpdate;
  GestureDragEndCallback? onEnd;

  Offset? _downPosition;
  Offset? _lastPosition;
  bool _claimed = false;
  bool _resolved = false;
  final VelocityTracker _velocityTracker =
      VelocityTracker.withKind(PointerDeviceKind.touch);

  @override
  void addAllowedPointer(PointerDownEvent event) {
    _downPosition = event.position;
    _lastPosition = event.position;
    _claimed = false;
    _resolved = false;
    startTrackingPointer(event.pointer, event.transform);
    _velocityTracker.addPosition(event.timeStamp, event.position);
  }

  void _accept() {
    if (_resolved) return;
    _resolved = true;
    _claimed = true;
    resolve(GestureDisposition.accepted);
  }

  void _reject() {
    if (_resolved) return;
    _resolved = true;
    _claimed = false;
    resolve(GestureDisposition.rejected);
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event is PointerMoveEvent) {
      _velocityTracker.addPosition(event.timeStamp, event.position);
      final down = _downPosition;
      if (down != null && !_resolved) {
        final dx = event.position.dx - down.dx;
        final dy = (event.position.dy - down.dy).abs();
        final inEdge = down.dx < edgeWidth;
        if (inEdge && dx > 4 && dx > dy * 1.5 && (canStart?.call() ?? true)) {
          _accept();
        } else if (!inEdge || dy > 8 || dx < -12) {
          _reject();
        }
        // Otherwise: ambiguous micro-movement — stay undecided so taps
        // and tiny jitter are never stolen.
      } else if (_claimed) {
        final last = _lastPosition ?? event.position;
        onUpdate?.call(DragUpdateDetails(
          sourceTimeStamp: event.timeStamp,
          delta: event.position - last,
          primaryDelta: event.position.dx - last.dx,
          globalPosition: event.position,
        ));
      }
      _lastPosition = event.position;
    } else if (event is PointerUpEvent || event is PointerCancelEvent) {
      if (_claimed) {
        final velocity = _velocityTracker.getVelocity().pixelsPerSecond.dx;
        onEnd?.call(DragEndDetails(primaryVelocity: velocity));
      } else if (!_resolved) {
        _reject();
      }
      stopTrackingPointer(event.pointer);
    }
  }

  @override
  void acceptGesture(int pointer) {
    onStart?.call();
  }

  @override
  void rejectGesture(int pointer) {
    stopTrackingPointer(pointer);
  }

  @override
  void didStopTrackingLastPointer(int pointer) {
    // Final cleanup whenever the last tracked pointer goes away,
    // however it happened (up, cancel, arena reject, dispose).
    _downPosition = null;
    _lastPosition = null;
    _claimed = false;
    _resolved = false;
  }

  @override
  String get debugDescription => 'edge swipe back';
}

/// iOS-style "swipe from the left edge to go back".
///
/// Only drags that start within [_edgeWidth] of the left edge are tracked,
/// so inner scrollers and tab views keep working everywhere else. The page
/// follows the finger; releasing past 35% of the width (or with a fast
/// flick) pops the route, otherwise it springs back.
class _EdgeSwipeBack extends StatefulWidget {
  final Widget child;

  const _EdgeSwipeBack({required this.child});

  static const double _edgeWidth = 28;

  @override
  State<_EdgeSwipeBack> createState() => _EdgeSwipeBackState();
}

class _EdgeSwipeBackState extends State<_EdgeSwipeBack>
    with SingleTickerProviderStateMixin {
  double _dragOffset = 0;
  late final AnimationController _spring;
  late Animation<double> _springAnim;

  @override
  void initState() {
    super.initState();
    _spring = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _springAnim = Tween<double>(begin: 0, end: 0).animate(_spring);
    _spring.addListener(() {
      if (mounted) setState(() => _dragOffset = _springAnim.value);
    });
  }

  @override
  void dispose() {
    _spring.dispose();
    super.dispose();
  }

  bool get _canPop {
    final route = ModalRoute.of(context);
    return route != null &&
        !route.isFirst &&
        route.animation?.isCompleted == true;
  }

  void _onSwipeStart() {
    _spring.stop();
  }

  void _onSwipeUpdate(DragUpdateDetails details) {
    final width = MediaQuery.sizeOf(context).width;
    setState(() {
      _dragOffset = (_dragOffset + details.delta.dx).clamp(0.0, width);
    });
  }

  void _onSwipeEnd(DragEndDetails details) {
    final width = MediaQuery.sizeOf(context).width;
    final velocity = details.primaryVelocity ?? 0;
    if (_dragOffset > width * 0.35 || velocity > 700) {
      // Fling the page fully off-screen, then pop. The page stays
      // translated away while the reverse transition plays, so there is
      // no jump back to the resting position.
      _springAnim = Tween<double>(begin: _dragOffset, end: width).animate(
        CurvedAnimation(parent: _spring, curve: Curves.easeOutCubic),
      );
      _spring.forward(from: 0).whenComplete(() async {
        if (!mounted) return;
        final popped = await Navigator.of(context).maybePop();
        if (!popped && mounted) {
          // Couldn't pop (shouldn't happen) — spring back into place.
          _springAnim = Tween<double>(begin: width, end: 0).animate(
            CurvedAnimation(parent: _spring, curve: Curves.easeOutCubic),
          );
          _spring.forward(from: 0);
        }
      });
    } else {
      // Spring back into place.
      _springAnim = Tween<double>(begin: _dragOffset, end: 0).animate(
        CurvedAnimation(parent: _spring, curve: Curves.easeOutCubic),
      );
      _spring.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RawGestureDetector(
      behavior: HitTestBehavior.translucent,
      excludeFromSemantics: true,
      gestures: <Type, GestureRecognizerFactory>{
        _EdgeSwipeGestureRecognizer:
            GestureRecognizerFactoryWithHandlers<_EdgeSwipeGestureRecognizer>(
          () => _EdgeSwipeGestureRecognizer(
            edgeWidth: _EdgeSwipeBack._edgeWidth,
          ),
          (_EdgeSwipeGestureRecognizer instance) {
            instance.canStart = () => _canPop;
            instance.onStart = _onSwipeStart;
            instance.onUpdate = _onSwipeUpdate;
            instance.onEnd = _onSwipeEnd;
          },
        ),
      },
      child: Transform.translate(
        offset: Offset(_dragOffset, 0),
        child: widget.child,
      ),
    );
  }
}
