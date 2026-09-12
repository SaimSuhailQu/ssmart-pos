import 'package:flutter/cupertino.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/glass_card.dart';

/// A card widget displaying a single metric with icon, label, and value,
/// styled with frosted glassmorphic theme and defensive overflow protection.
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      borderColor: effectiveColor.withValues(alpha: 0.25),
      enableGlow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              // Icon Container
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: effectiveColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(AppTheme.radiusS),
                  border: Border.all(
                    color: effectiveColor.withValues(alpha: 0.2),
                    width: 0.8,
                  ),
                ),
                child: Icon(
                  icon,
                  color: effectiveColor,
                  size: 18,
                ),
              ),
              const Spacer(),

              // Optional tap indicator
              if (onTap != null)
                const Icon(
                  CupertinoIcons.chevron_right,
                  size: 14,
                  color: AppTheme.textTertiary,
                ),
            ],
          ),
          const SizedBox(height: 4),

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
          ),
          const SizedBox(height: 2),

          // Value with robust scaling
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: AppTheme.headlineMedium.copyWith(
                  color: effectiveColor,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.2,
                ),
                maxLines: 1,
              ),
            ),
          ),

          // Subtitle (optional)
          if (subtitle != null) ...[
            const SizedBox(height: 1),
            Text(
              subtitle!,
              style: AppTheme.labelSmall.copyWith(
                fontSize: 10,
                color: AppTheme.textTertiary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
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
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppTheme.borderColor,
                  borderRadius: BorderRadius.circular(AppTheme.radiusS),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTheme.spacingM),
          Container(
            width: 80,
            height: 12,
            decoration: BoxDecoration(
              color: AppTheme.borderColor,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: AppTheme.spacingXS),
          Container(
            width: 120,
            height: 24,
            decoration: BoxDecoration(
              color: AppTheme.borderColor,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }
}
