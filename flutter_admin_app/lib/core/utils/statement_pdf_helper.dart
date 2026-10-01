import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';

/// Professional PDF statement builder for customer khata ledgers and vendor
/// accounts, with one-tap WhatsApp sharing.
///
/// The PDF is built in memory with the `pdf` package (pure Dart, no WebView),
/// saved to a temp file, and shared through the system share sheet (WhatsApp,
/// Email, Files, etc.).
class StatementPdfHelper {
  static const String _storeName = 'SS MART & GENERAL STORE';

  /// Build and share a customer khata ledger statement.
  static Future<void> shareCustomerKhata({
    required String customerName,
    required String phone,
    required double balance,
    required List<Map<String, dynamic>> entries,
  }) async {
    final doc = pw.Document();

    // Newest-first presentation, chronological running balance.
    final chrono = _normalizeEntries(entries);

    double running = 0;
    final rows = <List<String>>[];
    for (final e in chrono) {
      final isLoan = e.type == 'LOAN';
      running += isLoan ? e.amount : -e.amount;
      rows.add([
        e.dateLabel,
        isLoan ? 'Udhaar (Loan)' : 'Wasool (Payment)',
        e.notes.isEmpty ? '-' : e.notes,
        isLoan ? e.amountText : '',
        isLoan ? '' : e.amountText,
        running.toStringAsFixed(0),
      ]);
    }

    final (balanceLabel, balanceColor) = balance > 0
        ? ('TOTAL UDHAAR (DUE)', PdfColor.fromHex('#B45309'))
        : ('ACCOUNT BALANCE', PdfColor.fromHex('#047857'));

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(36, 42, 36, 48),
        header: (ctx) => _buildHeader('CUSTOMER KHATA STATEMENT'),
        footer: (ctx) => _buildFooter(ctx),
        build: (ctx) => [
          _customerBlock(
            name: customerName,
            phone: phone.isEmpty ? '—' : phone,
          ),
          pw.SizedBox(height: 14),
          _balanceBanner(
            label: balanceLabel,
            amount: 'PKR ${balance.toStringAsFixed(0)}',
            bgColor: balanceColor,
            textColor: PdfColors.white,
          ),
          pw.SizedBox(height: 16),
          _entriesTable(
            headers: ['Date', 'Type', 'Notes', 'Udhaar', 'Wasool', 'Balance'],
            rows: rows,
            columnWidths: {
              0: const pw.FlexColumnWidth(2.2),
              1: const pw.FlexColumnWidth(2.4),
              2: const pw.FlexColumnWidth(3.4),
              3: const pw.FlexColumnWidth(1.8),
              4: const pw.FlexColumnWidth(1.8),
              5: const pw.FlexColumnWidth(1.9),
            },
            alignRightFrom: 3,
          ),
          pw.SizedBox(height: 14),
          _summaryStrip([
            ('Total Udhaar', _sumOf(chrono, isLoan: true)),
            ('Total Wasool', _sumOf(chrono, isLoan: false)),
          ]),
        ],
      ),
    );

    await _saveAndShare(
      doc: doc,
      fileName:
          'Khata_Statement_${customerName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')}_'
          '${DateTime.now().millisecondsSinceEpoch ~/ 1000}.pdf',
      subject: 'Khata Statement — $customerName',
      body: 'Assalam-o-Alaikum $customerName,\n\n'
          'Please find your khata statement attached from $_storeName.\n'
          'Current balance: PKR ${balance.toStringAsFixed(0)}\n\n'
          'Shukriya!',
    );
  }

  /// Build and share a vendor purchase-order account statement.
  static Future<void> shareVendorStatement({
    required String vendorName,
    required String phone,
    required int poNumber,
    required String poStatus,
    required double totalBilled,
    required double totalPaid,
    required double balanceDue,
    required List<Map<String, String>> items,
    required List<Map<String, String>> payments,
  }) async {
    final doc = pw.Document();

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.fromLTRB(36, 42, 36, 48),
        header: (ctx) => _buildHeader('VENDOR ACCOUNT STATEMENT'),
        footer: (ctx) => _buildFooter(ctx),
        build: (ctx) => [
          _customerBlock(
            name: vendorName,
            phone: phone.isEmpty ? '—' : phone,
          ),
          pw.SizedBox(height: 14),
          _balanceBanner(
            label: balanceDue > 0 ? 'BALANCE DUE TO VENDOR' : 'ACCOUNT CLEARED',
            amount: 'PKR ${balanceDue.toStringAsFixed(0)}',
            bgColor: balanceDue > 0
                ? PdfColor.fromHex('#B91C1C')
                : PdfColor.fromHex('#047857'),
            textColor: PdfColors.white,
          ),
          pw.SizedBox(height: 16),
          _detailGrid([
            ('PO Number', '#$poNumber'),
            ('PO Status', poStatus),
            ('Total Billed', 'PKR ${totalBilled.toStringAsFixed(0)}'),
            ('Total Paid', 'PKR ${totalPaid.toStringAsFixed(0)}'),
          ]),
          pw.SizedBox(height: 16),
          if (items.isNotEmpty) ...[
            _sectionTitle('Purchased Items'),
            pw.SizedBox(height: 6),
            _entriesTable(
              headers: ['Item', 'Qty', 'Unit Cost', 'Line Total'],
              rows: items
                  .map((i) => [i['name'] ?? '', i['qty'] ?? '', i['unitCost'] ?? '', i['total'] ?? ''])
                  .toList(),
              columnWidths: {
                0: const pw.FlexColumnWidth(4.5),
                1: const pw.FlexColumnWidth(1.5),
                2: const pw.FlexColumnWidth(2.2),
                3: const pw.FlexColumnWidth(2.2),
              },
              alignRightFrom: 1,
            ),
            pw.SizedBox(height: 16),
          ],
          if (payments.isNotEmpty) ...[
            _sectionTitle('Payment History'),
            pw.SizedBox(height: 6),
            _entriesTable(
              headers: ['Date', 'Method', 'Notes', 'Amount'],
              rows: payments
                  .map((p) => [p['date'] ?? '', p['method'] ?? '', p['notes'] ?? '', p['amount'] ?? ''])
                  .toList(),
              columnWidths: {
                0: const pw.FlexColumnWidth(2.4),
                1: const pw.FlexColumnWidth(2.2),
                2: const pw.FlexColumnWidth(4.0),
                3: const pw.FlexColumnWidth(2.2),
              },
              alignRightFrom: 3,
            ),
          ],
        ],
      ),
    );

    await _saveAndShare(
      doc: doc,
      fileName: 'Vendor_Statement_${vendorName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')}_'
          '${DateTime.now().millisecondsSinceEpoch ~/ 1000}.pdf',
      subject: 'Account Statement — $vendorName',
      body: 'Vendor account statement for $vendorName attached.\n'
          'Balance due: PKR ${balanceDue.toStringAsFixed(0)}\n\n'
          '— $_storeName',
    );
  }

  // ------------------------------------------------------------------ //
  //  Internal layout helpers
  // ------------------------------------------------------------------ //

  static pw.Widget _buildHeader(String title) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.end,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  _storeName.toUpperCase(),
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.Font.bold,
                    color: PdfColor.fromHex('#111827'),
                    letterSpacing: 1.2,
                  ),
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  title,
                  style: pw.TextStyle(
                    fontSize: 10,
                    color: PdfColor.fromHex('#6B7280'),
                    letterSpacing: 2.5,
                  ),
                ),
              ],
            ),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: pw.BoxDecoration(
                color: PdfColor.fromHex('#111827'),
                borderRadius: pw.BorderRadius.circular(4),
              ),
              child: pw.Text(
                'OFFICIAL STATEMENT',
                style: pw.TextStyle(
                  fontSize: 8,
                  fontWeight: pw.Font.bold,
                  color: PdfColors.white,
                  letterSpacing: 1.5,
                ),
              ),
            ),
          ],
        ),
        pw.SizedBox(height: 6),
        pw.Divider(color: PdfColor.fromHex('#111827'), thickness: 1.5),
        pw.SizedBox(height: 4),
      ],
    );
  }

  static pw.Widget _buildFooter(pw.Context ctx) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Divider(color: PdfColors.grey300),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'Generated via SSmart POS • ${_nowLabel()}',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
            pw.Text(
              'Page ${ctx.pageNumber} of ${ctx.pagesCount}',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
          ],
        ),
      ],
    );
  }

  static pw.Widget _customerBlock({
    required String name,
    required String phone,
  }) {
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Expanded(
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('PARTY',
                  style: pw.TextStyle(
                      fontSize: 8,
                      color: PdfColors.grey600,
                      letterSpacing: 1.5)),
              pw.SizedBox(height: 2),
              pw.Text(name,
                  style: pw.TextStyle(
                      fontSize: 18, fontWeight: pw.Font.bold)),
              pw.SizedBox(height: 2),
              pw.Text('Phone: $phone',
                  style: const pw.TextStyle(
                      fontSize: 10, color: PdfColors.grey700)),
            ],
          ),
        ),
        pw.Container(
          padding:
              const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: pw.BoxDecoration(
            color: PdfColor.fromHex('#EEF2FF'),
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Text(
            _nowLabel(),
            style: pw.TextStyle(
                fontSize: 10, fontWeight: pw.Font.bold,
                color: PdfColor.fromHex('#3730A3')),
          ),
        ),
      ],
    );
  }

  static pw.Widget _balanceBanner({
    required String label,
    required String amount,
    required PdfColor bgColor,
    required PdfColor textColor,
  }) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: pw.BoxDecoration(
        color: bgColor,
        borderRadius: pw.BorderRadius.circular(10),
      ),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(label,
                    style: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.Font.bold,
                        color: textColor,
                        letterSpacing: 1.5)),
                pw.SizedBox(height: 3),
                pw.Text(amount,
                    style: pw.TextStyle(
                        fontSize: 24,
                        fontWeight: pw.Font.bold,
                        color: textColor)),
              ]),
        ],
      ),
    );
  }

  static pw.Widget _entriesTable({
    required List<String> headers,
    required List<List<String>> rows,
    required Map<int, pw.FlexColumnWidth> columnWidths,
    int alignRightFrom = 0,
  }) {
    if (rows.isEmpty) {
      return pw.Container(
        padding: const pw.EdgeInsets.all(14),
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: PdfColors.grey300),
          borderRadius: pw.BorderRadius.circular(8),
        ),
        child: pw.Text('No entries recorded.',
            style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
      );
    }

    pw.TextAlign align(int col) =>
        col >= alignRightFrom ? pw.TextAlign.right : pw.TextAlign.left;

    return pw.TableHelper.fromTextArray(
      headers: headers,
      data: rows,
      border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
      headerDecoration: pw.BoxDecoration(color: PdfColor.fromHex('#111827')),
      headerStyle: pw.TextStyle(
        fontSize: 9,
        fontWeight: pw.Font.bold,
        color: PdfColors.white,
      ),
      cellStyle: const pw.TextStyle(fontSize: 9.5),
      cellAlignment: pw.Alignment.centerLeft,
      cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      columnWidths: columnWidths,
      cellAlignments: {
        for (var i = 0; i < headers.length; i++) i: align(i),
      },
      oddRowDecoration: const pw.BoxDecoration(color: PdfColor.fromHex('#F9FAFB')),
    );
  }

  static pw.Widget _summaryStrip(List<(String, double)> items) {
    return pw.Row(
      children: [
        for (final (label, value) in items) ...[
          pw.Expanded(
            child: pw.Container(
              padding:
                  const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.grey300),
                borderRadius: pw.BorderRadius.circular(8),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(label.toUpperCase(),
                      style: pw.TextStyle(
                          fontSize: 7.5,
                          color: PdfColors.grey600,
                          letterSpacing: 1.2)),
                  pw.SizedBox(height: 2),
                  pw.Text('PKR ${value.toStringAsFixed(0)}',
                      style: pw.TextStyle(
                          fontSize: 13, fontWeight: pw.Font.bold)),
                ],
              ),
            ),
          ),
          pw.SizedBox(width: 8),
        ],
      ],
    );
  }

  static pw.Widget _detailGrid(List<(String, String)> pairs) {
    return pw.Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final (label, value) in pairs)
          pw.Container(
            width: (pw.PdfPageFormat.a4.width - 72) / 2 - 6,
            padding:
                const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.grey300),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(label.toUpperCase(),
                    style: pw.TextStyle(
                        fontSize: 7.5,
                        color: PdfColors.grey600,
                        letterSpacing: 1.2)),
                pw.SizedBox(height: 2),
                pw.Text(value,
                    style: pw.TextStyle(
                        fontSize: 13, fontWeight: pw.Font.bold)),
              ],
            ),
          ),
      ],
    );
  }

  static pw.Widget _sectionTitle(String title) {
    return pw.Text(title,
        style: pw.TextStyle(fontSize: 12, fontWeight: pw.Font.bold));
  }

  // ------------------------------------------------------------------ //
  //  Data normalization + persistence + sharing
  // ------------------------------------------------------------------ //

  static String _nowLabel() {
    final now = DateTime.now();
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${now.day} ${months[now.month - 1]} ${now.year}, '
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }

  static double _sumOf(List<_StatementEntry> entries, {required bool isLoan}) {
    return entries
        .where((e) => e.type == (isLoan ? 'LOAN' : 'PAYMENT'))
        .fold<double>(0, (s, e) => s + e.amount);
  }

  static List<_StatementEntry> _normalizeEntries(
      List<Map<String, dynamic>> entries) {
    final list = entries.map(_StatementEntry.fromMap).toList()
      ..sort((a, b) => a.dateTime.compareTo(b.dateTime));
    return list;
  }

  static Future<File> _saveToTemp(pw.Document doc, String fileName) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileName');
    await file.writeAsBytes(await doc.save());
    return file;
  }

  static Future<void> _saveAndShare({
    required pw.Document doc,
    required String fileName,
    required String subject,
    required String body,
  }) async {
    final file = await _saveToTemp(doc, fileName);
    // share_plus 10.x: subject param deprecated; keep the body text only.
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: body, title: subject),
    );
  }
}

/// Normalized ledger entry used by the PDF builder.
class _StatementEntry {
  final String type; // LOAN | PAYMENT
  final double amount;
  final String notes;
  final String timestamp;
  final String dateLabel;
  final DateTime dateTime;

  _StatementEntry({
    required this.type,
    required this.amount,
    required this.notes,
    required this.timestamp,
    required this.dateLabel,
    required this.dateTime,
  });

  String get amountText => amount.toStringAsFixed(0);

  factory _StatementEntry.fromMap(Map<String, dynamic> e) {
    final type = (e['type']?.toString().toUpperCase() ?? 'LOAN');
    final double amount = (e['amount'] is num)
        ? (e['amount'] as num).toDouble()
        : (double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0);
    final ts = e['timestamp']?.toString() ?? '';

    DateTime dt;
    try {
      dt = DateTime.parse(ts.replaceAll(' ', 'T'));
    } catch (_) {
      dt = DateTime.now();
    }

    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final label = '${dt.day} ${months[dt.month - 1]} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

    return _StatementEntry(
      type: type,
      amount: amount,
      notes: e['notes']?.toString() ?? '',
      timestamp: ts,
      dateLabel: label,
      dateTime: dt,
    );
  }
}
