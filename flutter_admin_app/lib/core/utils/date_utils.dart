import 'package:intl/intl.dart';

/// Utility class for date and time formatting
class AppDateUtils {
  /// Robustly parse any timestamp format (ISO-8601, SQLite DATETIME, epoch ms, int/string)
  static DateTime? parseDateTime(dynamic timestamp) {
    if (timestamp == null) return null;
    if (timestamp is DateTime) return timestamp;
    if (timestamp is int) {
      if (timestamp <= 0) return null;
      // If seconds instead of milliseconds
      if (timestamp < 10000000000) {
        return DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
      }
      return DateTime.fromMillisecondsSinceEpoch(timestamp);
    }

    final str = timestamp.toString().trim();
    if (str.isEmpty || str == 'null' || str == 'undefined') return null;

    // Check if numeric string (epoch ms)
    final numVal = int.tryParse(str);
    if (numVal != null && str.length >= 9) {
      if (str.length <= 10) {
        return DateTime.fromMillisecondsSinceEpoch(numVal * 1000);
      }
      return DateTime.fromMillisecondsSinceEpoch(numVal);
    }

    // Try standard ISO-8601 parse
    final parsed = DateTime.tryParse(str);
    if (parsed != null) return parsed;

    // Try replacing space with 'T' (SQLite format: 'YYYY-MM-DD HH:MM:SS')
    final withT = DateTime.tryParse(str.replaceAll(' ', 'T'));
    if (withT != null) return withT;

    return null;
  }

  /// Format timestamp to readable date and time
  /// Example: "Dec 15, 2024 at 2:30 PM"
  static String formatDateTime(dynamic timestamp) {
    try {
      final dateTime = parseDateTime(timestamp);
      if (dateTime == null) return 'Invalid date';
      final local = dateTime.isUtc ? dateTime.toLocal() : dateTime;
      final formatter = DateFormat('MMM dd, yyyy \'at\' h:mm a');
      return formatter.format(local);
    } catch (e) {
      return 'Invalid date';
    }
  }

  /// Format timestamp to date only
  /// Example: "Dec 15, 2024"
  static String formatDate(dynamic timestamp) {
    try {
      final dateTime = parseDateTime(timestamp);
      if (dateTime == null) return 'Invalid date';
      final local = dateTime.isUtc ? dateTime.toLocal() : dateTime;
      final formatter = DateFormat('MMM dd, yyyy');
      return formatter.format(local);
    } catch (e) {
      return 'Invalid date';
    }
  }

  /// Format timestamp to time only
  /// Example: "2:30 PM"
  static String formatTime(dynamic timestamp) {
    try {
      final dateTime = parseDateTime(timestamp);
      if (dateTime == null) return 'Invalid time';
      final local = dateTime.isUtc ? dateTime.toLocal() : dateTime;
      final formatter = DateFormat('h:mm a');
      return formatter.format(local);
    } catch (e) {
      return 'Invalid time';
    }
  }

  /// Format timestamp to relative time
  /// Example: "2 hours ago", "Yesterday", "3 days ago"
  static String formatRelativeTime(dynamic timestamp) {
    try {
      final dateTime = parseDateTime(timestamp);
      if (dateTime == null) return 'Unknown';
      final local = dateTime.isUtc ? dateTime.toLocal() : dateTime;
      final now = DateTime.now();
      final difference = now.difference(local);

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
        return formatDate(local);
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

  /// Check if timestamp belongs to today (comparing in local timezone)
  static bool isToday(dynamic timestamp) {
    try {
      final dateTime = parseDateTime(timestamp);
      if (dateTime == null) return false;
      final local = dateTime.isUtc ? dateTime.toLocal() : dateTime;
      final now = DateTime.now();
      return local.year == now.year &&
             local.month == now.month &&
             local.day == now.day;
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
