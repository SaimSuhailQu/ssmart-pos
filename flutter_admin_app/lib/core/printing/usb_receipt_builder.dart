import 'package:ssmart_pos_admin/models/sale.dart';

/// Paper width for the USB thermal printer.
///
/// 58mm rolls print 32 columns at font A; 80mm rolls print 48.
/// Most cheap shop printers (XPrinter and clones) are 58mm — that is
/// the default. The width is a setting, not auto-detected: firmware
/// rarely reports it reliably over USB.
enum UsbPaperSize {
  mm58(32),
  mm80(48);

  const UsbPaperSize(this.columns);
  final int columns;
}

/// Pure-Dart ESC/POS receipt builder for USB OTG thermal printers.
///
/// No hardware, no side effects: the bytes this returns are handed to
/// the Android USB transport (`UsbPrinterChannel`) unchanged. The
/// command set mirrors the desktop builder
/// (`src/main/printing/escposBuilder.ts`) so a bill printed from the
/// phone looks like a bill printed from the laptop: same commands,
/// same layout, same CODE128 barcode.
///
/// Text is ASCII-folded like the desktop builder — most thermal
/// firmware mangles non-Latin glyphs, so Urdu script and emoji print
/// as `?` instead of garbage bytes. Amounts follow the phone receipt
/// preview: whole rupees, `PKR` prefix.
class UsbReceiptBuilder {
  static const int _esc = 0x1B;
  static const int _gs = 0x1D;

  static List<int> _cmd(List<int> bytes) => bytes;

  static List<int> _init() => _cmd([_esc, 0x40]);
  static List<int> _alignCenter() => _cmd([_esc, 0x61, 0x01]);
  static List<int> _alignLeft() => _cmd([_esc, 0x61, 0x00]);
  static List<int> _boldOn() => _cmd([_esc, 0x45, 0x01]);
  static List<int> _boldOff() => _cmd([_esc, 0x45, 0x00]);
  static List<int> _doubleSizeOn() => _cmd([_gs, 0x21, 0x11]);
  static List<int> _doubleSizeOff() => _cmd([_gs, 0x21, 0x00]);
  static List<int> _feed([int n = 3]) => _cmd([_esc, 0x64, n]);
  static List<int> _cut() => _cmd([_gs, 0x56, 0x01]);

  /// Fold to printable ASCII: strip combining marks, map a few common
  /// punctuation marks, and replace anything else outside 0x20–0x7E
  /// with `?`. Never emits a byte above 0x7E in text, so firmware
  /// code-page differences cannot corrupt the receipt.
  static String foldAscii(String input) {
    final out = StringBuffer();
    for (final rune in input.runes) {
      if (rune >= 0x0300 && rune <= 0x036F) continue; // combining mark
      if (rune == 0x2013 || rune == 0x2014 || rune == 0x2010 || rune == 0x2011) {
        out.write('-'); // en/em dashes
      } else if (rune == 0x2018 || rune == 0x2019) {
        out.write("'"); // single quotes
      } else if (rune == 0x201C || rune == 0x201D) {
        out.write('"'); // double quotes
      } else if (rune == 0x2022) {
        out.write('*'); // bullet
      } else if (rune == 0x00A0) {
        out.write(' '); // non-breaking space
      } else if (rune >= 0x20 && rune <= 0x7E) {
        out.writeCharCode(rune);
      } else {
        out.write('?');
      }
    }
    return out.toString();
  }

  static String money(double amount) => 'PKR ${amount.toStringAsFixed(0)}';

  /// Format an ISO-8601 timestamp the way the phone receipt preview
  /// shows it (`24 Nov 2026  2:06 PM`). Falls back to the raw string
  /// (first 16 chars) when it cannot be parsed — never guesses.
  static String formatTimestamp(String timestamp) {
    final parsed = DateTime.tryParse(timestamp);
    if (parsed == null) {
      return timestamp.length >= 16 ? timestamp.substring(0, 16) : timestamp;
    }
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final hour12 = parsed.hour % 12 == 0 ? 12 : parsed.hour % 12;
    final amPm = parsed.hour < 12 ? 'AM' : 'PM';
    final minute = parsed.minute.toString().padLeft(2, '0');
    return '${parsed.day} ${months[parsed.month - 1]} ${parsed.year}  '
        '$hour12:$minute $amPm';
  }

  /// CODE128 barcode, same parameters as the desktop builder:
  /// height 80, width 2, function 73. Caller centers first.
  static List<int> _barcode(String data) {
    final bytes = foldAscii(data).codeUnits;
    return [
      _gs, 0x68, 80, // height
      _gs, 0x77, 2, // width
      _gs, 0x6B, 73, bytes.length,
      ...bytes,
    ];
  }

  /// Build the full receipt for [sale] at [paperSize].
  static List<int> buildSaleReceipt(
    Sale sale, {
    UsbPaperSize paperSize = UsbPaperSize.mm58,
    String storeName = 'SS MART',
    String storeAddress1 = 'Old Lakar Mandi',
    String storeAddress2 = 'Opposite Railway Station, Havelian',
    String storePhone = '0316-5915787',
  }) {
    final width = paperSize.columns;
    final out = <int>[];

    void text(String s) {
      out.addAll(foldAscii(s).codeUnits);
      out.add(0x0A);
    }

    void divider([String char = '-']) => text(char * width);

    /// Two-column row padded to [width]. If the columns do not fit,
    /// they are joined with a single space and the printer wraps —
    /// same behaviour as the desktop builder.
    void row(String left, String right) {
      final l = foldAscii(left);
      final r = foldAscii(right);
      final spaces = width - l.length - r.length;
      text(l + ' ' * (spaces < 1 ? 1 : spaces) + r);
    }

    out.addAll(_init());
    out.addAll(_alignCenter());
    out.addAll(_doubleSizeOn());
    text(storeName.toUpperCase());
    out.addAll(_doubleSizeOff());
    text(storeAddress1);
    text(storeAddress2);
    text('Ph: $storePhone');
    divider();

    out.addAll(_alignLeft());
    text('Bill #${sale.id}');
    text(formatTimestamp(sale.timestamp));
    if (sale.userName != null && sale.userName!.isNotEmpty) {
      text('Cashier: ${sale.userName}');
    }
    if (sale.customerName != null && sale.customerName!.isNotEmpty) {
      text('Customer: ${sale.customerName}');
    }
    divider();

    final items = sale.items ?? const <SaleItem>[];
    for (final item in items) {
      final name = foldAscii(item.productName).toUpperCase();
      out.addAll(_boldOn());
      text(name.length > width ? name.substring(0, width) : name);
      out.addAll(_boldOff());
      row(
        '${item.quantity}x @ ${item.price.toStringAsFixed(0)}',
        money(item.total),
      );
    }
    divider();

    row('Subtotal:', money(sale.subtotal));
    if (sale.discount > 0) {
      row('Discount:', '-${money(sale.discount)}');
    }
    if (sale.tax > 0) {
      row('Tax:', money(sale.tax));
    }
    divider('=');
    out.addAll(_boldOn());
    out.addAll(_doubleSizeOn());
    out.addAll(_alignCenter());
    text('TOTAL: ${money(sale.total)}');
    out.addAll(_doubleSizeOff());
    out.addAll(_boldOff());
    out.addAll(_alignLeft());
    divider('=');

    row('Payment:', sale.paymentMethod);
    if (sale.amountTendered > 0) {
      row('Tendered:', money(sale.amountTendered));
      if (sale.changeGiven > 0) {
        row('Change:', money(sale.changeGiven));
      }
    }

    divider();
    out.addAll(_alignCenter());
    // Sale ids are epoch millis, so they are safe CODE128 data and
    // match the bill number above. Non-numeric ids get no barcode
    // rather than a barcode that scans as something else.
    if (RegExp(r'^\d+$').hasMatch(sale.id)) {
      out.addAll(_barcode('SSM${sale.id}'));
      text('');
    }
    text('THANKS FOR YOUR VISIT');
    text('Software Developed By: SSQ');
    out.addAll(_feed(4));
    out.addAll(_cut());
    return out;
  }

  /// Short test receipt: proves the cable, the permission grant and
  /// the paper width in one print, without touching any sale.
  static List<int> buildTestPrint({UsbPaperSize paperSize = UsbPaperSize.mm58}) {
    final width = paperSize.columns;
    final out = <int>[];

    void text(String s) {
      out.addAll(foldAscii(s).codeUnits);
      out.add(0x0A);
    }

    out.addAll(_init());
    out.addAll(_alignCenter());
    out.addAll(_doubleSizeOn());
    text('SS MART');
    out.addAll(_doubleSizeOff());
    text('USB TEST PRINT');
    text('-' * width);
    out.addAll(_alignLeft());
    text('Printer OK');
    text('Paper: ${paperSize == UsbPaperSize.mm58 ? '58mm (32 cols)' : '80mm (48 cols)'}');
    text('If this prints, USB OTG printing works.');
    out.addAll(_alignCenter());
    text('THANKS FOR YOUR VISIT');
    out.addAll(_feed(4));
    out.addAll(_cut());
    return out;
  }
}
