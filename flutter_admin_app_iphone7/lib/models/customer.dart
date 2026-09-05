class CustomerModel {
  final String id;
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

  CustomerModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    int? points,
    double? balance,
  }) {
    return CustomerModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      points: points ?? this.points,
      balance: balance ?? this.balance,
    );
  }

  factory CustomerModel.fromJson(String key, Map<dynamic, dynamic> json) {
    final rawId = json['id']?.toString();
    final actualId = (rawId != null && rawId.isNotEmpty && rawId != '0') ? rawId : key;
    return CustomerModel(
      id: actualId,
      name: json['name']?.toString() ?? 'Customer',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      points: (json['points'] is num)
          ? (json['points'] as num).toInt()
          : (int.tryParse(json['points']?.toString() ?? '0') ?? 0),
      balance: (json['balance'] is num)
          ? (json['balance'] as num).toDouble()
          : (double.tryParse(json['balance']?.toString() ?? '0') ?? 0.0),
    );
  }
}
