import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/dashboard_metrics.dart';

/// Line chart showing sales trend over the last 7 days
class SalesChart extends StatelessWidget {
  final List<DailyRevenue> dailyRevenue;

  const SalesChart({
    super.key,
    required this.dailyRevenue,
  });

  @override
  Widget build(BuildContext context) {
    if (dailyRevenue.isEmpty) {
      return _buildEmptyState();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingM),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sales Trend (Last 7 Days)',
              style: AppTheme.titleMedium,
            ),
            const SizedBox(height: AppTheme.spacingL),
            SizedBox(
              height: 200,
              child: LineChart(
                _buildChartData(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  LineChartData _buildChartData() {
    final spots = dailyRevenue.asMap().entries.map((entry) {
      return FlSpot(entry.key.toDouble(), entry.value.revenue);
    }).toList();

    final maxY = dailyRevenue.fold<double>(
      0,
      (max, item) => item.revenue > max ? item.revenue : max,
    );

    return LineChartData(
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        horizontalInterval: maxY > 0 ? maxY / 4 : 1000,
        getDrawingHorizontalLine: (value) {
          return const FlLine(
            color: AppTheme.borderColor,
            strokeWidth: 1,
          );
        },
      ),
      titlesData: FlTitlesData(
        show: true,
        rightTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        topTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 30,
            interval: 1,
            getTitlesWidget: (value, meta) {
              if (value.toInt() >= 0 && value.toInt() < dailyRevenue.length) {
                return Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: Text(
                    dailyRevenue[value.toInt()].dayLabel,
                    style: AppTheme.labelSmall,
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 50,
            interval: maxY > 0 ? maxY / 4 : 1000,
            getTitlesWidget: (value, meta) {
              return Text(
                _formatYAxisValue(value),
                style: AppTheme.labelSmall,
              );
            },
          ),
        ),
      ),
      borderData: FlBorderData(
        show: true,
        border: const Border(
          bottom: BorderSide(color: AppTheme.borderColor),
          left: BorderSide(color: AppTheme.borderColor),
        ),
      ),
      minX: 0,
      maxX: (dailyRevenue.length - 1).toDouble(),
      minY: 0,
      maxY: maxY * 1.2,
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          color: AppTheme.primaryBlue,
          barWidth: 3,
          isStrokeCapRound: true,
          dotData: FlDotData(
            show: true,
            getDotPainter: (spot, percent, barData, index) {
              return FlDotCirclePainter(
                radius: 4,
                color: AppTheme.cardBackground,
                strokeWidth: 2,
                strokeColor: AppTheme.primaryBlue,
              );
            },
          ),
          belowBarData: BarAreaData(
            show: true,
            color: AppTheme.primaryBlue.withValues(alpha: 0.1),
          ),
        ),
      ],
      lineTouchData: LineTouchData(
        enabled: true,
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (touchedSpot) => AppTheme.textPrimary.withValues(alpha: 0.8),
          getTooltipItems: (touchedSpots) {
            return touchedSpots.map((spot) {
              final revenue = spot.y;
              final date = dailyRevenue[spot.x.toInt()].dateLabel;
              return LineTooltipItem(
                '$date\n${AppDateUtils.formatCurrency(revenue)}',
                AppTheme.bodySmall.copyWith(color: Colors.white),
              );
            }).toList();
          },
        ),
      ),
    );
  }

  String _formatYAxisValue(double value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    } else if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(0)}K';
    } else {
      return value.toStringAsFixed(0);
    }
  }

  Widget _buildEmptyState() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingL),
        child: Column(
          children: [
            Text(
              'Sales Trend (Last 7 Days)',
              style: AppTheme.titleMedium,
            ),
            const SizedBox(height: AppTheme.spacingL),
            Container(
              height: 200,
              alignment: Alignment.center,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.show_chart,
                    size: 48,
                    color: AppTheme.textTertiary,
                  ),
                  const SizedBox(height: AppTheme.spacingM),
                  Text(
                    'No sales data available',
                    style: AppTheme.bodyMedium.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
