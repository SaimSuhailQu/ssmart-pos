import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';
import 'package:ssmart_pos_admin/models/dashboard_metrics.dart';

/// Noir Graphite weekly chart: platinum-gradient bars on dark glass, today's
/// bar in solid white with a glow. Monochrome tooltips.
///
/// Gestures: tap / drag across bars — each touched bar gives a selection
/// haptic and shows its day + revenue in a platinum tooltip.
class GraphiteSalesChart extends StatefulWidget {
  final List<DailyRevenue> dailyRevenue;

  const GraphiteSalesChart({super.key, required this.dailyRevenue});

  @override
  State<GraphiteSalesChart> createState() => _GraphiteSalesChartState();
}

class _GraphiteSalesChartState extends State<GraphiteSalesChart> {
  int _touchedIndex = -1;

  @override
  Widget build(BuildContext context) {
    if (widget.dailyRevenue.isEmpty) return _empty();

    final maxY = widget.dailyRevenue.fold<double>(
      0,
      (m, d) => d.revenue > m ? d.revenue : m,
    );

    return Container(
      decoration: GraphiteTheme.cardDecoration,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'LAST 7 DAYS',
                style: GraphiteTheme.sectionLabel.copyWith(fontSize: 10),
              ),
              const Spacer(),
              Text(
                'PKR ${_compact(widget.dailyRevenue.fold<double>(0, (s, d) => s + d.revenue))} total',
                style: GraphiteTheme.metricLabel.copyWith(fontSize: 10),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 170,
            child: BarChart(
              BarChartData(
                maxY: maxY * 1.25,
                barTouchData: BarTouchData(
                  enabled: true,
                  touchCallback: (event, response) {
                    final idx =
                        response?.spot?.touchedBarGroupIndex ?? -1;
                    if (idx != _touchedIndex && idx >= 0) {
                      Haptics.select();
                      setState(() => _touchedIndex = idx);
                    } else if (idx < 0 && _touchedIndex != -1) {
                      setState(() => _touchedIndex = -1);
                    }
                  },
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) =>
                        GraphiteTheme.platinum.withValues(alpha: 0.96),
                    getTooltipItem: (group, _, rod, __) {
                      final day = widget.dailyRevenue[group.x.toInt()];
                      return BarTooltipItem(
                        '${day.dayLabel}\n${AppDateUtils.formatCurrency(day.revenue)}',
                        const TextStyle(
                          color: GraphiteTheme.graphiteDeep,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      );
                    },
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  leftTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 26,
                      getTitlesWidget: (v, _) {
                        final i = v.toInt();
                        if (i < 0 || i >= widget.dailyRevenue.length) {
                          return const SizedBox.shrink();
                        }
                        final hot = i == _touchedIndex;
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            widget.dailyRevenue[i].dayLabel[0],
                            style:
                                GraphiteTheme.metricLabel.copyWith(
                              color: hot
                                  ? GraphiteTheme.platinumLight
                                  : GraphiteTheme.slateDim,
                              fontWeight: hot
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                barGroups: widget.dailyRevenue.asMap().entries.map((e) {
                  final i = e.key;
                  final isToday = i == widget.dailyRevenue.length - 1;
                  final hot = i == _touchedIndex;
                  final highlighted = isToday || hot;
                  return BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: e.value.revenue,
                        width: 26,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(7),
                        ),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: highlighted
                              ? [
                                  GraphiteTheme.platinumLight,
                                  GraphiteTheme.platinumDeep
                                      .withValues(alpha: 0.55),
                                ]
                              : [
                                  GraphiteTheme.platinum
                                      .withValues(alpha: 0.42),
                                  GraphiteTheme.platinumDeep
                                      .withValues(alpha: 0.22),
                                ],
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _compact(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }

  Widget _empty() {
    return Container(
      decoration: GraphiteTheme.cardDecoration,
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Icon(
            Icons.show_chart,
            size: 40,
            color: GraphiteTheme.slateDim,
          ),
          const SizedBox(height: 10),
          Text(
            'No sales data yet',
            style: GraphiteTheme.body.copyWith(color: GraphiteTheme.slate),
          ),
        ],
      ),
    );
  }
}
