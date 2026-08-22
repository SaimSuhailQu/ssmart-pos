class CustomerModel {
  final int id;
  final String name;
  final String phone;
  final String email;
  final int points;
  final double balance;

  CustomerModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.points,
    required this.balance,
  });

  factory CustomerModel.fromJson(String id, Map<dynamic, dynamic> json) {
    return CustomerModel(
      id: int.tryParse(id) ?? (json['id'] is int ? json['id'] : 0),
      name: json['name']?.toString() ?? 'Customer',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      points: (json['points'] is num) ? (json['points'] as num).toInt() : 0,
      balance: (json['balance'] is num) ? (json['balance'] as num).toDouble() : 0.0,
    );
  }
}
