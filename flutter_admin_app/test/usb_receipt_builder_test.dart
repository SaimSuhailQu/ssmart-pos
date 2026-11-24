import 'package:flutter_test/flutter_test.dart';
import 'package:ssmart_pos_admin/core/printing/printer_settings_store.dart';
import 'package:ssmart_pos_admin/core/printing/usb_printer_channel.dart';
import 'package:ssmart_pos_admin/core/printing/usb_receipt_builder.dart';
import 'package:ssmart_pos_admin/models/sale.dart';

Sale _sale({
  String id = '1764000000000',
  List<SaleItem>? items,
  double subtotal = 100,
  double total = 100,
  String paymentMethod = 'Cash',
  double tendered = 100,
  double change = 0,
}) {
  return Sale(
    id: id,
    subtotal: subtotal,
    tax: 0,
    discount: 0,
    total: total,
    paymentMethod: paymentMethod,
    amountTendered: tendered,
    changeGiven: change,
    timestamp: '2026-11-24T14:06:00.000',
    userName: 'Mobile Admin',
    items: items ??
        [
          SaleItem(
            productId: 1,
            productName: 'Test Item',
            quantity: 2,
            price: 50,
          ),
        ],
  );
}

bool _containsSequence(List<int> bytes, List<int> seq) {
  if (seq.isEmpty || bytes.length < seq.length) return false;
  for (var i = 0; i <= bytes.length - seq.length; i++) {
    var match = true;
    for (var j = 0; j < seq.length; j++) {
      if (bytes[i + j] != seq[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

List<String> _lines(List<int> bytes) =>
    String.fromCharCodes(bytes).split('\n');

void main() {
  group('UsbReceiptBuilder.buildSaleReceipt', () {
    test('starts with ESC @ and ends with feed + partial cut', () {
      final bytes = UsbReceiptBuilder.buildSaleReceipt(_sale());
      expect(bytes.sublist(0, 2), [0x1B, 0x40]);
      // Tail is feed(4) then partial cut: ESC d 4, GS V 0x01.
      expect(bytes.sublist(bytes.length - 6),
          [0x1B, 0x64, 4, 0x1D, 0x56, 0x01]);
    });

    test('58mm dividers are 32 dashes, 80mm dividers are 48', () {
      final narrow = _lines(UsbReceiptBuilder.buildSaleReceipt(
        _sale(),
        paperSize: UsbPaperSize.mm58,
      ));
      expect(narrow.any((l) => l == '-' * 32), isTrue);

      final wide = _lines(UsbReceiptBuilder.buildSaleReceipt(
        _sale(),
        paperSize: UsbPaperSize.mm80,
      ));
      expect(wide.any((l) => l == '-' * 48), isTrue);
    });

    test('totals rows pad exactly to the paper width', () {
      final lines = _lines(UsbReceiptBuilder.buildSaleReceipt(
        _sale(),
        paperSize: UsbPaperSize.mm58,
      ));
      final subtotal = lines.firstWhere((l) => l.startsWith('Subtotal:'));
      expect(subtotal.length, 32);
      expect(subtotal.endsWith('PKR 100'), isTrue);
    });

    test('contains store header, item, and double-size TOTAL', () {
      final bytes = UsbReceiptBuilder.buildSaleReceipt(_sale());
      final text = String.fromCharCodes(bytes);
      expect(text, contains('SS MART'));
      expect(text, contains('TEST ITEM'));
      expect(text, contains('TOTAL: PKR 100'));
      // GS ! 0x11 (double size) is emitted for the store name and TOTAL.
      expect(_containsSequence(bytes, [0x1D, 0x21, 0x11]), isTrue);
    });

    test('folds Urdu and emoji to ? and emits no byte above 0x7E', () {
      final bytes = UsbReceiptBuilder.buildSaleReceipt(_sale(items: [
        SaleItem(
          productId: 2,
          productName: 'چائے Special ☕',
          quantity: 1,
          price: 120,
        ),
      ]));
      expect(bytes.every((b) => b <= 0x7E), isTrue);
      final text = String.fromCharCodes(bytes);
      expect(text, contains('???? SPECIAL ?'));
      expect(text, isNot(contains('چائے')));
    });

    test('numeric sale id gets a CODE128 barcode, other ids do not', () {
      final numeric = UsbReceiptBuilder.buildSaleReceipt(_sale());
      expect(_containsSequence(numeric, [0x1D, 0x6B, 73]), isTrue);

      final other = UsbReceiptBuilder.buildSaleReceipt(_sale(id: 'WALK-IN'));
      expect(_containsSequence(other, [0x1D, 0x6B, 73]), isFalse);
    });

    test('empty items still build a valid receipt', () {
      final bytes = UsbReceiptBuilder.buildSaleReceipt(
        _sale(items: const [], subtotal: 0, total: 0, tendered: 0),
      );
      final text = String.fromCharCodes(bytes);
      expect(text, contains('TOTAL: PKR 0'));
      expect(bytes.sublist(bytes.length - 2), [0x56, 0x01]);
    });

    test('formatTimestamp falls back to the raw string', () {
      expect(UsbReceiptBuilder.formatTimestamp('2026-11-24T14:06:00.000'),
          '24 Nov 2026  2:06 PM');
      expect(UsbReceiptBuilder.formatTimestamp('not-a-date'),
          'not-a-date');
    });
  });

  group('UsbReceiptBuilder.buildTestPrint', () {
    test('contains TEST PRINT and ends with a cut', () {
      final bytes = UsbReceiptBuilder.buildTestPrint();
      final text = String.fromCharCodes(bytes);
      expect(text, contains('USB TEST PRINT'));
      expect(text, contains('Printer OK'));
      expect(bytes.sublist(bytes.length - 2), [0x56, 0x01]);
    });
  });

  group('PrinterSettingsStore', () {
    test('round-trips device, paper size, and auto-print', () async {
      final backing = <String, String>{};
      final store = PrinterSettingsStore(
        read: (key) async => backing[key],
        write: (key, value) async {
          backing[key] = value;
        },
        delete: (key) async {
          backing.remove(key);
        },
      );

      const device = UsbPrinterDevice(
        name: 'XPrinter XP-58',
        deviceName: '/dev/bus/usb/001/002',
        vendorId: 0x0416,
        productId: 0x5011,
      );
      await store.write(const PrinterSettings(
        device: device,
        paperSize: UsbPaperSize.mm80,
        autoPrint: true,
      ));

      final readBack = await store.read();
      expect(readBack.device?.vendorId, 0x0416);
      expect(readBack.device?.productId, 0x5011);
      expect(readBack.device?.name, 'XPrinter XP-58');
      expect(readBack.paperSize, UsbPaperSize.mm80);
      expect(readBack.autoPrint, isTrue);
    });

    test('corrupt stored value reads back as defaults', () async {
      final store = PrinterSettingsStore(
        read: (_) async => '{not json',
        write: (_, __) async {},
        delete: (_) async {},
      );
      final settings = await store.read();
      expect(settings.device, isNull);
      expect(settings.paperSize, UsbPaperSize.mm58);
      expect(settings.autoPrint, isFalse);
    });
  });
}
