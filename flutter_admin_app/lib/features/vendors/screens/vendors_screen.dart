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
      ),
      body: StreamBuilder<List<PurchaseOrderModel>>(
        stream: firebaseService.getPurchaseOrdersStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingIndicator(message: 'Loading vendor ledgers...');
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
                  boxShadow: AppTheme.cardShadow,
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
                          style: AppTheme.displaySmall.copyWith(
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
                  padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
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
                        boxShadow: AppTheme.cardShadow,
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
}
