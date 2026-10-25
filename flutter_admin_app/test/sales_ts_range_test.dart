import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/utils/sales_ts_range.dart';

void main() {
  group('tsRangeForLocalDay', () {
    test('covers exactly one local calendar day, end exclusive', () {
      final range = tsRangeForLocalDay(DateTime(2026, 10, 24, 15, 30));
      expect(
        range.startMs,
        DateTime(2026, 10, 24).millisecondsSinceEpoch,
      );
      expect(
        range.endMs,
        DateTime(2026, 10, 25).millisecondsSinceEpoch,
      );
      // startAt is inclusive, endBefore is exclusive.
      expect(range.containsMs(range.startMs), isTrue);
      expect(range.containsMs(range.endMs), isFalse);
      expect(range.containsMs(range.endMs - 1), isTrue);
    });

    test('adjacent days are contiguous: no sale can fall between', () {
      final a = tsRangeForLocalDay(DateTime(2026, 10, 24));
      final b = tsRangeForLocalDay(DateTime(2026, 10, 25));
      expect(a.endMs, b.startMs);
    });

    test('month boundary: Oct 31 day ends at Nov 1 midnight', () {
      final range = tsRangeForLocalDay(DateTime(2026, 10, 31));
      expect(
        range.endMs,
        DateTime(2026, 11, 1).millisecondsSinceEpoch,
      );
    });
  });

  group('tsRangeForLocalMonth', () {
    test('October spans Oct 1 to Nov 1', () {
      final range = tsRangeForLocalMonth(DateTime(2026, 10, 15));
      expect(
        range.startMs,
        DateTime(2026, 10, 1).millisecondsSinceEpoch,
      );
      expect(
        range.endMs,
        DateTime(2026, 11, 1).millisecondsSinceEpoch,
      );
    });

    test('December rolls into next year', () {
      final range = tsRangeForLocalMonth(DateTime(2026, 12, 5));
      expect(
        range.startMs,
        DateTime(2026, 12, 1).millisecondsSinceEpoch,
      );
      expect(
        range.endMs,
        DateTime(2027, 1, 1).millisecondsSinceEpoch,
      );
    });
  });

  group('tsRangeForPastCalendarDays', () {
    test('7-day window at 3pm covers midnight 7 days ago to end of today',
        () {
      final range = tsRangeForPastCalendarDays(
        7,
        now: DateTime(2026, 10, 25, 15, 0),
      );
      expect(
        range.startMs,
        DateTime(2026, 10, 18).millisecondsSinceEpoch,
      );
      expect(
        range.endMs,
        DateTime(2026, 10, 26).millisecondsSinceEpoch,
      );
    });
  });

  group('recentWindowStartMs', () {
    test('30-day rolling lower bound', () {
      final now = DateTime(2026, 10, 25, 12, 0);
      expect(
        recentWindowStartMs(days: 30, now: now),
        now.subtract(const Duration(days: 30)).millisecondsSinceEpoch,
      );
    });
  });
}
