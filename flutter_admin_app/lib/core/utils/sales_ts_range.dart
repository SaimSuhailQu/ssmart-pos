/// Server-side date windows for sales, keyed on the `ts` epoch-millis
/// field (added to new sales in v2.6.3).
///
/// WHY THIS FILE EXISTS, AND THE RULE THAT GOVERNS IT:
///
/// `orderByChild('ts')` can only see sales that HAVE a `ts` value. Every
/// sale written before v2.6.3 — and every sale written since by a device
/// still on an older build — has no `ts` and is INVISIBLE to a ts query.
/// A ts-scoped view used unconditionally would silently drop those sales.
/// That is why every ts-scoped stream in FirebaseService is gated behind
/// SalesTsConfig.backfillComplete, which must stay false until BOTH:
///   1. scripts/backfill-sale-ts.mjs --apply has run against the live
///      database and reported zero unparseable sales (or the stragglers
///      were fixed by hand), AND
///   2. every shop device runs v2.6.3 or later, so new writes carry `ts`.
/// Flipping it on backfill alone is NOT enough: an old phone app writing
/// a sale today produces a sale with no `ts`, and the scoped views and
/// the recent-window cache would both miss it.
///
/// All windows here are LOCAL-calendar bounded (device local midnight),
/// matching what the shop sees as "today" / "this week" / "this month".
/// RTDB bounds are [start, end): startAt(startMs) + endBefore(endMs), so
/// a sale stamped exactly at a window's start is included and one stamped
/// exactly at its end belongs to the next window. Day windows are
/// contiguous: the end of one day IS the start of the next, so no sale
/// can fall between two windows.
///
/// One deliberate semantic change, documented here so it is not mistaken
/// for a bug: the old transactions "This Week" filter was a rolling
/// 168 hours (now minus 7 days, time-of-day included). The scoped week
/// window is calendar-aligned — local midnight 7 days ago through end of
/// today — because a live ts query cannot have a moving `now` end bound.
/// The dashboard's 7-day chart was already calendar-aligned, so this
/// makes the two views agree.
///
/// This file is pure (no Firebase imports) so its boundary logic is
/// unit-testable without mocks; see test/sales_ts_range_test.dart.

/// A half-open [startMs, endMs) window in epoch millis. `containsMs`
/// mirrors exactly what startAt + endBefore select server-side.
class TsRange {
  const TsRange({required this.startMs, required this.endMs});

  /// Inclusive lower bound.
  final int startMs;

  /// Exclusive upper bound.
  final int endMs;

  bool containsMs(int tsMs) => tsMs >= startMs && tsMs < endMs;
}

/// The local calendar day containing [day]: local midnight to the next
/// local midnight.
TsRange tsRangeForLocalDay(DateTime day) {
  final start = DateTime(day.year, day.month, day.day);
  final end = DateTime(day.year, day.month, day.day + 1);
  return TsRange(
    startMs: start.millisecondsSinceEpoch,
    endMs: end.millisecondsSinceEpoch,
  );
}

/// A window from [start] to [end], used as-is. Callers pass
/// local-midnight bounds (see getSalesInRangeStream); exact instants
/// are also expressible, but a live query's end bound does not move,
/// so end-of-day bounds are what keep a stream valid all day.
TsRange tsRangeForLocalRange(DateTime start, DateTime end) {
  return TsRange(
    startMs: start.millisecondsSinceEpoch,
    endMs: end.millisecondsSinceEpoch,
  );
}

/// The last [days] calendar days including today: local midnight [days]
/// days ago through end of today. Used by the dashboard (today +
/// yesterday + 7-day chart all live inside this window).
TsRange tsRangeForPastCalendarDays(int days, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final start = DateTime(n.year, n.month, n.day - days);
  final end = DateTime(n.year, n.month, n.day + 1);
  return TsRange(
    startMs: start.millisecondsSinceEpoch,
    endMs: end.millisecondsSinceEpoch,
  );
}

/// The local calendar month containing [month]: the 1st at midnight to
/// the 1st of the next month at midnight (December rolls into January).
TsRange tsRangeForLocalMonth(DateTime month) {
  final start = DateTime(month.year, month.month, 1);
  final end = month.month == 12
      ? DateTime(month.year + 1, 1, 1)
      : DateTime(month.year, month.month + 1, 1);
  return TsRange(
    startMs: start.millisecondsSinceEpoch,
    endMs: end.millisecondsSinceEpoch,
  );
}

/// Rolling lower bound for the offline-cache window: everything from
/// [days] ago onward. Lower bound only — deliberately NO end bound, so
/// sales stamped in the future (clock skew) are still cached. Computed
/// once per app launch; a session spanning weeks keeps its original
/// lower bound, which only ever widens the window — the safe direction.
int recentWindowStartMs({int days = 30, DateTime? now}) {
  final n = now ?? DateTime.now();
  return n.subtract(Duration(days: days)).millisecondsSinceEpoch;
}
