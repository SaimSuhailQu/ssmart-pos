import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
                  backgroundColor: hasDebt ? Colors.amber.withValues(alpha: 0.2) : AppTheme.primaryBlue.withValues(alpha: 0.2),
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

          // Stream of ledger entries & live balance calculation
          Expanded(
            child: StreamBuilder<List<Map<String, dynamic>>>(
              stream: firebaseService.getCustomerKhataStream(customer.id.toString()),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final entries = snapshot.data ?? [];

                // Authoritative live balance from entries
                double computedBalance = 0.0;
                for (final e in entries) {
                  final eType = e['type']?.toString().toUpperCase() ?? 'LOAN';
                  final double eAmt = (e['amount'] is num)
                      ? (e['amount'] as num).toDouble()
                      : (double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0);
                  if (eType == 'LOAN') {
                    computedBalance += eAmt;
                  } else {
                    computedBalance -= eAmt;
                  }
                }

                final displayBalance = entries.isNotEmpty ? computedBalance : customer.balance;
                final bool hasCurrentDebt = displayBalance > 0;

                return Column(
                  children: [
                    // Total Balance Overview Bar
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: hasCurrentDebt
                                ? [Colors.amber.shade900.withValues(alpha: 0.4), Colors.amber.shade700.withValues(alpha: 0.2)]
                                : [Colors.green.shade900.withValues(alpha: 0.4), Colors.green.shade700.withValues(alpha: 0.2)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: hasCurrentDebt ? Colors.amber.withValues(alpha: 0.4) : Colors.green.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  hasCurrentDebt ? 'TOTAL UDHAAR (DUE BALANCE)' : 'ACCOUNT BALANCE',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.1,
                                    color: hasCurrentDebt ? Colors.amber.shade200 : Colors.green.shade200,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'PKR ${displayBalance.toStringAsFixed(0)}',
                                  style: TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    color: hasCurrentDebt ? Colors.amber : AppTheme.successGreen,
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
                                    onPressed: () => WhatsAppHelper.sendCustomerKhataReminder(
                                      customer: customer.copyWith(balance: displayBalance),
                                    ),
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

                    // Entries List
                    Expanded(
                      child: entries.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(CupertinoIcons.doc_text, size: 48, color: Colors.white.withValues(alpha: 0.2)),
                                  const SizedBox(height: 10),
                                  const Text(
                                    'No individual audit transactions recorded yet.',
                                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                                  ),
                                ],
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                              itemCount: entries.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final e = entries[index];
                                final entryKey = e['key']?.toString() ?? e['sync_id']?.toString() ?? e['id']?.toString() ?? 'entry_$index';
                                final isPayment = (e['type']?.toString().toUpperCase() ?? 'LOAN') == 'PAYMENT';
                                final double amount = (e['amount'] is num)
                                    ? (e['amount'] as num).toDouble()
                                    : (double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0);
                                final String notes = e['notes']?.toString() ?? '';
                                final String timestamp = e['timestamp']?.toString() ?? '';
                                final String paymentMethod = e['payment_method']?.toString() ?? 'Cash';

                                final parsedTime = AppDateUtils.parseDateTime(timestamp) ?? DateTime.now();

                                final bool isEditable = DateTime.now().difference(parsedTime.isUtc ? parsedTime.toLocal() : parsedTime).inMinutes <= 30;
                                final int minsRemaining = (30 - DateTime.now().difference(parsedTime.isUtc ? parsedTime.toLocal() : parsedTime).inMinutes).clamp(0, 30);

                                return Dismissible(
                                  key: ValueKey('khata_${entryKey}_$index'),
                                  direction: DismissDirection.endToStart,
                                  confirmDismiss: (direction) async {
                                    HapticFeedback.mediumImpact();
                                    final bool? confirmed = await showDialog<bool>(
                                      context: context,
                                      builder: (dialogCtx) => AlertDialog(
                                        backgroundColor: AppTheme.cardBackground,
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                        title: const Row(
                                          children: [
                                            Icon(CupertinoIcons.trash_circle_fill, color: AppTheme.errorRed, size: 28),
                                            SizedBox(width: 10),
                                            Text(
                                              'Delete Khata Entry?',
                                              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                            ),
                                          ],
                                        ),
                                        content: Text(
                                          'Are you sure you want to delete this ${isPayment ? 'Wasool (Payment)' : 'Udhaar (Loan)'} entry of PKR ${amount.toStringAsFixed(0)}?\n\nThis will adjust the customer balance and ledger permanently.',
                                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14, height: 1.4),
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.pop(dialogCtx, false),
                                            child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
                                          ),
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppTheme.errorRed,
                                              foregroundColor: Colors.white,
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                            ),
                                            onPressed: () => Navigator.pop(dialogCtx, true),
                                            child: const Text('Delete Entry', style: TextStyle(fontWeight: FontWeight.bold)),
                                          ),
                                        ],
                                      ),
                                    );

                                    if (confirmed == true) {
                                      try {
                                        final String? rawKey = e['raw_key']?.toString();
                                        await firebaseService.deleteKhataTransaction(
                                          customerId: customer.id.toString(),
                                          entryKey: entryKey,
                                          rawKey: rawKey,
                                        );
                                        HapticFeedback.heavyImpact();
                                        if (context.mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('Entry deleted. Balance recalculated.'),
                                              backgroundColor: AppTheme.errorRed,
                                              behavior: SnackBarBehavior.floating,
                                              duration: Duration(seconds: 2),
                                            ),
                                          );
                                        }
                                        return true;
                                      } catch (err) {
                                        if (context.mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text('Failed to delete entry: $err'),
                                              backgroundColor: AppTheme.errorRed,
                                            ),
                                          );
                                        }
                                        return false;
                                      }
                                    }
                                    return false;
                                  },
                                  background: Container(
                                    alignment: Alignment.centerRight,
                                    padding: const EdgeInsets.only(right: 20),
                                    decoration: BoxDecoration(
                                      color: AppTheme.errorRed.withValues(alpha: 0.9),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Icon(CupertinoIcons.trash_fill, color: Colors.white, size: 22),
                                        SizedBox(width: 8),
                                        Text(
                                          'Delete Entry',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppTheme.cardBackground,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: isPayment ? Colors.green.withValues(alpha: 0.2) : Colors.amber.withValues(alpha: 0.2),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: isPayment ? Colors.green.withValues(alpha: 0.15) : Colors.amber.withValues(alpha: 0.15),
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
                                                Wrap(
                                                  crossAxisAlignment: WrapCrossAlignment.center,
                                                  spacing: 6,
                                                  runSpacing: 2,
                                                  children: [
                                                    Text(
                                                      isPayment ? 'Wasool / Payment Recv ($paymentMethod)' : 'Udhaar Given (Loan)',
                                                      style: TextStyle(
                                                        color: isPayment ? AppTheme.successGreen : Colors.amber,
                                                        fontWeight: FontWeight.bold,
                                                        fontSize: 13,
                                                      ),
                                                    ),
                                                    if (isEditable)
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                                        decoration: BoxDecoration(
                                                          color: AppTheme.primaryCyan.withValues(alpha: 0.15),
                                                          borderRadius: BorderRadius.circular(4),
                                                          border: Border.all(color: AppTheme.primaryCyan.withValues(alpha: 0.3), width: 0.5),
                                                        ),
                                                        child: Text(
                                                          '${minsRemaining}m edit',
                                                          style: const TextStyle(color: AppTheme.primaryCyan, fontSize: 9, fontWeight: FontWeight.bold),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                                if (notes.isNotEmpty) ...[
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    notes,
                                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                                                    maxLines: 2,
                                                    overflow: TextOverflow.ellipsis,
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
                                          const SizedBox(width: 8),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              FittedBox(
                                                fit: BoxFit.scaleDown,
                                                alignment: Alignment.centerRight,
                                                child: Text(
                                                  '${isPayment ? '-' : '+'}PKR ${amount.toStringAsFixed(0)}',
                                                  style: TextStyle(
                                                    color: isPayment ? AppTheme.successGreen : Colors.amber,
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.bold,
                                                    fontFeatures: const [FontFeature.tabularFigures()],
                                                  ),
                                                ),
                                              ),
                                              if (isEditable) ...[
                                                const SizedBox(height: 4),
                                                GestureDetector(
                                                  onTap: () => _showEditEntryDialog(
                                                    context,
                                                    firebaseService: firebaseService,
                                                    customerId: customer.id.toString(),
                                                    entry: e,
                                                    parsedTime: parsedTime,
                                                  ),
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: Colors.white.withValues(alpha: 0.1),
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: Colors.white24, width: 0.5),
                                                    ),
                                                    child: const Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        Icon(CupertinoIcons.pencil, size: 11, color: Colors.white),
                                                        SizedBox(width: 3),
                                                        Text('Edit', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showEditEntryDialog(
    BuildContext context, {
    required FirebaseService firebaseService,
    required String customerId,
    required Map<String, dynamic> entry,
    required DateTime parsedTime,
  }) {
    final diff = DateTime.now().difference(parsedTime.isUtc ? parsedTime.toLocal() : parsedTime);
    if (diff.inMinutes > 30) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This entry was recorded more than 30 minutes ago and cannot be edited.'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    final entryKey = entry['key']?.toString() ?? entry['sync_id']?.toString() ?? entry['id']?.toString() ?? '';
    final isPayment = (entry['type']?.toString().toUpperCase() ?? 'LOAN') == 'PAYMENT';
    final double currentAmt = (entry['amount'] is num)
        ? (entry['amount'] as num).toDouble()
        : (double.tryParse(entry['amount']?.toString() ?? '0') ?? 0.0);

    final amountCtrl = TextEditingController(text: currentAmt > 0 ? currentAmt.toStringAsFixed(0) : '');
    final notesCtrl = TextEditingController(text: entry['notes']?.toString() ?? '');
    String paymentMethod = entry['payment_method']?.toString() ?? 'Cash';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          decoration: const BoxDecoration(
            color: AppTheme.surfaceDark,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + AppTheme.spacingL,
            top: AppTheme.spacingL,
            left: AppTheme.spacingL,
            right: AppTheme.spacingL,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(CupertinoIcons.pencil_circle_fill, color: AppTheme.primaryCyan, size: 24),
                        const SizedBox(width: 8),
                        Text(
                          'Edit ${isPayment ? 'Wasool' : 'Udhaar'} Entry',
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(CupertinoIcons.xmark_circle_fill, color: AppTheme.textSecondary),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Entries can be edited within 30 minutes to correct accidental mistakes.',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: AppTheme.spacingM),

                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  autofocus: true,
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    labelText: 'Corrected Amount (PKR) *',
                    prefixIcon: const Icon(CupertinoIcons.money_dollar),
                    filled: true,
                    fillColor: AppTheme.cardBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.white12),
                    ),
                  ),
                ),
                const SizedBox(height: AppTheme.spacingM),

                if (isPayment) ...[
                  DropdownButtonFormField<String>(
                    initialValue: ['Cash', 'Bank Transfer', 'JazzCash / EasyPaisa', 'Card'].contains(paymentMethod)
                        ? paymentMethod
                        : 'Cash',
                    dropdownColor: AppTheme.surfaceDark,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Payment Method',
                      prefixIcon: const Icon(CupertinoIcons.creditcard),
                      filled: true,
                      fillColor: AppTheme.cardBackground,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Colors.white12),
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'Bank Transfer', child: Text('Bank Transfer / Online')),
                      DropdownMenuItem(value: 'JazzCash / EasyPaisa', child: Text('JazzCash / EasyPaisa')),
                      DropdownMenuItem(value: 'Card', child: Text('Card')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => paymentMethod = val);
                    },
                  ),
                  const SizedBox(height: AppTheme.spacingM),
                ],

                TextField(
                  controller: notesCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'Description / Notes',
                    prefixIcon: const Icon(CupertinoIcons.doc_text),
                    filled: true,
                    fillColor: AppTheme.cardBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.white12),
                    ),
                  ),
                ),
                const SizedBox(height: AppTheme.spacingL),

                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryCyan,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(CupertinoIcons.checkmark_alt_circle),
                  label: const Text('Save Correction', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  onPressed: () async {
                    final newAmt = double.tryParse(amountCtrl.text.trim()) ?? 0;
                    if (newAmt <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter an amount greater than 0'), backgroundColor: AppTheme.errorRed),
                      );
                      return;
                    }

                    try {
                      await firebaseService.updateKhataTransaction(
                        customerId: customerId,
                        entryKey: entryKey,
                        newAmount: newAmt,
                        notes: notesCtrl.text.trim().isNotEmpty ? notesCtrl.text.trim() : null,
                        paymentMethod: isPayment ? paymentMethod : null,
                      );

                      if (!ctx.mounted) return;
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('✅ Khata entry updated to PKR ${newAmt.toStringAsFixed(0)}!'),
                          backgroundColor: AppTheme.successGreen,
                        ),
                      );
                    } catch (e) {
                      if (!ctx.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed to update: $e'), backgroundColor: AppTheme.errorRed),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
