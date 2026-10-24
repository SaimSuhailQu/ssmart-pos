/// Pure purchase-order helpers, shared by the vendor flows. Moved verbatim
/// out of FirebaseService so they are unit-testable without Firebase.

/// Parse a Firebase numeric-ish value to double (num or numeric String).
double poNum(dynamic v) {
  if (v is num) return v.toDouble();
  if (v != null) return double.tryParse(v.toString()) ?? 0.0;
  return 0.0;
}

/// Normalize a Firebase list-or-map node into a growable List.
List<dynamic> poList(dynamic v) {
  final out = <dynamic>[];
  if (v is List) {
    out.addAll(v);
  } else if (v is Map) {
    v.forEach((_, item) {
      if (item != null) out.add(item);
    });
  }
  return out;
}

/// Standard vendor payment status from billed vs paid totals.
String poPaymentStatus(double totalCost, double paidAmount) {
  if (totalCost > 0 && paidAmount >= totalCost) return 'Paid';
  if (paidAmount > 0) return 'Partially Paid';
  return 'Unpaid';
}
