import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';

void main() {
  group('AppDateUtils.parseDateTime', () {
    test('ISO-8601 and SQLite space format', () {
      final iso = AppDateUtils.parseDateTime('2026-10-24T15:30:00.000');
      expect(iso, isNotNull);
      expect(iso!.year, 2026);
      expect(iso.month, 10);
      expect(iso.day, 24);

      final sqlite =
          AppDateUtils.parseDateTime('2026-10-24 15:30:00');
      expect(sqlite, isNotNull);
      expect(sqlite!.day, 24);
    });

    test('epoch ints and numeric strings', () {
      final ms = AppDateUtils.parseDateTime(1729765432000);
      expect(ms, isNotNull);
      final sec = AppDateUtils.parseDateTime(1729765432);
      expect(sec, isNotNull);
      expect(sec!.millisecondsSinceEpoch, 1729765432000);
      final str = AppDateUtils.parseDateTime('1729765432000');
      expect(str, isNotNull);
    });

    test('invalid input gives null, repeated parses agree (cache)', () {
      expect(AppDateUtils.parseDateTime(null), isNull);
      expect(AppDateUtils.parseDateTime(''), isNull);
      expect(AppDateUtils.parseDateTime('not-a-date'), isNull);
      final a = AppDateUtils.parseDateTime('2026-01-02T03:04:05.000');
      final b = AppDateUtils.parseDateTime('2026-01-02T03:04:05.000');
      expect(a, b);
    });
  });
}
