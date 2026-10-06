import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';

/// A wrapper that applies Apple Liquid Glassmesh radial glow underlays behind screens,
/// giving BackdropFilter and GlassCard elements vivid refraction, specular rim sheen, and true glass depth.
///
/// Set [graphiteAmbience] for the Noir Graphite look: true-black base with
/// platinum auras instead of the default indigo/cyan/emerald mesh.
class LiquidScaffold extends StatelessWidget {
  final PreferredSizeWidget? appBar;
  final Widget body;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool extendBodyBehindAppBar;
  final bool graphiteAmbience;

  const LiquidScaffold({
    super.key,
    this.appBar,
    required this.body,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.extendBodyBehindAppBar = false,
    this.graphiteAmbience = true,
  });

  @override
  Widget build(BuildContext context) {
    final base = graphiteAmbience
        ? GraphiteTheme.screenBase
        : const Color(0xFF07090E);
    return Scaffold(
      backgroundColor: base,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
      extendBodyBehindAppBar: extendBodyBehindAppBar,
      body: Stack(
        children: [
          // Background ambient light mesh
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(color: base),
                child: graphiteAmbience
                    ? _graphiteMesh()
                    : _defaultMesh(),
              ),
            ),
          ),
          // Actual Screen Content with Glassmorphic refraction
          Positioned.fill(
            child: body,
          ),
        ],
      ),
    );
  }

  /// Platinum auras on true black — the Noir Graphite ambience.
  Widget _graphiteMesh() {
    return Stack(
      children: [
        // Top-center platinum aura
        Positioned(
          top: -120,
          left: -50,
          right: -50,
          height: 380,
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: GraphiteTheme.auraTop,
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
          ),
        ),
        // Mid-left deep platinum refraction orb
        Positioned(
          top: 260,
          left: -100,
          width: 280,
          height: 280,
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  GraphiteTheme.platinumDeep.withValues(alpha: 0.10),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        // Bottom-right soft platinum glow
        Positioned(
          bottom: -80,
          right: -80,
          width: 340,
          height: 340,
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: GraphiteTheme.auraBottom,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _defaultMesh() {
    return const _DefaultMesh();
  }
}

class _DefaultMesh extends StatelessWidget {
  const _DefaultMesh();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
                    // Top-center vibrant indigo / violet ambient aura
                    Positioned(
                      top: -120,
                      left: -50,
                      right: -50,
                      height: 380,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              const Color(0xFF6366F1).withValues(alpha: 0.22),
                              const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                              Colors.transparent,
                            ],
                            stops: const [0.0, 0.5, 1.0],
                          ),
                        ),
                      ),
                    ),
                    // Mid-left cyan refraction orb
                    Positioned(
                      top: 260,
                      left: -100,
                      width: 280,
                      height: 280,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              const Color(0xFF06B6D4).withValues(alpha: 0.16),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Bottom-right emerald liquid refraction glow
                    Positioned(
                      bottom: -80,
                      right: -80,
                      width: 340,
                      height: 340,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              const Color(0xFF10B981).withValues(alpha: 0.14),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
      ],
    );
  }
}
