import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

/// Full Vendor Purchase Order & Bill Details Sheet
class VendorPODetailsSheet extends StatelessWidget {
  final PurchaseOrderModel po;
  final VoidCallback onEdit;

  const VendorPODetailsSheet({
    super.key,
    required this.po,
    required this.onEdit,
  });

  void _showRecordPaymentDialog(BuildContext context) {
    final amountCtrl = TextEditingController(
      text: po.balanceDue > 0 ? po.balanceDue.toStringAsFixed(0) : '',
    );
    final noteCtrl = TextEditingController();
    String selectedMethod = 'Cash';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              top: 20,
              left: 20,
              right: 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Record Payment to Vendor',
                        style: AppTheme.headlineMedium.copyWith(color: AppTheme.primaryTeal),
                      ),
                      IconButton(
                        icon: const Icon(CupertinoIcons.xmark_circle, color: AppTheme.textSecondary),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Vendor: ${po.vendorName} (PO #${po.id})',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  Text(
                    'Current Balance Due: PKR ${po.balanceDue.toStringAsFixed(0)}',
                    style: TextStyle(
                      color: po.balanceDue > 0 ? Colors.redAccent : AppTheme.successGreen,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      labelText: 'Payment Amount (PKR)',
                      prefixIcon: const Icon(CupertinoIcons.money_dollar),
                      filled: true,
                      fillColor: AppTheme.cardBackground,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('Payment Method:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Cheque'].map((method) {
                      final isSelected = selectedMethod == method;
                      return ChoiceChip(
                        label: Text(method),
                        selected: isSelected,
                        selectedColor: AppTheme.primaryTeal.withOpacity(0.3),
                        backgroundColor: AppTheme.cardBackground,
                        labelStyle: TextStyle(
                          color: isSelected ? AppTheme.primaryTeal : Colors.white70,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                        onSelected: (val) {
                          if (val) setSheetState(() => selectedMethod = method);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: noteCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Payment Notes / Cheque # (Optional)',
                      prefixIcon: const Icon(CupertinoIcons.doc_text),
                      filled: true,
                      fillColor: AppTheme.cardBackground,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryTeal,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(CupertinoIcons.checkmark_seal_fill),
                      label: const Text('Save Payment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      onPressed: () async {
                        final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
                        if (amount <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please enter a valid payment amount')),
                          );
                          return;
                        }

                        Navigator.pop(ctx);
                        Navigator.pop(context); // Close details sheet

                        try {
                          await context.read<FirebaseService>().recordVendorPayment(
                            poId: po.id.toString(),
                            vendorId: po.vendorId,
                            amount: amount,
                            paymentMethod: selectedMethod,
                            notes: noteCtrl.text.trim().isNotEmpty ? noteCtrl.text.trim() : null,
                          );

                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Payment of PKR ${amount.toStringAsFixed(0)} recorded!'),
                              backgroundColor: AppTheme.successGreen,
                            ),
                          );
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Payment failed: $e'), backgroundColor: AppTheme.errorRed),
                          );
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isCleared = po.balanceDue <= 0;

    DateTime parsedTime;
    try {
      parsedTime = DateTime.parse(po.timestamp);
    } catch (_) {
      parsedTime = DateTime.now();
    }

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
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
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: Colors.purple.withOpacity(0.2),
                  child: const Icon(CupertinoIcons.cube_box_fill, color: Colors.purpleAccent, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        po.vendorName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (po.contactPerson.isNotEmpty && po.contactPerson != po.vendorName) ...[
                            const Icon(CupertinoIcons.person, size: 13, color: AppTheme.textSecondary),
                            const SizedBox(width: 4),
                            Text(po.contactPerson, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                            const SizedBox(width: 10),
                          ],
                          if (po.phone.isNotEmpty) ...[
                            const Icon(CupertinoIcons.phone, size: 13, color: AppTheme.textSecondary),
                            const SizedBox(width: 4),
                            Text(po.phone, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(CupertinoIcons.xmark_circle_fill, color: Colors.white60, size: 28),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Payment & Status Overview Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isCleared
                      ? [Colors.green.shade900.withOpacity(0.4), Colors.green.shade700.withOpacity(0.2)]
                      : [Colors.red.shade900.withOpacity(0.4), Colors.red.shade700.withOpacity(0.2)],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isCleared ? Colors.green.withOpacity(0.4) : Colors.red.withOpacity(0.4),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isCleared ? 'ACCOUNT STATUS: CLEARED' : 'PENDING BALANCE DUE',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.1,
                              color: isCleared ? Colors.green.shade200 : Colors.red.shade200,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'PKR ${po.balanceDue.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              color: isCleared ? AppTheme.successGreen : Colors.redAccent,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          if (po.phone.isNotEmpty)
                            IconButton.filled(
                              style: IconButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                              icon: const Icon(CupertinoIcons.chat_bubble_2_fill, color: Colors.white, size: 20),
                              tooltip: 'Send PO via WhatsApp',
                              onPressed: () => WhatsAppHelper.sendVendorPO(po: po),
                            ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            style: IconButton.styleFrom(backgroundColor: AppTheme.primaryTeal),
                            icon: const Icon(CupertinoIcons.money_dollar, color: Colors.black, size: 20),
                            tooltip: 'Record Payment',
                            onPressed: () => _showRecordPaymentDialog(context),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(height: 1, color: Colors.white12),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _StatItem(label: 'Total Billed', value: 'PKR ${po.totalCost.toStringAsFixed(0)}', color: Colors.white),
                      _StatItem(label: 'Total Paid', value: 'PKR ${po.paidAmount.toStringAsFixed(0)}', color: AppTheme.successGreen),
                      _StatItem(label: 'Status', value: po.status, color: po.isReceived ? AppTheme.successGreen : Colors.orangeAccent),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Quick Action Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: po.isReceived ? Colors.orangeAccent : AppTheme.successGreen,
                      side: BorderSide(
                        color: po.isReceived ? Colors.orangeAccent.withOpacity(0.5) : AppTheme.successGreen.withOpacity(0.5),
                      ),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: Icon(po.isReceived ? CupertinoIcons.arrow_counterclockwise : CupertinoIcons.check_mark, size: 16),
                    label: Text(
                      po.isReceived ? 'Mark as Pending' : 'Mark as Received',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    onPressed: () async {
                      final newStatus = po.isReceived ? 'Pending' : 'Received';
                      await context.read<FirebaseService>().updatePurchaseOrderStatus(po.id.toString(), newStatus);
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('PO #${po.id} marked as $newStatus')),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple.shade700,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(CupertinoIcons.pencil, size: 16),
                    label: const Text('Edit PO', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      Navigator.pop(context);
                      onEdit();
                    },
                  ),
                ),
              ],
            ),
          ),

          // Details List (Items / Order History / Payments / Notes)
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              children: [
                // Order Info Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.cardBackground,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Purchase Order Details',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      _DetailRow(label: 'PO ID', value: '#${po.id}'),
                      _DetailRow(label: 'Date & Time', value: AppDateUtils.formatDateTime(parsedTime)),
                      _DetailRow(label: 'Order Status', value: po.status),
                      _DetailRow(label: 'Payment Status', value: po.paymentStatus),
                      if (po.email.isNotEmpty) _DetailRow(label: 'Email', value: po.email),
                      if (po.notes.isNotEmpty) _DetailRow(label: 'Notes', value: po.notes),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Order Items (if any)
                if (po.items.isNotEmpty) ...[
                  const Text(
                    'Purchased Items',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  ...po.items.map((item) {
                    final String name = item['product_name']?.toString() ?? item['name']?.toString() ?? 'Item';
                    final int qty = (item['qty'] is num) ? (item['qty'] as num).toInt() : (int.tryParse(item['qty']?.toString() ?? '') ?? 1);
                    final double cost = (item['cost_price'] is num) ? (item['cost_price'] as num).toDouble() : (double.tryParse(item['cost_price']?.toString() ?? '') ?? 0.0);
                    final double total = qty * cost;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                              Text('$qty units @ PKR ${cost.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                            ],
                          ),
                          Text('PKR ${total.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    );
                  }).toList(),
                  const SizedBox(height: 12),
                ],

                // Order Entries / Invoices breakdown
                if (po.orderEntries.isNotEmpty) ...[
                  const Text(
                    'Order Invoices / Billing History',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  ...po.orderEntries.map((entry) {
                    final double amount = (entry['amount'] is num) ? (entry['amount'] as num).toDouble() : (double.tryParse(entry['amount']?.toString() ?? '') ?? 0.0);
                    final String notes = entry['notes']?.toString() ?? 'Purchase order entry';
                    final String time = entry['timestamp']?.toString() ?? '';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(notes, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                              if (time.isNotEmpty)
                                Text(time.length > 16 ? time.substring(0, 16) : time, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                            ],
                          ),
                          Text('PKR ${amount.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.primaryCyan, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    );
                  }).toList(),
                  const SizedBox(height: 12),
                ],

                // Payment History breakdown
                if (po.payments.isNotEmpty) ...[
                  const Text(
                    'Payments Made to Vendor',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  ...po.payments.map((p) {
                    final double amount = (p['amount'] is num) ? (p['amount'] as num).toDouble() : (double.tryParse(p['amount']?.toString() ?? '') ?? 0.0);
                    final String method = p['payment_method']?.toString() ?? 'Cash';
                    final String time = p['timestamp']?.toString() ?? '';
                    final String notes = p['notes']?.toString() ?? '';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.green.withOpacity(0.2)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(CupertinoIcons.checkmark_circle_fill, color: AppTheme.successGreen, size: 16),
                              const SizedBox(width: 8),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Paid via $method', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                                  if (notes.isNotEmpty)
                                    Text(notes, style: const TextStyle(color: Colors.white70, fontSize: 11)),
                                  if (time.isNotEmpty)
                                    Text(time.length > 16 ? time.substring(0, 16) : time, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
                                ],
                              ),
                            ],
                          ),
                          Text('-PKR ${amount.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.successGreen, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    );
                  }).toList(),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
