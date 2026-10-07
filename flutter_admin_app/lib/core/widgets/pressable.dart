import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// Press-down scale feedback for tappable surfaces.
///
/// Wraps any child and scales it to [pressedScale] while the pointer is
/// down, springing back on release — the tactile "alive" feel across the
/// app. Fires a light haptic tick on tap. Disabled state skips both.
class Pressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double pressedScale;
  final bool enabled;
  final bool haptic;

  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.pressedScale = 0.96,
    this.enabled = true,
    this.haptic = true,
  });

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
    );
    _scale = Tween<double>(begin: 1.0, end: widget.pressedScale).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _pressDown(TapDownDetails _) {
    if (widget.enabled) _controller.forward();
  }

  void _pressUp() {
    _controller.reverse();
  }

  Future<void> _handleTap() async {
    if (!widget.enabled || widget.onTap == null) return;
    if (widget.haptic) await Haptics.tap();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _pressDown,
      onTapUp: (_) => _pressUp(),
      onTapCancel: _pressUp,
      onTap: _handleTap,
      onLongPress: widget.onLongPress,
      child: ScaleTransition(scale: _scale, child: widget.child),
    );
  }
}
