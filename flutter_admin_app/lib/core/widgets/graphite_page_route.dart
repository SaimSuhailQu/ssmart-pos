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

/// iOS-style "swipe from the left edge to go back".
///
/// Only drags that start within [_edgeWidth] of the left edge are tracked,
/// so inner horizontal scrollers (chip rows, charts) keep working. The page
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
  bool _tracking = false;
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
    return route != null && !route.isFirst && route.animation?.isCompleted == true;
  }

  void _onDragStart(DragStartDetails details) {
    _tracking = details.globalPosition.dx < _EdgeSwipeBack._edgeWidth && _canPop;
    if (_tracking) _spring.stop();
  }

  void _onDragUpdate(DragUpdateDetails details) {
    if (!_tracking) return;
    final width = MediaQuery.sizeOf(context).width;
    setState(() {
      _dragOffset = (_dragOffset + details.delta.dx).clamp(0.0, width);
    });
  }

  void _onDragEnd(DragEndDetails details) {
    if (!_tracking) return;
    _tracking = false;
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
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onHorizontalDragStart: _onDragStart,
      onHorizontalDragUpdate: _onDragUpdate,
      onHorizontalDragEnd: _onDragEnd,
      child: Transform.translate(
        offset: Offset(_dragOffset, 0),
        child: widget.child,
      ),
    );
  }
}
