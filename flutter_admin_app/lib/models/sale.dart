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
    this.items,
    this.payments,
  });

  /// Create Sale from Firebase Realtime Database snapshot
  factory Sale.fromJson(String id, Map<dynamic, dynamic> json) {
    return Sale(
      id: id,
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      tax: (json['tax'] as num?)?.toDouble() ?? 0.0,
      discount: (json['discount'] as num?)?.toDouble() ?? 0.0,
      total: (json['total'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: json['payment_method'] as String? ?? 'Unknown',
      amountTendered: (json['amount_tendered'] as num?)?.toDouble() ?? 0.0,
      changeGiven: (json['change_given'] as num?)?.toDouble() ?? 0.0,
      timestamp: json['timestamp'] as String? ?? '',
      storeBranch: json['store_branch'] as String?,
      userId: json['user_id'] as int?,
      userName: json['user_name'] as String?,
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
            .map((item) => SaleItem.fromJson(item as Map<dynamic, dynamic>))
            .toList();
      } else if (itemsData is Map) {
        return itemsData.values
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
            .map((payment) => PaymentDetail.fromJson(payment as Map<dynamic, dynamic>))
            .toList();
      } else if (paymentsData is Map) {
        return paymentsData.values
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
      productId: json['product_id'] as int? ?? 0,
      productName: json['product_name'] as String? ?? 'Unknown',
      productBarcode: json['product_barcode'] as String?,
      productCategory: json['product_category'] as String?,
      quantity: json['qty'] as int? ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
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
      method: json['method'] as String? ?? 'Unknown',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'method': method,
      'amount': amount,
    };
  }
}
