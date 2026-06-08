/// Model class representing a catalog item (product)
/// This matches the SQLite schema in the Electron POS app and Firebase structure
class Product {
  final int id;
  final String name;
  final String barcode;
  final double price;
  final int stock;
  final String category;
  final double costPrice;

  Product({
    required this.id,
    required this.name,
    required this.barcode,
    required this.price,
    required this.stock,
    required this.category,
    required this.costPrice,
  });

  /// Create Product from Firebase snapshot data
  factory Product.fromJson(int id, Map<dynamic, dynamic> json) {
    return Product(
      id: id,
      name: json['name'] as String? ?? 'Unknown',
      barcode: json['barcode'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      stock: json['stock'] as int? ?? 0,
      category: json['category'] as String? ?? 'General',
      costPrice: (json['cost_price'] as num?)?.toDouble() ?? 0.0,
    );
  }

  /// Convert Product to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'barcode': barcode,
      'price': price,
      'stock': stock,
      'category': category,
      'cost_price': costPrice,
    };
  }

  /// Calculate markup percentage: ((selling_price - cost_price) / cost_price) * 100
  double get markupPercentage {
    if (costPrice <= 0) return 0.0;
    return ((price - costPrice) / costPrice) * 100;
  }
}
