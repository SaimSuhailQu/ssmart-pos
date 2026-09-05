class ExpenseModel {
  final int id;
  final double amount;
  final String description;
  final String category;
  final String loggedBy;
  final String timestamp;

  String get date => timestamp;

  ExpenseModel({
    required this.id,
    required this.amount,
    required this.description,
    required this.category,
    required this.loggedBy,
    required this.timestamp,
  });

  factory ExpenseModel.fromJson(String id, Map<dynamic, dynamic> json) {
    return ExpenseModel(
      id: int.tryParse(id) ?? (json['id'] is int ? json['id'] : 0),
      amount: (json['amount'] is num) ? (json['amount'] as num).toDouble() : 0.0,
      description: json['description']?.toString() ?? '',
      category: json['category']?.toString() ?? 'Others',
      loggedBy: json['logged_by']?.toString() ?? json['loggedBy']?.toString() ?? 'Staff',
      timestamp: json['timestamp']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }
}
