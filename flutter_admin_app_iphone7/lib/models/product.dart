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
    final parsedId = (json['id'] is num)
        ? (json['id'] as num).toInt()
        : (int.tryParse(json['id']?.toString() ?? '') ?? id);

    final parsedStock = (json['stock'] is num)
        ? (json['stock'] as num).toInt()
        : (int.tryParse(json['stock']?.toString() ?? '') ?? 0);

    final parsedPrice = (json['price'] is num)
        ? (json['price'] as num).toDouble()
        : (double.tryParse(json['price']?.toString() ?? '') ?? 0.0);

    final parsedCostPrice = (json['cost_price'] is num)
        ? (json['cost_price'] as num).toDouble()
        : (json['costPrice'] is num)
            ? (json['costPrice'] as num).toDouble()
            : (double.tryParse(json['cost_price']?.toString() ?? json['costPrice']?.toString() ?? '') ?? 0.0);

    return Product(
      id: parsedId,
      name: json['name']?.toString().trim().isNotEmpty == true
          ? json['name'].toString().trim()
          : (json['product_name']?.toString().trim().isNotEmpty == true
              ? json['product_name'].toString().trim()
              : 'Product $parsedId'),
      barcode: json['barcode']?.toString().trim() ??
          json['product_barcode']?.toString().trim() ??
          '',
      price: parsedPrice,
      stock: parsedStock,
      category: json['category']?.toString().trim().isNotEmpty == true
          ? json['category'].toString().trim()
          : 'General',
      costPrice: parsedCostPrice,
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
