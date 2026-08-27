import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/sale.dart';

/// Aggregated metrics for the dashboard
class DashboardMetrics {
  final double totalRevenue;
  final int transactionCount;
  final double averageTransactionValue;
  final Map<String, double> revenueByPaymentMethod;
  final List<DailyRevenue> dailyRevenue;
  final DateTime calculatedAt;

  DashboardMetrics({
    required this.totalRevenue,
    required this.transactionCount,
    required this.averageTransactionValue,
    required this.revenueByPaymentMethod,
    required this.dailyRevenue,
    DateTime? calculatedAt,
  }) : calculatedAt = calculatedAt ?? DateTime.now();

  /// Calculate metrics from a list of sales
  factory DashboardMetrics.fromSales(List<Sale> sales, {int daysHistory = 7}) {
    if (sales.isEmpty) {
      return DashboardMetrics(
        totalRevenue: 0.0,
        transactionCount: 0,
        averageTransactionValue: 0.0,
        revenueByPaymentMethod: {},
        dailyRevenue: [],
      );
    }

    // Calculate total revenue
    final totalRevenue = sales.fold<double>(
      0.0,
      (sum, sale) => sum + sale.total,
    );

    // Calculate transaction count
    final transactionCount = sales.length;

    // Calculate average transaction value
    final averageTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0.0;

    // Calculate revenue by payment method
    final revenueByPaymentMethod = <String, double>{};
    for (final sale in sales) {
      final method = sale.paymentMethod.isNotEmpty ? sale.paymentMethod : 'Cash';
      revenueByPaymentMethod[method] =
          (revenueByPaymentMethod[method] ?? 0.0) + sale.total;
    }

    // Calculate daily revenue for last N days
    final dailyRevenue = _calculateDailyRevenue(sales, daysHistory);

    return DashboardMetrics(
      totalRevenue: totalRevenue,
      transactionCount: transactionCount,
      averageTransactionValue: averageTransactionValue,
      revenueByPaymentMethod: revenueByPaymentMethod,
      dailyRevenue: dailyRevenue,
    );
  }

  /// Calculate today's metrics from a list of sales using resilient timezone comparison
  factory DashboardMetrics.todayFromSales(List<Sale> sales) {
    final todaySales = sales.where((sale) {
      return AppDateUtils.isToday(sale.timestamp);
    }).toList();

    return DashboardMetrics.fromSales(todaySales, daysHistory: 1);
  }

  /// Calculate daily revenue breakdown
  static List<DailyRevenue> _calculateDailyRevenue(List<Sale> sales, int days) {
    final dailyMap = <String, double>{};
    final now = DateTime.now();

    // Initialize all days with 0
    for (int i = days - 1; i >= 0; i--) {
      final date = now.subtract(Duration(days: i));
      final dateKey = _dateKey(date);
      dailyMap[dateKey] = 0.0;
    }

    // Aggregate sales by day
    for (final sale in sales) {
      try {
        final saleDate = AppDateUtils.parseDateTime(sale.timestamp);
        if (saleDate == null) continue;
        final localDate = saleDate.isUtc ? saleDate.toLocal() : saleDate;
        final dateKey = _dateKey(localDate);

        // Only include if within the date range
        final daysAgo = now.difference(localDate).inDays;
        if (daysAgo < days && dailyMap.containsKey(dateKey)) {
          dailyMap[dateKey] = (dailyMap[dateKey] ?? 0.0) + sale.total;
        }
      } catch (e) {
        print('Error aggregating sale daily revenue: $e');
      }
    }

    // Convert to list and sort by date
    final result = dailyMap.entries
        .map(
          (entry) => DailyRevenue(
            date: _parseDate(entry.key),
            revenue: entry.value,
          ),
        )
        .toList()
      ..sort((a, b) => a.date.compareTo(b.date));

    return result;
  }

  /// Create a date key for grouping (YYYY-MM-DD)
  static String _dateKey(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  /// Parse date from key
  static DateTime _parseDate(String key) {
    final parts = key.split('-');
    return DateTime(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
  }

  /// Get the most popular payment method
  String get mostPopularPaymentMethod {
    if (revenueByPaymentMethod.isEmpty) return 'N/A';

    return revenueByPaymentMethod.entries
        .reduce((a, b) => a.value > b.value ? a : b)
        .key;
  }

  /// Get today's growth percentage compared to yesterday
  double? getTodayGrowth(DashboardMetrics yesterdayMetrics) {
    if (yesterdayMetrics.totalRevenue == 0) return null;

    final growth = ((totalRevenue - yesterdayMetrics.totalRevenue) /
                   yesterdayMetrics.totalRevenue) * 100;
    return growth;
  }
}

/// Daily revenue data point for charts
class DailyRevenue {
  final DateTime date;
  final double revenue;

  DailyRevenue({
    required this.date,
    required this.revenue,
  });

  /// Format date for display (e.g., "Mon", "Tue")
  String get dayLabel {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[date.weekday - 1];
  }

  /// Format date for display (e.g., "12/15")
  String get dateLabel {
    return '${date.month}/${date.day}';
  }
}
