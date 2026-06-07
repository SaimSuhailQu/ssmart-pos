import 'package:intl/intl.dart';

/// Utility class for date and time formatting
class AppDateUtils {
  /// Format timestamp to readable date and time
  /// Example: "Dec 15, 2024 at 2:30 PM"
  static String formatDateTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      final formatter = DateFormat('MMM dd, yyyy \'at\' h:mm a');
      return formatter.format(dateTime);
    } catch (e) {
      return 'Invalid date';
    }
  }

  /// Format timestamp to date only
  /// Example: "Dec 15, 2024"
  static String formatDate(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      final formatter = DateFormat('MMM dd, yyyy');
      return formatter.format(dateTime);
    } catch (e) {
      return 'Invalid date';
    }
  }

  /// Format timestamp to time only
  /// Example: "2:30 PM"
  static String formatTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      final formatter = DateFormat('h:mm a');
      return formatter.format(dateTime);
    } catch (e) {
      return 'Invalid time';
    }
  }

  /// Format timestamp to relative time
  /// Example: "2 hours ago", "Yesterday", "3 days ago"
  static String formatRelativeTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      final now = DateTime.now();
      final difference = now.difference(dateTime);

      if (difference.inSeconds < 60) {
        return 'Just now';
      } else if (difference.inMinutes < 60) {
        return '${difference.inMinutes} ${difference.inMinutes == 1 ? 'minute' : 'minutes'} ago';
      } else if (difference.inHours < 24) {
        return '${difference.inHours} ${difference.inHours == 1 ? 'hour' : 'hours'} ago';
      } else if (difference.inDays == 1) {
        return 'Yesterday';
      } else if (difference.inDays < 7) {
        return '${difference.inDays} days ago';
      } else {
        return formatDate(timestamp);
      }
    } catch (e) {
      return 'Unknown';
    }
  }

  /// Get start of day timestamp
  static DateTime getStartOfDay(DateTime date) {
    return DateTime(date.year, date.month, date.day);
  }

  /// Get end of day timestamp
  static DateTime getEndOfDay(DateTime date) {
    return DateTime(date.year, date.month, date.day, 23, 59, 59, 999);
  }

  /// Get start of today
  static DateTime getStartOfToday() {
    final now = DateTime.now();
    return getStartOfDay(now);
  }

  /// Get date range for last N days
  static DateTimeRange getLastNDays(int days) {
    final now = DateTime.now();
    final startDate = now.subtract(Duration(days: days - 1));
    return DateTimeRange(
      start: getStartOfDay(startDate),
      end: getEndOfDay(now),
    );
  }

  /// Check if timestamp is today
  static bool isToday(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp);
      final now = DateTime.now();
      return dateTime.year == now.year &&
             dateTime.month == now.month &&
             dateTime.day == now.day;
    } catch (e) {
      return false;
    }
  }

  /// Format currency amount
  /// Example: "PKR 1,234.56"
  static String formatCurrency(double amount, {String symbol = 'PKR'}) {
    final formatter = NumberFormat.currency(
      symbol: symbol,
      decimalDigits: 2,
      locale: 'en_PK',
    );
    return formatter.format(amount);
  }

  /// Format number with commas
  /// Example: "1,234"
  static String formatNumber(int number) {
    final formatter = NumberFormat('#,###');
    return formatter.format(number);
  }
}

/// Date range class for filtering
class DateTimeRange {
  final DateTime start;
  final DateTime end;

  DateTimeRange({required this.start, required this.end});
}
