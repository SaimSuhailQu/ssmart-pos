class VendorModel {
  final int id;
  final String name;
  final String contact;
  final String category;

  VendorModel({
    required this.id,
    required this.name,
    required this.contact,
    required this.category,
  });

  factory VendorModel.fromJson(String id, Map<dynamic, dynamic> json) {
    return VendorModel(
      id: int.tryParse(id) ?? (json['id'] is int ? json['id'] : 0),
      name: json['name']?.toString() ?? 'Vendor',
      contact: json['contact']?.toString() ?? '',
      category: json['category']?.toString() ?? 'General',
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

  factory PurchaseOrderModel.fromJson(String id, Map<dynamic, dynamic> json) {
    return PurchaseOrderModel(
      id: int.tryParse(id) ?? (json['id'] is int ? json['id'] : 0),
      vendorId: json['vendor_id'] is int ? json['vendor_id'] : 0,
      vendorName: json['vendor_name']?.toString() ?? 'Vendor Account',
      contactPerson: json['contact_person']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      notes: json['notes']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Pending',
      totalCost: (json['total_cost'] is num) ? (json['total_cost'] as num).toDouble() : 0.0,
      paidAmount: (json['paid_amount'] is num) ? (json['paid_amount'] as num).toDouble() : 0.0,
      paymentStatus: json['payment_status']?.toString() ?? 'Unpaid',
      timestamp: json['timestamp']?.toString() ?? DateTime.now().toIso8601String(),
      items: (json['items'] is List) ? json['items'] as List : [],
      payments: (json['payments'] is List) ? json['payments'] as List : [],
      orderEntries: (json['order_entries'] is List) ? json['order_entries'] as List : [],
    );
  }
}
