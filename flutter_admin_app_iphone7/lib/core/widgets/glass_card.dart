import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';

/// quickLiquid material density levels based on Apple Liquid Glass design specifications
enum LiquidMaterial {
  /// Low blur (8px), strong refraction, ideal for floating controls and chips
  clear,
  /// Light frost (12px), ideal for toolbars, filters, and small cards
  thin,
  /// Balanced frost (18px blur, 160% saturation boost), ideal for main cards & panels
  regular,
  /// Dense frost (28px blur), high contrast for modals, sheets, and overlays
  thick,
}

/// A high-performance Apple Liquid Glass container conforming to `quickLiquid` specifications:
/// - Directional specular edge highlight (-35° angle / top-left to bottom-right sheen)
/// - Inner bezel sheen and ambient refraction simulation
/// - Spring physics interactive feedback on tap (scale down to 0.96 with bounce)
/// - Multi-layer backdrop blur with configurable material presets
class GlassCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final double? blur;
  final Color? backgroundColor;
  final Color? borderColor;
  final double borderWidth;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final bool enableGlow;
  final Color? glowColor;
  final LiquidMaterial material;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius = AppTheme.radiusM,
    this.blur,
    this.backgroundColor,
    this.borderColor,
    this.borderWidth = 1.0,
    this.gradient,
    this.onTap,
    this.enableGlow = false,
    this.glowColor,
    this.material = LiquidMaterial.regular,
  });

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard> with SingleTickerProviderStateMixin {
  late AnimationController _pressController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
      reverseDuration: const Duration(milliseconds: 220),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.965).animate(
      CurvedAnimation(
        parent: _pressController,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.elasticOut,
      ),
    );
  }

  @override
  void dispose() {
    _pressController.dispose();
    super.dispose();
  }

  double _resolveBlur() {
    if (widget.blur != null) return widget.blur!;
    switch (widget.material) {
      case LiquidMaterial.clear:
        return 8.0;
      case LiquidMaterial.thin:
        return 12.0;
      case LiquidMaterial.regular:
        return 18.0;
      case LiquidMaterial.thick:
        return 28.0;
    }
  }

  Color _resolveSurfaceColor() {
    if (widget.backgroundColor != null) return widget.backgroundColor!;
    switch (widget.material) {
      case LiquidMaterial.clear:
        return const Color(0x0AFFFFFF); // 4% white
      case LiquidMaterial.thin:
        return const Color(0x14FFFFFF); // 8% white
      case LiquidMaterial.regular:
        return const Color(0x99121726); // 60% deep obsidian glass
      case LiquidMaterial.thick:
        return const Color(0xD90F1422); // 85% modal glass
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveBlur = _resolveBlur();
    final surfaceColor = _resolveSurfaceColor();
    final glow = widget.glowColor ?? AppTheme.primaryCyan;

    // quickLiquid directional specular gradient: -35 deg (top-left highlight to subtle bottom-right)
    final specularGradient = LinearGradient(
      begin: const Alignment(-0.8, -1.0),
      end: const Alignment(0.8, 1.0),
      colors: [
        Colors.white.withValues(alpha: widget.material == LiquidMaterial.thick ? 0.35 : 0.22),
        Colors.white.withValues(alpha: 0.08),
        Colors.white.withValues(alpha: 0.02),
        Colors.black.withValues(alpha: 0.3),
      ],
      stops: const [0.0, 0.35, 0.7, 1.0],
    );

    // Inner liquid glass content
    Widget content = Container(
      padding: widget.padding ?? const EdgeInsets.all(AppTheme.spacingM),
      decoration: BoxDecoration(
        color: widget.gradient == null ? surfaceColor : null,
        gradient: widget.gradient,
        borderRadius: BorderRadius.circular(widget.borderRadius),
        boxShadow: widget.enableGlow
            ? [
                BoxShadow(
                  color: glow.withValues(alpha: 0.25),
                  blurRadius: 20,
                  spreadRadius: 1,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: widget.child,
    );

    // Filter + Specular Bevel Border Frame
    Widget glassBezel = Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(widget.borderRadius),
        gradient: specularGradient,
      ),
      padding: EdgeInsets.all(widget.borderWidth),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(
          (widget.borderRadius - widget.borderWidth).clamp(0.0, double.infinity),
        ),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: effectiveBlur, sigmaY: effectiveBlur),
          child: content,
        ),
      ),
    );

    // If interactive, apply spring physics gesture detectors
    if (widget.onTap != null) {
      glassBezel = GestureDetector(
        onTapDown: (_) => _pressController.forward(),
        onTapUp: (_) {
          _pressController.reverse();
          widget.onTap!();
        },
        onTapCancel: () => _pressController.reverse(),
        behavior: HitTestBehavior.opaque,
        child: AnimatedBuilder(
          animation: _scaleAnimation,
          builder: (context, child) => Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          ),
          child: glassBezel,
        ),
      );
    }

    if (widget.margin != null) {
      return Padding(
        padding: widget.margin!,
        child: glassBezel,
      );
    }

    return glassBezel;
  }
}
