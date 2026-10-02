import 'package:flutter/cupertino.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/glass_card.dart';

/// A card widget displaying a single metric with icon, label, and value,
/// styled with frosted glassmorphic theme and defensive overflow protection.
/// All content is center-aligned for a balanced, professional dashboard look.
class MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final String? subtitle;
  final VoidCallback? onTap;

  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppTheme.primaryBlue;

    return GlassCard(
      onTap: onTap,
      borderRadius: AppTheme.radiusM,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      borderColor: effectiveColor.withValues(alpha: 0.25),
      enableGlow: false,
      child: Stack(
        children: [
          // Optional tap indicator, pinned to the top-right corner
          if (onTap != null)
            const Positioned(
              top: 0,
              right: 0,
              child: Icon(
                CupertinoIcons.chevron_right,
                size: 13,
                color: AppTheme.textTertiary,
              ),
            ),

          // Centered metric content
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Icon badge
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: effectiveColor.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: effectiveColor.withValues(alpha: 0.25),
                      width: 0.8,
                    ),
                  ),
                  child: Icon(
                    icon,
                    color: effectiveColor,
                    size: 18,
                  ),
                ),
                const SizedBox(height: 8),

                // Label
                Text(
                  label,
                  style: AppTheme.bodySmall.copyWith(
                    fontSize: 11,
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 3),

                // Value with robust scaling, centered
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.center,
                  child: Text(
                    value,
                    style: AppTheme.headlineMedium.copyWith(
                      color: effectiveColor,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                    maxLines: 1,
                    textAlign: TextAlign.center,
                  ),
                ),

                // Subtitle (optional)
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: AppTheme.labelSmall.copyWith(
                      fontSize: 10,
                      color: AppTheme.textTertiary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A shimmer loading placeholder for MetricCard
class MetricCardSkeleton extends StatelessWidget {
  const MetricCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(AppTheme.spacingM),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  color: AppTheme.borderColor,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: 80,
            height: 10,
            decoration: const BoxDecoration(
              color: AppTheme.borderColor,
              borderRadius: BorderRadius.all(Radius.circular(4)),
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: 110,
            height: 16,
            decoration: const BoxDecoration(
              color: AppTheme.borderColor,
              borderRadius: BorderRadius.all(Radius.circular(4)),
            ),
          ),
        ],
      ),
    );
  }
}
