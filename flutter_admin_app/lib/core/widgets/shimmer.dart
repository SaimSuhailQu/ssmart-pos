import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';

/// Shimmering skeleton placeholder for loading states — lists, cards, heroes.
///
/// Lighter and calmer than a spinner for content-shaped loading.
///
/// Example:
/// ```dart
/// // While data loads:
/// const ShimmerList(itemCount: 6, itemHeight: 84)
///
/// // Single block:
/// const ShimmerPlaceholder(height: 120, borderRadius: 16)
/// ```
class ShimmerPlaceholder extends StatefulWidget {
  final double? width;
  final double height;
  final double borderRadius;

  const ShimmerPlaceholder({
    super.key,
    this.width,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  State<ShimmerPlaceholder> createState() => _ShimmerPlaceholderState();
}

class _ShimmerPlaceholderState extends State<ShimmerPlaceholder>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: const [
                Color(0xFF1A1A1E),
                Color(0xFF26262C),
                Color(0xFF1A1A1E),
              ],
              stops: const [0.0, 0.5, 1.0],
              transform: _SlidingGradientTransform(
                slidePercent: _controller.value,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A column of skeleton rows, matching the app's list card rhythm.
class ShimmerList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final double spacing;

  const ShimmerList({
    super.key,
    this.itemCount = 6,
    this.itemHeight = 84,
    this.spacing = AppTheme.spacingS,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingM),
      itemCount: itemCount,
      separatorBuilder: (_, __) => SizedBox(height: spacing),
      itemBuilder: (_, __) => ShimmerPlaceholder(height: itemHeight),
    );
  }
}

class _SlidingGradientTransform extends GradientTransform {
  final double slidePercent;

  const _SlidingGradientTransform({required this.slidePercent});

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    return Matrix4.translationValues(
      bounds.width * (slidePercent * 2 - 1),
      0.0,
      0.0,
    );
  }
}
