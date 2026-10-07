import 'package:flutter/material.dart';

/// Controller that triggers a shake on a [Shakable] widget.
///
/// Example:
/// ```dart
/// final _shake = ShakeController();
///
/// Shakable(
///   controller: _shake,
///   child: TextField(...),
/// )
///
/// // On validation failure:
/// Haptics.error();
/// _shake.shake();
/// ```
class ShakeController extends ChangeNotifier {
  void shake() => notifyListeners();
}

/// Wraps [child] and plays a quick horizontal shake whenever
/// [controller].shake() is called — for invalid input, rejected actions.
///
/// Pair with [Haptics.error] for the full "nope" feedback.
class Shakable extends StatefulWidget {
  final Widget child;
  final ShakeController controller;

  const Shakable({
    super.key,
    required this.child,
    required this.controller,
  });

  @override
  State<Shakable> createState() => _ShakableState();
}

class _ShakableState extends State<Shakable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _offset;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _offset = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -10.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 9.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 9.0, end: -6.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -6.0, end: 4.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 4.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    widget.controller.addListener(_onShake);
  }

  @override
  void didUpdateWidget(Shakable oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onShake);
      widget.controller.addListener(_onShake);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onShake);
    _controller.dispose();
    super.dispose();
  }

  void _onShake() {
    if (mounted) _controller.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _offset,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(_offset.value, 0),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}
