import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';

class VendorsScreen extends StatelessWidget {
  const VendorsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Vendor Ledgers & POs'),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.add_circled, color: Colors.purpleAccent),
            tooltip: 'Add Vendor PO',
            onPressed: () => _showVendorDialog(context, null),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.purple.shade700,
        icon: const Icon(CupertinoIcons.plus, color: Colors.white),
        label: const Text('Add Vendor / PO', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => _showVendorDialog(context, null),
      ),
      body: StreamBuilder<List<PurchaseOrderModel>>(
        stream: firebaseService.getPurchaseOrdersStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const AppLoadingIndicator(message: 'Loading vendor ledgers...');
          }

          if (snapshot.hasError) {
            return AppErrorWidget(
              message: 'Failed to load vendor records: ${snapshot.error}',
              onRetry: () => (context as Element).markNeedsBuild(),
            );
          }

          final pos = snapshot.data ?? [];
          final totalPayable = pos.fold<double>(0, (sum, p) => sum + p.balanceDue);

          if (pos.isEmpty) {
            return const Center(
              child: Text(
                'No vendor purchase orders found.',
                style: TextStyle(color: AppTheme.textSecondary),
              ),
            );
          }

          return Column(
            children: [
              // Summary Header
              Container(
                margin: const EdgeInsets.all(AppTheme.spacingM),
                padding: const EdgeInsets.all(AppTheme.spacingL),
                decoration: BoxDecoration(
                  color: AppTheme.cardBackground,
                  borderRadius: BorderRadius.circular(AppTheme.radiusL),
                  border: Border.all(color: Colors.purple.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Vendor Payable Due',
                          style: AppTheme.labelMedium.copyWith(color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'PKR ${totalPayable.toStringAsFixed(0)}',
                          style: AppTheme.headlineLarge.copyWith(
                            color: Colors.purple.shade700,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.purple.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      ),
                      child: const Icon(CupertinoIcons.cube_box_fill, color: Colors.purple, size: 32),
                    ),
                  ],
                ),
              ),

              // PO List
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.only(
                    left: AppTheme.spacingM,
                    right: AppTheme.spacingM,
                    bottom: AppTheme.spacingXL * 2,
                  ),
                  itemCount: pos.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                  itemBuilder: (context, index) {
                    final po = pos[index];
                    final isCleared = po.balanceDue <= 0;

                    return Container(
                      padding: const EdgeInsets.all(AppTheme.spacingM),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                po.vendorName,
                                style: AppTheme.bodyLarge.copyWith(fontWeight: FontWeight.bold),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isCleared ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(AppTheme.radiusS),
                                ),
                                child: Text(
                                  isCleared ? 'PAID' : 'PAYABLE',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: isCleared ? Colors.green : Colors.red,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Billed: PKR ${po.totalCost.toStringAsFixed(0)}',
                                style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary),
                              ),
                              Text(
                                'Paid: PKR ${po.paidAmount.toStringAsFixed(0)}',
                                style: AppTheme.bodySmall.copyWith(color: AppTheme.successGreen),
                              ),
                              Text(
                                'Due: PKR ${po.balanceDue.toStringAsFixed(0)}',
                                style: AppTheme.bodySmall.copyWith(
                                  color: isCleared ? AppTheme.successGreen : Colors.redAccent,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            AppDateUtils.formatDateTime(po.timestamp),
                            style: AppTheme.labelSmall.copyWith(color: AppTheme.textSecondary),
                          ),
                          const Divider(height: 16, color: AppTheme.borderColor),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton.icon(
                                icon: const Icon(CupertinoIcons.pencil, size: 16, color: AppTheme.primaryCyan),
                                label: const Text('Edit / Record Payment', style: TextStyle(color: AppTheme.primaryCyan, fontSize: 12)),
                                onPressed: () => _showVendorDialog(context, po),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(CupertinoIcons.trash, size: 16, color: AppTheme.errorRed),
                                onPressed: () => _confirmDeletePO(context, po),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showVendorDialog(BuildContext context, PurchaseOrderModel? po) {
    final isEditing = po != null;
    final nameCtrl = TextEditingController(text: po?.vendorName ?? '');
    final contactCtrl = TextEditingController(text: po?.contactPerson ?? '');
    final phoneCtrl = TextEditingController(text: po?.phone ?? '');
    final emailCtrl = TextEditingController(text: po?.email ?? '');
    final billedCtrl = TextEditingController(text: po?.totalCost != null ? po!.totalCost.toString() : '');
    final paidCtrl = TextEditingController(text: po?.paidAmount != null ? po!.paidAmount.toString() : '0');
    final noteCtrl = TextEditingController(text: po?.notes ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
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
                    isEditing ? 'Update Vendor PO' : 'New Vendor Record',
                    style: AppTheme.headlineMedium.copyWith(color: Colors.purpleAccent),
                  ),
                  IconButton(
                    icon: const Icon(CupertinoIcons.xmark_circle, color: AppTheme.textSecondary),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Vendor / Company Name', prefixIcon: Icon(CupertinoIcons.building_2_fill)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                keyboardType: TextInputType.phone,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Phone (WhatsApp Ledger)', prefixIcon: Icon(CupertinoIcons.phone)),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: billedCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Total Billed (PKR)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: paidCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Amount Paid (PKR)', prefixIcon: Icon(CupertinoIcons.checkmark_seal_fill)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Invoice / PO Notes', prefixIcon: Icon(CupertinoIcons.doc_plaintext)),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple.shade700,
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(CupertinoIcons.checkmark_alt_circle),
                  label: Text(isEditing ? 'Update Vendor PO' : 'Save Vendor Record', style: const TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    final phone = phoneCtrl.text.trim();
                    final billed = double.tryParse(billedCtrl.text.trim()) ?? 0;
                    final paid = double.tryParse(paidCtrl.text.trim()) ?? 0;

                    if (name.isEmpty || billed <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter vendor name and billed amount')),
                      );
                      return;
                    }

                    final status = paid >= billed ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid');

                    Navigator.pop(ctx);
                    await context.read<FirebaseService>().saveVendorPurchaseOrder(
                      id: po?.id,
                      vendorName: name,
                      contactPerson: contactCtrl.text.trim().isEmpty ? name : contactCtrl.text.trim(),
                      phone: phone,
                      email: emailCtrl.text.trim(),
                      totalAmount: billed,
                      paidAmount: paid,
                      paymentStatus: status,
                      notes: noteCtrl.text.trim(),
                    );

                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(isEditing ? 'Vendor PO updated!' : 'Vendor record added!'),
                        backgroundColor: Colors.purpleAccent,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeletePO(BuildContext context, PurchaseOrderModel po) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Vendor PO?'),
        content: Text('Are you sure you want to delete purchase order for "${po.vendorName}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<FirebaseService>().deleteVendorPurchaseOrder(po.id);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Deleted PO for ${po.vendorName}')),
              );
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
