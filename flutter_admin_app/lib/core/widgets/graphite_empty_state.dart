import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';

/// Reusable, elevated empty state widget adhering to the Noir Graphite & Platinum design system.
/// Features a layered glowing orb icon container, refined typography, and optional glassmorphic action.
class GraphiteEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final IconData? actionIcon;
  final VoidCallback? onAction;
  final Color? iconColor;

  const GraphiteEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.actionIcon,
    this.onAction,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveIconColor = iconColor ?? GraphiteTheme.platinum;

    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Layered Ambient Orb
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    effectiveIconColor.withValues(alpha: 0.12),
                    Colors.black.withValues(alpha: 0.4),
                  ],
                ),
                border: Border.all(
                  color: effectiveIconColor.withValues(alpha: 0.22),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: effectiveIconColor.withValues(alpha: 0.08),
                    blurRadius: 28,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 42,
                  color: effectiveIconColor,
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Title
            Text(
              title,
              style: GraphiteTheme.screenTitle.copyWith(
                fontSize: 20,
                letterSpacing: -0.3,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),

            // Description / Guidance
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text(
                message,
                style: GraphiteTheme.body.copyWith(
                  color: GraphiteTheme.slate,
                  fontSize: 13,
                  height: 1.45,
                ),
                textAlign: TextAlign.center,
              ),
            ),

            // Optional Primary Action Button
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onAction,
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                    decoration: BoxDecoration(
                      color: GraphiteTheme.graphiteCard,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: GraphiteTheme.cardBorderHi,
                        width: 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.35),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (actionIcon != null) ...[
                          Icon(actionIcon, size: 16, color: GraphiteTheme.platinum),
                          const SizedBox(width: 8),
                        ],
                        Text(
                          actionLabel!,
                          style: GraphiteTheme.pillText(filled: false).copyWith(
                            color: GraphiteTheme.platinum,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
