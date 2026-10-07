class CustomerModel {
  final String id;
  /// Realtime Database node key under `customers/`. This is the authoritative
  /// path segment for delete/edit/khata operations. It can differ from [id]
  /// (e.g. desktop-created records use push keys like `-NxYz...` while the
  /// stored numeric `id` field is just a legacy business identifier).
  final String key;
  final String name;
  final String phone;
  final String email;
  final int points;
  final double balance;

  CustomerModel({
    required this.id,
    String? key,
    required this.name,
    required this.phone,
    required this.email,
    required this.points,
    required this.balance,
  }) : key = (key != null && key.isNotEmpty) ? key : id;

  /// Convenience: the DB path segment to use for mutations.
  String get dbKey => key;

  CustomerModel copyWith({
    String? id,
    String? key,
    String? name,
    String? phone,
    String? email,
    int? points,
    double? balance,
  }) {
    return CustomerModel(
      id: id ?? this.id,
      key: key ?? this.key,
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
      key: key,
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
