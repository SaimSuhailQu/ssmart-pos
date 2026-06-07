import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/sale.dart';

/// Widget displaying a list of recent transactions
class RecentTransactions extends StatelessWidget {
  final List<Sale> transactions;
  final VoidCallback? onViewAll;

  const RecentTransactions({
    super.key,
    required this.transactions,
    this.onViewAll,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingM,
        vertical: AppTheme.spacingS,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingM),
            child: Row(
              children: [
                Text(
                  'Recent Transactions',
                  style: AppTheme.titleMedium,
                ),
                const Spacer(),
                if (onViewAll != null)
                  TextButton(
                    onPressed: onViewAll,
                    child: Text(
                      'View All',
                      style: AppTheme.bodyMedium.copyWith(
                        color: AppTheme.primaryBlue,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Transactions list
          if (transactions.isEmpty)
            _buildEmptyState()
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: transactions.length,
              separatorBuilder: (context, index) => const Divider(
                height: 1,
                indent: AppTheme.spacingM,
                endIndent: AppTheme.spacingM,
              ),
              itemBuilder: (context, index) {
                final transaction = transactions[index];
                return _TransactionTile(transaction: transaction);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.spacingXL),
      child: Column(
        children: [
          Icon(
            CupertinoIcons.doc_text,
            size: 48,
            color: AppTheme.textTertiary,
          ),
          const SizedBox(height: AppTheme.spacingM),
          Text(
            'No transactions yet',
            style: AppTheme.bodyMedium.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Individual transaction tile
class _TransactionTile extends StatelessWidget {
  final Sale transaction;

  const _TransactionTile({required this.transaction});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingM,
        vertical: AppTheme.spacingS,
      ),
      leading: _buildPaymentIcon(),
      title: Text(
        AppDateUtils.formatCurrency(transaction.total),
        style: AppTheme.titleMedium,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          Text(
            AppDateUtils.formatDateTime(transaction.timestamp),
            style: AppTheme.bodySmall,
          ),
          if (transaction.userName != null) ...[
            const SizedBox(height: 2),
            Text(
              'Cashier: ${transaction.userName}',
              style: AppTheme.labelSmall,
            ),
          ],
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _buildPaymentMethodChip(),
          if (transaction.items != null && transaction.items!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '${transaction.items!.length} items',
              style: AppTheme.labelSmall,
            ),
          ],
        ],
      ),
      onTap: () {
        // TODO: Navigate to transaction details
        _showTransactionDetails(context);
      },
    );
  }

  Widget _buildPaymentIcon() {
    IconData icon;
    Color color;

    switch (transaction.paymentMethod.toLowerCase()) {
      case 'cash':
        icon = CupertinoIcons.money_dollar;
        color = AppTheme.successGreen;
        break;
      case 'card':
      case 'credit card':
      case 'debit card':
        icon = CupertinoIcons.creditcard;
        color = AppTheme.primaryBlue;
        break;
      case 'mobile':
      case 'mobile payment':
        icon = CupertinoIcons.device_phone_portrait;
        color = AppTheme.secondaryBlue;
        break;
      default:
        icon = CupertinoIcons.money_dollar_circle;
        color = AppTheme.textSecondary;
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusS),
      ),
      child: Icon(
        icon,
        color: color,
        size: 20,
      ),
    );
  }

  Widget _buildPaymentMethodChip() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 8,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: AppTheme.primaryBlue.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        transaction.paymentMethod,
        style: AppTheme.labelSmall.copyWith(
          color: AppTheme.primaryBlue,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  void _showTransactionDetails(BuildContext context) {
    showCupertinoModalPopup(
      context: context,
      builder: (context) => _TransactionDetailsModal(transaction: transaction),
    );
  }
}

/// Modal showing transaction details
class _TransactionDetailsModal extends StatelessWidget {
  final Sale transaction;

  const _TransactionDetailsModal({required this.transaction});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: const BoxDecoration(
          color: AppTheme.cardBackground,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppTheme.radiusL),
          ),
        ),
        child: Column(
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.symmetric(vertical: AppTheme.spacingS),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.borderColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingM),
              child: Row(
                children: [
                  Text(
                    'Transaction Details',
                    style: AppTheme.titleLarge,
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(CupertinoIcons.xmark),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppTheme.spacingM),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDetailRow('Transaction ID', transaction.id),
                    _buildDetailRow(
                      'Date & Time',
                      AppDateUtils.formatDateTime(transaction.timestamp),
                    ),
                    _buildDetailRow(
                      'Total Amount',
                      AppDateUtils.formatCurrency(transaction.total),
                    ),
                    _buildDetailRow(
                      'Subtotal',
                      AppDateUtils.formatCurrency(transaction.subtotal),
                    ),
                    if (transaction.tax > 0)
                      _buildDetailRow(
                        'Tax',
                        AppDateUtils.formatCurrency(transaction.tax),
                      ),
                    if (transaction.discount > 0)
                      _buildDetailRow(
                        'Discount',
                        AppDateUtils.formatCurrency(transaction.discount),
                      ),
                    _buildDetailRow('Payment Method', transaction.paymentMethod),
                    if (transaction.userName != null)
                      _buildDetailRow('Cashier', transaction.userName!),
                    if (transaction.storeBranch != null)
                      _buildDetailRow('Store Branch', transaction.storeBranch!),

                    // Items
                    if (transaction.items != null &&
                        transaction.items!.isNotEmpty) ...[
                      const SizedBox(height: AppTheme.spacingL),
                      Text(
                        'Items (${transaction.items!.length})',
                        style: AppTheme.titleMedium,
                      ),
                      const SizedBox(height: AppTheme.spacingM),
                      ...transaction.items!.map((item) => _buildItemRow(item)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingM),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: AppTheme.bodyMedium,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemRow(SaleItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingS),
      padding: const EdgeInsets.all(AppTheme.spacingM),
      decoration: BoxDecoration(
        color: AppTheme.backgroundLight,
        borderRadius: BorderRadius.circular(AppTheme.radiusS),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  style: AppTheme.bodyMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.quantity} × ${AppDateUtils.formatCurrency(item.price)}',
                  style: AppTheme.bodySmall,
                ),
              ],
            ),
          ),
          Text(
            AppDateUtils.formatCurrency(item.total),
            style: AppTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}
