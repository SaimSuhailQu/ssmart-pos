import 'package:intl/intl.dart';

/// Utility class for currency and number formatting
class CurrencyFormatter {
  /// Format currency amount with symbol
  /// Example: "PKR 1,234.56"
  static String formatCurrency(double amount, {String symbol = 'PKR'}) {
    final formatter = NumberFormat.currency(
      symbol: symbol,
      decimalDigits: 2,
      locale: 'en_PK',
    );
    return formatter.format(amount);
  }

  /// Format date time
  static String formatDateTime(dynamic dateTime) {
    try {
      if (dateTime is DateTime) {
        final formatter = DateFormat('MMM dd, yyyy \'at\' h:mm a');
        return formatter.format(dateTime);
      } else if (dateTime is String) {
        final parsed = DateTime.parse(dateTime);
        final formatter = DateFormat('MMM dd, yyyy \'at\' h:mm a');
        return formatter.format(parsed);
      }
      return dateTime.toString();
    } catch (_) {
      return dateTime.toString();
    }
  }

  /// Format number with commas
  /// Example: "1,234"
  static String formatNumber(int number) {
    final formatter = NumberFormat('#,###');
    return formatter.format(number);
  }
}
