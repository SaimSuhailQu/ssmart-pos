import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/utils/khata_utils.dart';

void main() {
  group('khataBalanceFromEntries', () {
    test('LOAN adds, PAYMENT subtracts (map shape)', () {
      final entries = {
        'k1': {'type': 'LOAN', 'amount': 1000},
        'k2': {'type': 'PAYMENT', 'amount': 400},
        'k3': {'type': 'LOAN', 'amount': 250},
      };
      expect(khataBalanceFromEntries(entries), 850.0);
    });

    test('list shape works the same', () {
      final entries = [
        {'type': 'LOAN', 'amount': 500},
        {'type': 'PAYMENT', 'amount': 200},
      ];
      expect(khataBalanceFromEntries(entries), 300.0);
    });

    test('string amounts and missing type default to LOAN', () {
      final entries = {
        'k1': {'amount': '1000'},
        'k2': {'type': 'payment', 'amount': '250.5'},
      };
      expect(khataBalanceFromEntries(entries), 749.5);
    });

    test('negative sum is preserved (no clamping in the helper)', () {
      final entries = {
        'k1': {'type': 'LOAN', 'amount': 100},
        'k2': {'type': 'PAYMENT', 'amount': 300},
      };
      expect(khataBalanceFromEntries(entries), -200.0);
    });

    test('empty, null and garbage inputs give zero', () {
      expect(khataBalanceFromEntries({}), 0.0);
      expect(khataBalanceFromEntries([]), 0.0);
      expect(khataBalanceFromEntries(null), 0.0);
      expect(khataBalanceFromEntries({'k1': 'not-a-map'}), 0.0);
      expect(khataBalanceFromEntries({'k1': {'type': 'LOAN'}}), 0.0);
    });
  });
}
