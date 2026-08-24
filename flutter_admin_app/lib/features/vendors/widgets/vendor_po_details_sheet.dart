import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';

/// Full Vendor Purchase Order & Bill Details Sheet
class VendorPODetailsSheet extends StatelessWidget {
  final PurchaseOrderModel po;
  final VoidCallback onEditOrPay;

  const VendorPODetailsSheet({
    super.key,
    required this.po,
    required this.onEditOrPay,
  });

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
      height: MediaQuery.of(context).size.height * 0.85,
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
                  backgroundColor: AppTheme.primaryCyan.withOpacity(0.15),
                  child: const Icon(CupertinoIcons.cube_box_fill, color: AppTheme.primaryCyan, size: 28),
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
                          if (po.contactPerson.isNotEmpty) ...[
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

          // Payment Overview Card
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
                            style: IconButton.styleFrom(backgroundColor: AppTheme.primaryCyan),
                            icon: const Icon(CupertinoIcons.pencil, color: Colors.black, size: 20),
                            tooltip: 'Edit / Record Payment',
                            onPressed: () {
                              Navigator.pop(context);
                              onEditOrPay();
                            },
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
                      _StatItem(label: 'Order Status', value: po.status, color: AppTheme.primaryCyan),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Details List (Items / Order History / Notes)
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
                        'Purchase Order Information',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      _DetailRow(label: 'Date & Time', value: AppDateUtils.formatDateTime(parsedTime)),
                      _DetailRow(label: 'Payment Status', value: po.paymentStatus),
                      if (po.email.isNotEmpty) _DetailRow(label: 'Email', value: po.email),
                      if (po.notes.isNotEmpty) _DetailRow(label: 'Notes', value: po.notes),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Order Entries / Invoices breakdown
                if (po.orderEntries.isNotEmpty) ...[
                  const Text(
                    'Order Invoices History',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  ...po.orderEntries.map((entry) {
                    final double amount = (entry['amount'] is num) ? (entry['amount'] as num).toDouble() : 0.0;
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
                    final double amount = (p['amount'] is num) ? (p['amount'] as num).toDouble() : 0.0;
                    final String method = p['payment_method']?.toString() ?? 'Cash';
                    final String time = p['timestamp']?.toString() ?? '';
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
                                  if (time.isNotEmpty)
                                    Text(time.length > 16 ? time.substring(0, 16) : time, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
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
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
