import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/executive_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// Executive metric tile: dark glass, gold icon medallion, tabular numeral.
///
/// Gestures: tap gives a light haptic tick and fires [onTap] (drill-down).
class ExecutiveMetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String delta;
  final bool deltaPositive;
  final IconData icon;
  final VoidCallback? onTap;

  const ExecutiveMetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.delta,
    this.deltaPositive = true,
    required this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap == null
          ? null
          : () async {
              await Haptics.tap();
              onTap!();
            },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: ExecutiveTheme.cardDecoration,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: ExecutiveTheme.goldFaint,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: ExecutiveTheme.gold.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Icon(icon, size: 15, color: ExecutiveTheme.gold),
                ),
                const Spacer(),
                if (onTap != null)
                  const Icon(
                    CupertinoIcons.chevron_right,
                    size: 13,
                    color: ExecutiveTheme.slateDim,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(label.toUpperCase(), style: ExecutiveTheme.metricLabel),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: ExecutiveTheme.metricValue, maxLines: 1),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(
                  deltaPositive
                      ? CupertinoIcons.arrow_up_right
                      : CupertinoIcons.arrow_down_right,
                  size: 11,
                  color: deltaPositive
                      ? ExecutiveTheme.successMint
                      : const Color(0xFFF87171),
                ),
                const SizedBox(width: 3),
                Flexible(
                  child: Text(
                    delta,
                    style: ExecutiveTheme.deltaUp.copyWith(
                      color: deltaPositive
                          ? ExecutiveTheme.successMint
                          : const Color(0xFFF87171),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
