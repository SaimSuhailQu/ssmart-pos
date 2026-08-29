/// Model class representing a sale transaction
/// This matches the Electron POS app's Sale interface and Firebase structure
class Sale {
  final String id;
  final double subtotal;
  final double tax;
  final double discount;
  final double total;
  final String paymentMethod;
  final double amountTendered;
  final double changeGiven;
  final String timestamp;
  final String? storeBranch;
  final int? userId;
  final String? userName;
  final String? customerId;
  final String? customerName;
  final String? customerPhone;
  final List<SaleItem>? items;
  final List<PaymentDetail>? payments;

  Sale({
    required this.id,
    required this.subtotal,
    required this.tax,
    required this.discount,
    required this.total,
    required this.paymentMethod,
    required this.amountTendered,
    required this.changeGiven,
    required this.timestamp,
    this.storeBranch,
    this.userId,
    this.userName,
    this.customerId,
    this.customerName,
    this.customerPhone,
    this.items,
    this.payments,
  });

  /// Create Sale from Firebase Realtime Database snapshot safely
  factory Sale.fromJson(String id, Map<dynamic, dynamic> json) {
    return Sale(
      id: id,
      subtotal: _toDouble(json['subtotal']),
      tax: _toDouble(json['tax']),
      discount: _toDouble(json['discount']),
      total: _toDouble(json['total']),
      paymentMethod: _toString(json['payment_method'], 'Cash'),
      amountTendered: _toDouble(json['amount_tendered']),
      changeGiven: _toDouble(json['change_given']),
      timestamp: _toString(json['timestamp']),
      storeBranch: json['store_branch'] != null ? _toString(json['store_branch']) : null,
      userId: json['user_id'] != null ? _toInt(json['user_id']) : null,
      userName: json['user_name'] != null ? _toString(json['user_name']) : null,
      customerId: json['customer_id'] != null ? _toString(json['customer_id']) : null,
      customerName: json['customer_name'] != null ? _toString(json['customer_name']) : null,
      customerPhone: json['customer_phone'] != null ? _toString(json['customer_phone']) : null,
      items: _parseItems(json['items']),
      payments: _parsePayments(json['payments']),
    );
  }

  /// Convert Sale to JSON for Firebase
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'subtotal': subtotal,
      'tax': tax,
      'discount': discount,
      'total': total,
      'payment_method': paymentMethod,
      'amount_tendered': amountTendered,
      'change_given': changeGiven,
      'timestamp': timestamp,
      if (storeBranch != null) 'store_branch': storeBranch,
      if (userId != null) 'user_id': userId,
      if (userName != null) 'user_name': userName,
      if (customerId != null) 'customer_id': customerId,
      if (customerName != null) 'customer_name': customerName,
      if (customerPhone != null) 'customer_phone': customerPhone,
      if (items != null) 'items': items!.map((i) => i.toJson()).toList(),
      if (payments != null) 'payments': payments!.map((p) => p.toJson()).toList(),
    };
  }

  /// Parse items array from Firebase data
  static List<SaleItem>? _parseItems(dynamic itemsData) {
    if (itemsData == null) return null;

    try {
      if (itemsData is List) {
        return itemsData
            .where((item) => item != null && item is Map)
            .map((item) => SaleItem.fromJson(item as Map<dynamic, dynamic>))
            .toList();
      } else if (itemsData is Map) {
        return itemsData.values
            .where((item) => item != null && item is Map)
            .map((item) => SaleItem.fromJson(item as Map<dynamic, dynamic>))
            .toList();
      }
    } catch (e) {
      print('Error parsing items: $e');
    }
    return null;
  }

  /// Parse payments array from Firebase data
  static List<PaymentDetail>? _parsePayments(dynamic paymentsData) {
    if (paymentsData == null) return null;

    try {
      if (paymentsData is List) {
        return paymentsData
            .where((payment) => payment != null && payment is Map)
            .map((payment) => PaymentDetail.fromJson(payment as Map<dynamic, dynamic>))
            .toList();
      } else if (paymentsData is Map) {
        return paymentsData.values
            .where((payment) => payment != null && payment is Map)
            .map((payment) => PaymentDetail.fromJson(payment as Map<dynamic, dynamic>))
            .toList();
      }
    } catch (e) {
      print('Error parsing payments: $e');
    }
    return null;
  }

  /// Create a copy with modified fields
  Sale copyWith({
    String? id,
    double? subtotal,
    double? tax,
    double? discount,
    double? total,
    String? paymentMethod,
    double? amountTendered,
    double? changeGiven,
    String? timestamp,
    String? storeBranch,
    int? userId,
    String? userName,
    String? customerId,
    String? customerName,
    String? customerPhone,
    List<SaleItem>? items,
    List<PaymentDetail>? payments,
  }) {
    return Sale(
      id: id ?? this.id,
      subtotal: subtotal ?? this.subtotal,
      tax: tax ?? this.tax,
      discount: discount ?? this.discount,
      total: total ?? this.total,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      amountTendered: amountTendered ?? this.amountTendered,
      changeGiven: changeGiven ?? this.changeGiven,
      timestamp: timestamp ?? this.timestamp,
      storeBranch: storeBranch ?? this.storeBranch,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      items: items ?? this.items,
      payments: payments ?? this.payments,
    );
  }
}

/// Individual item in a sale
class SaleItem {
  final int productId;
  final String productName;
  final String? productBarcode;
  final String? productCategory;
  final int quantity;
  final double price;

  SaleItem({
    required this.productId,
    required this.productName,
    this.productBarcode,
    this.productCategory,
    required this.quantity,
    required this.price,
  });

  factory SaleItem.fromJson(Map<dynamic, dynamic> json) {
    return SaleItem(
      productId: _toInt(json['product_id'] ?? json['productId']),
      productName: _toString(json['product_name'] ?? json['productName'] ?? json['name'], 'Unknown Item'),
      productBarcode: json['product_barcode'] != null || json['barcode'] != null
          ? _toString(json['product_barcode'] ?? json['barcode'])
          : null,
      productCategory: json['product_category'] != null || json['category'] != null
          ? _toString(json['product_category'] ?? json['category'])
          : null,
      quantity: _toInt(json['qty'] ?? json['quantity'] ?? 1, fallback: 1),
      price: _toDouble(json['price']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product_id': productId,
      'product_name': productName,
      if (productBarcode != null) 'product_barcode': productBarcode,
      if (productCategory != null) 'product_category': productCategory,
      'qty': quantity,
      'price': price,
    };
  }

  /// Calculate total for this item
  double get total => price * quantity;
}

/// Payment detail in a sale (for split payments)
class PaymentDetail {
  final String method;
  final double amount;

  PaymentDetail({
    required this.method,
    required this.amount,
  });

  factory PaymentDetail.fromJson(Map<dynamic, dynamic> json) {
    return PaymentDetail(
      method: _toString(json['method'] ?? json['payment_method'], 'Cash'),
      amount: _toDouble(json['amount']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'method': method,
      'amount': amount,
    };
  }
}

// Type parsing helpers
double _toDouble(dynamic val) {
  if (val == null) return 0.0;
  if (val is double) return val;
  if (val is int) return val.toDouble();
  if (val is num) return val.toDouble();
  if (val is String) {
    return double.tryParse(val.trim()) ?? 0.0;
  }
  return 0.0;
}

int _toInt(dynamic val, {int fallback = 0}) {
  if (val == null) return fallback;
  if (val is int) return val;
  if (val is num) return val.toInt();
  if (val is String) {
    return int.tryParse(val.trim()) ?? (double.tryParse(val.trim())?.toInt() ?? fallback);
  }
  return fallback;
}

String _toString(dynamic val, [String fallback = '']) {
  if (val == null) return fallback;
  final s = val.toString().trim();
  return s.isEmpty ? fallback : s;
}
