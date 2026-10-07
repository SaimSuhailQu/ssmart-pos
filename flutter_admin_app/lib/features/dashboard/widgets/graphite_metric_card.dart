import 'package:flutter/cupertino.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// Noir Graphite metric tile: dark glass, platinum icon medallion, bold
/// tabular numeral. Deltas are semantic — green for up, red for down,
/// gray for flat, no arrow for plain captions.
///
/// Gestures: tap gives a light haptic tick and fires [onTap] (drill-down);
/// long-press fires [onLongPress] (secondary/hidden destinations).
class GraphiteMetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String delta;
  final DeltaDirection deltaDirection;
  final IconData icon;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  const GraphiteMetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.delta,
    this.deltaDirection = DeltaDirection.none,
    required this.icon,
    this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onLongPress == null
          ? null
          : () async {
              await Haptics.medium();
              onLongPress!();
            },
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
                if (deltaDirection != DeltaDirection.none) ...[
                  Text(
                    switch (deltaDirection) {
                      DeltaDirection.up => '▲',
                      DeltaDirection.down => '▼',
                      DeltaDirection.flat => '•',
                      DeltaDirection.none => '',
                    },
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: switch (deltaDirection) {
                        DeltaDirection.up => GraphiteTheme.success,
                        DeltaDirection.down => GraphiteTheme.danger,
                        DeltaDirection.flat ||
                        DeltaDirection.none =>
                          GraphiteTheme.slateDim,
                      },
                    ),
                  ),
                  const SizedBox(width: 4),
                ],
                Flexible(
                  child: Text(
                    delta,
                    style: switch (deltaDirection) {
                      DeltaDirection.up => GraphiteTheme.deltaUp,
                      DeltaDirection.down => GraphiteTheme.deltaDown,
                      DeltaDirection.flat ||
                      DeltaDirection.none =>
                        GraphiteTheme.deltaFlat,
                    }
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
