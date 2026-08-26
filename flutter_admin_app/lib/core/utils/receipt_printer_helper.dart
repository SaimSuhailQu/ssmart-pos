import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/models/sale.dart';

/// Helper utility for generating and displaying formatted thermal receipts
class ReceiptPrinterHelper {
  /// Generate 58mm / 80mm ESC-POS style text representation of a sale
  static String generateTextReceipt({
    required Sale sale,
    String storeName = 'SS MART & GENERAL STORE',
    String storeAddress = 'Main Commercial Area, Lahore',
    String storePhone = '+92 300 1234567',
  }) {
    final buffer = StringBuffer();
    final width = 38; // 58mm standard character width

    String center(String text) {
      if (text.length >= width) return text;
      final pad = (width - text.length) ~/ 2;
      return '${' ' * pad}$text';
    }

    String line() => '━' * width;
    String dashedLine() => '-' * width;

    String formatRow(String col1, String col2) {
      final available = width - col1.length - col2.length;
      if (available < 1) return '$col1 $col2';
      return '$col1${' ' * available}$col2';
    }

    buffer.writeln(center(storeName));
    buffer.writeln(center(storeAddress));
    buffer.writeln(center('Tel: $storePhone'));
    buffer.writeln(line());
    buffer.writeln(formatRow('Receipt #: ${sale.id}', 'POS-1'));
    buffer.writeln(formatRow('Date: ${sale.timestamp.length >= 16 ? sale.timestamp.substring(0, 16) : sale.timestamp}', ''));
    if (sale.userName != null && sale.userName!.isNotEmpty) {
      buffer.writeln(formatRow('Cashier: ${sale.userName}', ''));
    }
    buffer.writeln(dashedLine());
    buffer.writeln(formatRow('ITEM', 'QTY  PRICE  TOTAL'));
    buffer.writeln(dashedLine());

    if (sale.items != null) {
      for (final item in sale.items!) {
        buffer.writeln(item.productName);
        final rightSide = '${item.quantity}x @ ${item.price.toStringAsFixed(0)}  PKR ${item.total.toStringAsFixed(0)}';
        buffer.writeln(formatRow('', rightSide));
      }
    }

    buffer.writeln(dashedLine());
    buffer.writeln(formatRow('Subtotal:', 'PKR ${sale.subtotal.toStringAsFixed(0)}'));
    if (sale.discount > 0) {
      buffer.writeln(formatRow('Discount:', '-PKR ${sale.discount.toStringAsFixed(0)}'));
    }
    if (sale.tax > 0) {
      buffer.writeln(formatRow('Tax:', 'PKR ${sale.tax.toStringAsFixed(0)}'));
    }
    buffer.writeln(line());
    buffer.writeln(formatRow('TOTAL BILL:', 'PKR ${sale.total.toStringAsFixed(0)}'));
    buffer.writeln(line());

    buffer.writeln(formatRow('Payment Method:', sale.paymentMethod));
    if (sale.amountTendered > 0) {
      buffer.writeln(formatRow('Amount Paid:', 'PKR ${sale.amountTendered.toStringAsFixed(0)}'));
      if (sale.changeGiven > 0) {
        buffer.writeln(formatRow('Change Returned:', 'PKR ${sale.changeGiven.toStringAsFixed(0)}'));
      }
    }

    buffer.writeln(dashedLine());
    buffer.writeln(center('Thank you for shopping at SS Mart!'));
    buffer.writeln(center('Goods once sold are returnable within 3 days'));
    buffer.writeln(center('*** SSmart POS System ***'));

    return buffer.toString();
  }

  /// Show interactive Receipt Dialog with Visual Thermal View & Print/Share Actions
  static void showReceiptDialog(BuildContext context, {required Sale sale}) {
    final textReceipt = generateTextReceipt(sale: sale);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(ctx).size.height * 0.88,
        decoration: const BoxDecoration(
          color: AppTheme.surfaceDark,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Drag Indicator
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 8),
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(CupertinoIcons.printer_fill, color: AppTheme.primaryCyan, size: 24),
                      const SizedBox(width: 8),
                      Text('Receipt #${sale.id}', style: AppTheme.headlineMedium.copyWith(color: Colors.white)),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(CupertinoIcons.xmark_circle_fill, color: Colors.white60, size: 28),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),

            // Receipt Actions Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF25D366),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(CupertinoIcons.chat_bubble_2_fill, size: 18),
                      label: const Text('WhatsApp', style: TextStyle(fontWeight: FontWeight.bold)),
                      onPressed: () => _promptWhatsApp(ctx, sale),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryCyan,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(CupertinoIcons.doc_on_clipboard, size: 18),
                      label: const Text('Copy Bill', style: TextStyle(fontWeight: FontWeight.bold)),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: textReceipt));
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('Receipt text copied to clipboard!')),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Thermal Paper Preview Box
            Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Store Header
                      const Center(
                        child: Column(
                          children: [
                            Text(
                              'SS MART & GENERAL STORE',
                              style: TextStyle(color: Colors.black, fontWeight: FontWeight.w900, fontSize: 16),
                            ),
                            SizedBox(height: 2),
                            Text('Main Commercial Area, Lahore', style: TextStyle(color: Colors.black80, fontSize: 11)),
                            Text('Tel: +92 300 1234567', style: TextStyle(color: Colors.black80, fontSize: 11)),
                            SizedBox(height: 6),
                            Divider(color: Colors.black, thickness: 1.5),
                          ],
                        ),
                      ),

                      // Meta
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Bill #${sale.id}', style: const TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.bold)),
                          Text(AppDateUtils.formatDateTime(sale.timestamp), style: const TextStyle(color: Colors.black80, fontSize: 10)),
                        ],
                      ),
                      if (sale.userName != null)
                        Text('Cashier: ${sale.userName}', style: const TextStyle(color: Colors.black80, fontSize: 10)),
                      const Divider(color: Colors.black45, thickness: 0.8),

                      // Items list
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('ITEM', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 11)),
                          Text('QTY  PRICE  TOTAL', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 11)),
                        ],
                      ),
                      const Divider(color: Colors.black45, thickness: 0.8),

                      if (sale.items != null)
                        ...sale.items!.map((item) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.productName, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 12)),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('${item.quantity}x @ PKR ${item.price.toStringAsFixed(0)}', style: const TextStyle(color: Colors.black80, fontSize: 11)),
                                    Text('PKR ${item.total.toStringAsFixed(0)}', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 12)),
                                  ],
                                ),
                              ],
                            ),
                          );
                        }).toList(),

                      const Divider(color: Colors.black45, thickness: 0.8),

                      // Totals
                      _thermalRow('Subtotal:', 'PKR ${sale.subtotal.toStringAsFixed(0)}'),
                      if (sale.discount > 0)
                        _thermalRow('Discount:', '-PKR ${sale.discount.toStringAsFixed(0)}', isGreen: true),
                      if (sale.tax > 0)
                        _thermalRow('Tax:', 'PKR ${sale.tax.toStringAsFixed(0)}'),

                      const Divider(color: Colors.black, thickness: 1.5),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('TOTAL BILL:', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w900, fontSize: 15)),
                          Text('PKR ${sale.total.toStringAsFixed(0)}', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w900, fontSize: 16)),
                        ],
                      ),
                      const Divider(color: Colors.black, thickness: 1.5),

                      _thermalRow('Payment:', sale.paymentMethod),
                      if (sale.amountTendered > 0)
                        _thermalRow('Tendered:', 'PKR ${sale.amountTendered.toStringAsFixed(0)}'),
                      if (sale.changeGiven > 0)
                        _thermalRow('Change:', 'PKR ${sale.changeGiven.toStringAsFixed(0)}'),

                      const SizedBox(height: 16),
                      const Center(
                        child: Column(
                          children: [
                            Text('Thank you for shopping with us!', style: TextStyle(color: Colors.black, fontSize: 11, fontStyle: FontStyle.italic)),
                            SizedBox(height: 2),
                            Text('*** SSmart POS Mobile System ***', style: TextStyle(color: Colors.black54, fontSize: 10)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _thermalRow(String label, String value, {bool isGreen = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black80, fontSize: 11)),
          Text(value, style: TextStyle(color: isGreen ? Colors.green.shade800 : Colors.black, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  static void _promptWhatsApp(BuildContext context, Sale sale) {
    final phoneCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Send Digital Receipt via WhatsApp'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter customer WhatsApp mobile number (e.g. 03001234567):',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              autofocus: true,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Phone Number',
                prefixIcon: Icon(CupertinoIcons.phone),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
            icon: const Icon(CupertinoIcons.chat_bubble_2_fill, color: Colors.white, size: 16),
            label: const Text('Send Receipt', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            onPressed: () async {
              final phone = phoneCtrl.text.trim();
              if (phone.isEmpty) return;

              Navigator.pop(ctx);
              final success = await WhatsAppHelper.sendSaleReceipt(sale: sale, phone: phone);
              if (!success) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Could not open WhatsApp')),
                );
              }
            },
          ),
        ],
      ),
    );
  }
}
