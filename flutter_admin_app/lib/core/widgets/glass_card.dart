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
/// - Liquid Sheen flash & spring scale animation on tap
/// - Inner bezel sheen and ambient refraction simulation
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
  late Animation<double> _flashAnimation;
  late Animation<double> _borderGlowAnimation;

  @override
  void initState() {
    super.initState();
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
      reverseDuration: const Duration(milliseconds: 320),
    );

    // Spring scale down & rebound
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(
        parent: _pressController,
        curve: Curves.easeInOutCubic,
        reverseCurve: Curves.elasticOut,
      ),
    );

    // Liquid flash / shine ripple across surface
    _flashAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _pressController,
        curve: Curves.easeOutQuad,
      ),
    );

    // Dynamic border highlight glow flare on press
    _borderGlowAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _pressController,
        curve: Curves.easeOut,
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
        return const Color(0x0EFFFFFF); // 5% white
      case LiquidMaterial.thin:
        return const Color(0x1AFFFFFF); // 10% white
      case LiquidMaterial.regular:
        return const Color(0xB2121726); // 70% deep obsidian glass
      case LiquidMaterial.thick:
        return const Color(0xE60F1422); // 90% modal glass
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveBlur = _resolveBlur();
    final surfaceColor = _resolveSurfaceColor();
    final glow = widget.glowColor ?? AppTheme.primaryCyan;

    return AnimatedBuilder(
      animation: _pressController,
      builder: (context, child) {
        final flashOpacity = _flashAnimation.value;
        final borderGlow = _borderGlowAnimation.value;

        // Directional specular gradient with dynamic flare when pressed
        final specularGradient = LinearGradient(
          begin: Alignment(-0.8 - (0.3 * borderGlow), -1.0),
          end: const Alignment(0.8, 1.0),
          colors: [
            Colors.white.withValues(
              alpha: (widget.material == LiquidMaterial.thick ? 0.45 : 0.3) + (0.45 * borderGlow),
            ),
            Colors.white.withValues(alpha: 0.12 + (0.2 * borderGlow)),
            Colors.white.withValues(alpha: 0.03),
            Colors.black.withValues(alpha: 0.35),
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
                      color: glow.withValues(alpha: 0.25 + (0.3 * borderGlow)),
                      blurRadius: 20 + (10 * borderGlow),
                      spreadRadius: 1 + (2 * borderGlow),
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
                      color: Colors.white.withValues(alpha: 0.15 * borderGlow),
                      blurRadius: 16 * borderGlow,
                      spreadRadius: 1 * borderGlow,
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
          ),
          child: Stack(
            children: [
              widget.child,
              // Liquid glass click flash sheen wave
              if (widget.onTap != null && flashOpacity > 0.01)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(widget.borderRadius),
                        gradient: RadialGradient(
                          center: Alignment.center,
                          radius: 1.2,
                          colors: [
                            Colors.white.withValues(alpha: 0.25 * flashOpacity),
                            Colors.white.withValues(alpha: 0.08 * flashOpacity),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
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
            child: Transform.scale(
              scale: _scaleAnimation.value,
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
      },
    );
  }
}
