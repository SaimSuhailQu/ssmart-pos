import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/models/sale.dart';

Sale _sale(String timestamp) => Sale(
      id: '1',
      subtotal: 100,
      tax: 0,
      discount: 0,
      total: 100,
      paymentMethod: 'Cash',
      amountTendered: 100,
      changeGiven: 0,
      timestamp: timestamp,
    );

void main() {
  group('Sale.toJson ts field', () {
    test('Zulu ISO timestamp gives exact epoch millis', () {
      final json = _sale('2026-01-02T03:04:05.000Z').toJson();
      expect(
        json['ts'],
        DateTime.utc(2026, 1, 2, 3, 4, 5).millisecondsSinceEpoch,
      );
      // Original string timestamp is preserved alongside ts.
      expect(json['timestamp'], '2026-01-02T03:04:05.000Z');
    });

    test('local ISO timestamp gives a ts (device-local parse)', () {
      final json = _sale('2026-10-24T20:30:00.000').toJson();
      expect(
        json['ts'],
        DateTime.parse('2026-10-24T20:30:00.000').millisecondsSinceEpoch,
      );
    });

    test('unparseable timestamp omits ts instead of guessing', () {
      final json = _sale('not-a-date').toJson();
      expect(json.containsKey('ts'), isFalse);
      expect(json['timestamp'], 'not-a-date');
    });
  });
}
