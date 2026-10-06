import 'package:flutter/cupertino.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// Noir Graphite metric tile: dark glass, platinum icon medallion, bold
/// tabular numeral. Deltas are monochrome — white for up, dim gray for down.
///
/// Gestures: tap gives a light haptic tick and fires [onTap] (drill-down).
class GraphiteMetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String delta;
  final bool deltaPositive;
  final IconData icon;
  final VoidCallback? onTap;

  const GraphiteMetricCard({
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
        padding: const EdgeInsets.all(16),
        decoration: GraphiteTheme.cardDecoration,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: GraphiteTheme.platinumFaint,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color:
                          GraphiteTheme.platinum.withValues(alpha: 0.28),
                    ),
                  ),
                  child: Icon(
                    icon,
                    size: 15,
                    color: GraphiteTheme.platinumLight,
                  ),
                ),
                const Spacer(),
                if (onTap != null)
                  const Icon(
                    CupertinoIcons.chevron_right,
                    size: 13,
                    color: GraphiteTheme.slateDim,
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              label.toUpperCase(),
              style: GraphiteTheme.metricLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child:
                  Text(value, style: GraphiteTheme.metricValue, maxLines: 1),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  deltaPositive ? '▲' : '▼',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: deltaPositive
                        ? GraphiteTheme.platinum
                        : GraphiteTheme.slateDim,
                  ),
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    delta,
                    style: (deltaPositive
                            ? GraphiteTheme.deltaUp
                            : GraphiteTheme.deltaDown)
                        .copyWith(fontSize: 11),
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
