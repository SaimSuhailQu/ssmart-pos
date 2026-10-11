/// Model representing an item that needs to be brought/purchased for the store
class ItemToBring {
  final String id;
  final String name;
  final String quantity; // e.g., "5 kg", "2 cartons", "10 packets"
  final String note;
  final bool isBrought;
  final DateTime createdAt;
  final DateTime? broughtAt;

  ItemToBring({
    required this.id,
    required this.name,
    this.quantity = '',
    this.note = '',
    this.isBrought = false,
    required this.createdAt,
    this.broughtAt,
  });

  factory ItemToBring.fromJson(String id, Map<dynamic, dynamic> json) {
    DateTime parseDate(dynamic val) {
      if (val is int) {
        return DateTime.fromMillisecondsSinceEpoch(val);
      }
      if (val is String) {
        final parsed = DateTime.tryParse(val);
        if (parsed != null) return parsed;
      }
      return DateTime.now();
    }

    return ItemToBring(
      id: id,
      name: json['name']?.toString().trim() ?? 'Item',
      quantity: json['quantity']?.toString().trim() ?? '',
      note: json['note']?.toString().trim() ?? '',
      isBrought: json['is_brought'] == true || json['isBrought'] == true,
      createdAt: json['created_at'] != null ? parseDate(json['created_at']) : DateTime.now(),
      broughtAt: json['brought_at'] != null ? parseDate(json['brought_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'quantity': quantity,
      'note': note,
      'is_brought': isBrought,
      'created_at': createdAt.millisecondsSinceEpoch,
      'brought_at': broughtAt?.millisecondsSinceEpoch,
    };
  }
}
