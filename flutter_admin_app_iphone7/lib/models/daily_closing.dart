/// Model class representing a Daily Closing record
class DailyClosingModel {
  final String id;
  final String date; // Format: YYYY-MM-DD
  final double total;
  final double cashAmount;
  final double onlineAmount;
  final String notes;
  final String loggedBy;
  final String timestamp;

  DailyClosingModel({
    required this.id,
    required this.date,
    required this.total,
    this.cashAmount = 0.0,
    this.onlineAmount = 0.0,
    this.notes = '',
    this.loggedBy = 'Admin',
    required this.timestamp,
  });

  factory DailyClosingModel.fromJson(String id, Map<dynamic, dynamic> json) {
    final rawDate = json['date']?.toString();
    final rawTimestamp = json['timestamp']?.toString() ?? DateTime.now().toIso8601String();
    
    String resolvedDate = rawDate ?? '';
    if (resolvedDate.isEmpty) {
      try {
        final dt = DateTime.parse(rawTimestamp);
        resolvedDate = '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
      } catch (_) {
        resolvedDate = DateTime.now().toIso8601String().substring(0, 10);
      }
    }

    return DailyClosingModel(
      id: id,
      date: resolvedDate,
      total: (json['total'] is num)
          ? (json['total'] as num).toDouble()
          : (double.tryParse(json['total']?.toString() ?? '0') ?? 0.0),
      cashAmount: (json['cash_amount'] is num)
          ? (json['cash_amount'] as num).toDouble()
          : (double.tryParse(json['cash_amount']?.toString() ?? '0') ?? 0.0),
      onlineAmount: (json['online_amount'] is num)
          ? (json['online_amount'] as num).toDouble()
          : (double.tryParse(json['online_amount']?.toString() ?? '0') ?? 0.0),
      notes: json['notes']?.toString() ?? '',
      loggedBy: json['logged_by']?.toString() ?? 'Admin',
      timestamp: rawTimestamp,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'date': date,
      'total': total,
      'cash_amount': cashAmount,
      'online_amount': onlineAmount,
      'notes': notes,
      'logged_by': loggedBy,
      'timestamp': timestamp,
    };
  }

  DailyClosingModel copyWith({
    String? id,
    String? date,
    double? total,
    double? cashAmount,
    double? onlineAmount,
    String? notes,
    String? loggedBy,
    String? timestamp,
  }) {
    return DailyClosingModel(
      id: id ?? this.id,
      date: date ?? this.date,
      total: total ?? this.total,
      cashAmount: cashAmount ?? this.cashAmount,
      onlineAmount: onlineAmount ?? this.onlineAmount,
      notes: notes ?? this.notes,
      loggedBy: loggedBy ?? this.loggedBy,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}
