import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/commands/command_parser.dart';

void main() {
  final parser = CommandParser();
  const customers = [
    NameEntry('c1', 'Jamshad Mamu'),
    NameEntry('c2', 'Zia ur Rehman'),
    NameEntry('c3', 'Ahmed Khan'),
  ];
  const vendors = [
    NameEntry('v1', 'Walls Merchant'),
    NameEntry('v2', 'Nestle Distributor'),
  ];

  test('loan with full name', () {
    final p = parser.parse('jamshad mamu loan 700', customers: customers);
    expect(p.action, CommandAction.khataLoan);
    expect(p.entityName, 'Jamshad Mamu');
    expect(p.amount, 700);
    expect(p.confident, true);
  });

  test('loan keyword after amount-less name, roman urdu', () {
    final p = parser.parse('zia ur rehman udhaar 1500', customers: customers);
    expect(p.action, CommandAction.khataLoan);
    expect(p.entityName, 'Zia ur Rehman');
    expect(p.amount, 1500);
  });

  test('wasool prefix order', () {
    final p = parser.parse('wasool jamshad mamu 700', customers: customers);
    expect(p.action, CommandAction.khataWasool);
    expect(p.entityName, 'Jamshad Mamu');
    expect(p.amount, 700);
  });

  test('wasool suffix order', () {
    final p = parser.parse('ahmed khan wasool 2000', customers: customers);
    expect(p.action, CommandAction.khataWasool);
    expect(p.entityName, 'Ahmed Khan');
  });

  test('fuzzy partial name', () {
    final p = parser.parse('jamshad loan 500', customers: customers);
    expect(p.entityName, 'Jamshad Mamu');
    expect(p.confident, true);
  });

  test('vendor order', () {
    final p = parser.parse('walls merchant order 7000', vendors: vendors);
    expect(p.action, CommandAction.vendorOrder);
    expect(p.entityName, 'Walls Merchant');
    expect(p.amount, 7000);
  });

  test('expense with label', () {
    final p = parser.parse('electricity bill kharcha 2500');
    expect(p.action, CommandAction.expense);
    expect(p.amount, 2500);
    expect(p.confident, true);
  });

  test('amount with comma', () {
    final p = parser.parse('nestle distributor order 12,500', vendors: vendors);
    expect(p.amount, 12500);
  });

  test('unknown person', () {
    final p = parser.parse('some stranger loan 100', customers: customers);
    expect(p.confident, false);
    expect(p.action, CommandAction.unknown);
  });

  test('missing amount', () {
    final p = parser.parse('jamshad mamu loan', customers: customers);
    expect(p.confident, false);
  });

  test('unknown action', () {
    final p = parser.parse('jamshad mamu 700', customers: customers);
    expect(p.action, CommandAction.unknown);
  });
}
