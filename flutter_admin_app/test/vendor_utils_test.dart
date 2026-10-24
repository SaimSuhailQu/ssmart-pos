import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/utils/vendor_utils.dart';

void main() {
  group('poNum', () {
    test('nums, numeric strings, null and garbage', () {
      expect(poNum(42), 42.0);
      expect(poNum(42.5), 42.5);
      expect(poNum('42.5'), 42.5);
      expect(poNum(null), 0.0);
      expect(poNum('abc'), 0.0);
    });
  });

  group('poList', () {
    test('list passthrough, map values, null', () {
      expect(poList([1, 2]), [1, 2]);
      expect(poList({'a': 1, 'b': 2}), [1, 2]);
      expect(poList(null), isEmpty);
      expect(poList({'a': null, 'b': 5}), [5]);
    });
  });

  group('poPaymentStatus', () {
    test('Paid / Partially Paid / Unpaid', () {
      expect(poPaymentStatus(1000, 1000), 'Paid');
      expect(poPaymentStatus(1000, 1500), 'Paid');
      expect(poPaymentStatus(1000, 400), 'Partially Paid');
      expect(poPaymentStatus(1000, 0), 'Unpaid');
      expect(poPaymentStatus(0, 0), 'Unpaid');
      expect(poPaymentStatus(0, 500), 'Partially Paid');
    });
  });
}
