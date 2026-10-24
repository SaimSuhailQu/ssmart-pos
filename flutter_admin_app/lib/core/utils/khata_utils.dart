/// Pure khata-ledger math, shared by every site that derives a customer
/// balance from entries. There used to be three copies of this loop (the
/// balance cache, the post-write recompute, and ad-hoc callers); they drifted
/// once already, so this is now the single implementation.
///
/// Ledger semantics: a LOAN entry adds to what the customer owes; any other
/// type (PAYMENT) subtracts. Unknown/missing types default to LOAN, matching
/// the historical behavior. Amounts may be nums or numeric strings.
///
/// This returns the RAW sum (negative = customer overpaid / shop owes them).
/// Display clamping (negative shown as 0 for the shop-wide udhaar total) is
/// a presentation rule applied by callers, not part of the math.
double khataBalanceFromEntries(dynamic entries) {
  double balance = 0.0;

  void processEntry(Map e) {
    final eType = e['type']?.toString().toUpperCase() ?? 'LOAN';
    final double eAmt = (e['amount'] is num)
        ? (e['amount'] as num).toDouble()
        : (double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0);
    balance += (eType == 'LOAN' ? eAmt : -eAmt);
  }

  if (entries is Map) {
    entries.forEach((_, e) {
      if (e is Map) processEntry(e);
    });
  } else if (entries is List) {
    for (final e in entries) {
      if (e is Map) processEntry(Map<dynamic, dynamic>.from(e));
    }
  }
  return balance;
}
