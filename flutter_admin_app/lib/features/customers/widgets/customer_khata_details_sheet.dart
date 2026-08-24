import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

/// Full Customer Khata Statement & Details Modal Sheet
class CustomerKhataDetailsSheet extends StatelessWidget {
  final CustomerModel customer;
  final VoidCallback onAddEntry;

  const CustomerKhataDetailsSheet({
    super.key,
    required this.customer,
    required this.onAddEntry,
  });

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();
    final hasDebt = customer.balance > 0;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header / Drag Indicator
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

          // Customer Profile Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: hasDebt ? Colors.amber.withOpacity(0.2) : AppTheme.primaryBlue.withOpacity(0.2),
                  child: Icon(
                    CupertinoIcons.person_fill,
                    color: hasDebt ? Colors.amber : AppTheme.primaryBlue,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customer.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(CupertinoIcons.phone, size: 13, color: AppTheme.textSecondary),
                          const SizedBox(width: 4),
                          Text(
                            customer.phone.isNotEmpty ? customer.phone : 'No Phone',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(width: 12),
                          const Icon(CupertinoIcons.star_fill, size: 13, color: Colors.amber),
                          const SizedBox(width: 4),
                          Text(
                            '${customer.points} pts',
                            style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.bold),
                          ),
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

          // Total Balance Overview Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: hasDebt
                      ? [Colors.amber.shade900.withOpacity(0.4), Colors.amber.shade700.withOpacity(0.2)]
                      : [Colors.green.shade900.withOpacity(0.4), Colors.green.shade700.withOpacity(0.2)],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: hasDebt ? Colors.amber.withOpacity(0.4) : Colors.green.withOpacity(0.4),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        hasDebt ? 'TOTAL UDHAAR (DUE BALANCE)' : 'ACCOUNT BALANCE',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.1,
                          color: hasDebt ? Colors.amber.shade200 : Colors.green.shade200,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'PKR ${customer.balance.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: hasDebt ? Colors.amber : AppTheme.successGreen,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      if (customer.phone.isNotEmpty)
                        IconButton.filled(
                          style: IconButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                          icon: const Icon(CupertinoIcons.chat_bubble_2_fill, color: Colors.white, size: 20),
                          tooltip: 'Send WhatsApp Reminder',
                          onPressed: () => WhatsAppHelper.sendCustomerKhataReminder(customer: customer),
                        ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        style: IconButton.styleFrom(backgroundColor: Colors.amber.shade700),
                        icon: const Icon(CupertinoIcons.plus, color: Colors.black, size: 20),
                        tooltip: 'Add Khata Entry',
                        onPressed: () {
                          Navigator.pop(context);
                          onAddEntry();
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Icon(CupertinoIcons.list_bullet_below_rectangle, size: 16, color: AppTheme.primaryCyan),
                SizedBox(width: 6),
                Text(
                  'Khata Statement / Audit History',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Ledger Entries Stream
          Expanded(
            child: StreamBuilder<List<Map<String, dynamic>>>(
              stream: firebaseService.getCustomerKhataStream(customer.id.toString()),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final entries = snapshot.data ?? [];
                if (entries.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(CupertinoIcons.doc_text, size: 48, color: Colors.white.withOpacity(0.2)),
                        const SizedBox(height: 10),
                        const Text(
                          'No individual audit transactions recorded yet.',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  itemCount: entries.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final e = entries[index];
                    final isPayment = e['type'] == 'PAYMENT';
                    final double amount = (e['amount'] is num) ? (e['amount'] as num).toDouble() : 0.0;
                    final String notes = e['notes']?.toString() ?? '';
                    final String timestamp = e['timestamp']?.toString() ?? '';
                    final String paymentMethod = e['payment_method']?.toString() ?? 'Cash';

                    DateTime parsedTime;
                    try {
                      parsedTime = DateTime.parse(timestamp);
                    } catch (_) {
                      parsedTime = DateTime.now();
                    }

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isPayment ? Colors.green.withOpacity(0.2) : Colors.amber.withOpacity(0.2),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: isPayment ? Colors.green.withOpacity(0.15) : Colors.amber.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              isPayment ? CupertinoIcons.arrow_down_left : CupertinoIcons.arrow_up_right,
                              color: isPayment ? AppTheme.successGreen : Colors.amber,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isPayment ? 'Wasool / Payment Recv ($paymentMethod)' : 'Udhaar Given (Loan)',
                                  style: TextStyle(
                                    color: isPayment ? AppTheme.successGreen : Colors.amber,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                                if (notes.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    notes,
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                  ),
                                ],
                                const SizedBox(height: 2),
                                Text(
                                  AppDateUtils.formatDateTime(parsedTime),
                                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${isPayment ? '-' : '+'}PKR ${amount.toStringAsFixed(0)}',
                            style: TextStyle(
                              color: isPayment ? AppTheme.successGreen : Colors.amber,
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
