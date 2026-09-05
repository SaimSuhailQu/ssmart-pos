class VendorModel {
  final int id;
  final String name;
  final String contact;
  final String category;
  final double outstandingBalance;
  final int poCount;

  VendorModel({
    required this.id,
    required this.name,
    required this.contact,
    required this.category,
    this.outstandingBalance = 0.0,
    this.poCount = 0,
  });

  factory VendorModel.fromJson(String id, Map<dynamic, dynamic> json) {
    final parsedId = int.tryParse(id) ??
        (json['id'] is int
            ? json['id'] as int
            : int.tryParse(json['id']?.toString() ?? '') ?? 0);

    return VendorModel(
      id: parsedId,
      name: json['name']?.toString().trim().isNotEmpty == true
          ? json['name'].toString().trim()
          : 'Vendor $parsedId',
      contact: json['contact']?.toString().trim() ??
          json['phone']?.toString().trim() ??
          '',
      category: json['category']?.toString().trim().isNotEmpty == true
          ? json['category'].toString().trim()
          : 'General',
      outstandingBalance: (json['outstanding_balance'] is num)
          ? (json['outstanding_balance'] as num).toDouble()
          : (double.tryParse(json['outstanding_balance']?.toString() ?? '') ?? 0.0),
      poCount: (json['po_count'] is int)
          ? json['po_count'] as int
          : (int.tryParse(json['po_count']?.toString() ?? '') ?? 0),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'contact': contact,
      'category': category,
    };
  }

  VendorModel copyWith({
    int? id,
    String? name,
    String? contact,
    String? category,
    double? outstandingBalance,
    int? poCount,
  }) {
    return VendorModel(
      id: id ?? this.id,
      name: name ?? this.name,
      contact: contact ?? this.contact,
      category: category ?? this.category,
      outstandingBalance: outstandingBalance ?? this.outstandingBalance,
      poCount: poCount ?? this.poCount,
    );
  }
}

class PurchaseOrderModel {
  final int id;
  final int vendorId;
  final String vendorName;
  final String contactPerson;
  final String phone;
  final String email;
  final String notes;
  final String status;
  final double totalCost;
  final double paidAmount;
  final String paymentStatus;
  final String timestamp;
  final List<dynamic> items;
  final List<dynamic> payments;
  final List<dynamic> orderEntries;

  PurchaseOrderModel({
    required this.id,
    required this.vendorId,
    required this.vendorName,
    required this.contactPerson,
    required this.phone,
    required this.email,
    required this.notes,
    required this.status,
    required this.totalCost,
    required this.paidAmount,
    required this.paymentStatus,
    required this.timestamp,
    required this.items,
    required this.payments,
    required this.orderEntries,
  });

  double get balanceDue => (totalCost - paidAmount).clamp(0.0, double.infinity);
  bool get isPaid => balanceDue <= 0 && totalCost > 0;
  bool get isReceived => status.toLowerCase() == 'received';

  factory PurchaseOrderModel.fromJson(String id, Map<dynamic, dynamic> json) {
    final parsedId = int.tryParse(id) ??
        (json['id'] is int
            ? json['id'] as int
            : int.tryParse(json['id']?.toString() ?? '') ?? 0);

    final parsedVendorId = json['vendor_id'] is int
        ? json['vendor_id'] as int
        : (int.tryParse(json['vendor_id']?.toString() ?? '') ?? 0);

    final rawCost = json['total_cost'] ?? json['total_amount'] ?? json['amount'];
    final double totalCost = (rawCost is num)
        ? rawCost.toDouble()
        : (double.tryParse(rawCost?.toString() ?? '') ?? 0.0);

    final rawPaid = json['paid_amount'] ?? json['amount_paid'];
    final double paidAmount = (rawPaid is num)
        ? rawPaid.toDouble()
        : (double.tryParse(rawPaid?.toString() ?? '') ?? 0.0);

    final String phone = json['phone']?.toString().trim() ??
        json['vendor_contact']?.toString().trim() ??
        json['contact']?.toString().trim() ??
        '';

    final String vendorName = json['vendor_name']?.toString().trim().isNotEmpty == true
        ? json['vendor_name'].toString().trim()
        : 'Vendor #$parsedVendorId';

    final String contactPerson = json['contact_person']?.toString().trim().isNotEmpty == true
        ? json['contact_person'].toString().trim()
        : vendorName;

    // Normalizing payments list
    List<dynamic> paymentsList = [];
    if (json['payments'] is List) {
      paymentsList = json['payments'] as List;
    } else if (json['payments'] is Map) {
      (json['payments'] as Map).forEach((_, v) {
        if (v != null) paymentsList.add(v);
      });
    }

    // Normalizing items list
    List<dynamic> itemsList = [];
    if (json['items'] is List) {
      itemsList = json['items'] as List;
    } else if (json['items'] is Map) {
      (json['items'] as Map).forEach((_, v) {
        if (v != null) itemsList.add(v);
      });
    }

    // Normalizing order entries list
    List<dynamic> entriesList = [];
    if (json['order_entries'] is List) {
      entriesList = json['order_entries'] as List;
    } else if (json['order_entries'] is Map) {
      (json['order_entries'] as Map).forEach((_, v) {
        if (v != null) entriesList.add(v);
      });
    }

    return PurchaseOrderModel(
      id: parsedId,
      vendorId: parsedVendorId,
      vendorName: vendorName,
      contactPerson: contactPerson,
      phone: phone,
      email: json['email']?.toString() ?? '',
      notes: json['notes']?.toString() ?? '',
      status: json['status']?.toString().isNotEmpty == true
          ? json['status'].toString()
          : 'Pending',
      totalCost: totalCost,
      paidAmount: paidAmount,
      paymentStatus: json['payment_status']?.toString().isNotEmpty == true
          ? json['payment_status'].toString()
          : (totalCost > 0 && paidAmount >= totalCost
              ? 'Paid'
              : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid')),
      timestamp: json['timestamp']?.toString() ?? DateTime.now().toIso8601String(),
      items: itemsList,
      payments: paymentsList,
      orderEntries: entriesList,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'vendor_id': vendorId,
      'vendor_name': vendorName,
      'contact_person': contactPerson,
      'phone': phone,
      'email': email,
      'notes': notes,
      'status': status,
      'total_cost': totalCost,
      'total_amount': totalCost,
      'paid_amount': paidAmount,
      'payment_status': paymentStatus,
      'timestamp': timestamp,
      'items': items,
      'payments': payments,
      'order_entries': orderEntries,
    };
  }

  PurchaseOrderModel copyWith({
    int? id,
    int? vendorId,
    String? vendorName,
    String? contactPerson,
    String? phone,
    String? email,
    String? notes,
    String? status,
    double? totalCost,
    double? paidAmount,
    String? paymentStatus,
    String? timestamp,
    List<dynamic>? items,
    List<dynamic>? payments,
    List<dynamic>? orderEntries,
  }) {
    return PurchaseOrderModel(
      id: id ?? this.id,
      vendorId: vendorId ?? this.vendorId,
      vendorName: vendorName ?? this.vendorName,
      contactPerson: contactPerson ?? this.contactPerson,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      notes: notes ?? this.notes,
      status: status ?? this.status,
      totalCost: totalCost ?? this.totalCost,
      paidAmount: paidAmount ?? this.paidAmount,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      timestamp: timestamp ?? this.timestamp,
      items: items ?? this.items,
      payments: payments ?? this.payments,
      orderEntries: orderEntries ?? this.orderEntries,
    );
  }
}
