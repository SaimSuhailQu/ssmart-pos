import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/expense.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';

class ExpensesScreen extends StatelessWidget {
  const ExpensesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Expense Counter'),
      ),
      body: StreamBuilder<List<ExpenseModel>>(
        stream: firebaseService.getExpensesStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingIndicator(message: 'Loading expenses...');
          }

          if (snapshot.hasError) {
            return AppErrorWidget(
              message: 'Failed to load expenses: ${snapshot.error}',
              onRetry: () => (context as Element).markNeedsBuild(),
            );
          }

          final expenses = snapshot.data ?? [];
          final totalExpenses = expenses.fold<double>(0, (sum, e) => sum + e.amount);

          if (expenses.isEmpty) {
            return const Center(
              child: Text(
                'No expenses logged yet.',
                style: TextStyle(color: AppTheme.textSecondary),
              ),
            );
          }

          return Column(
            children: [
              // Summary Header Card
              Container(
                margin: const EdgeInsets.all(AppTheme.spacingM),
                padding: const EdgeInsets.all(AppTheme.spacingL),
                decoration: BoxDecoration(
                  color: AppTheme.cardBackground,
                  borderRadius: BorderRadius.circular(AppTheme.radiusL),
                  border: Border.all(color: Colors.red.withOpacity(0.3)),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Expenses',
                          style: AppTheme.labelMedium.copyWith(color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'PKR ${totalExpenses.toStringAsFixed(0)}',
                          style: AppTheme.displaySmall.copyWith(
                            color: Colors.redAccent,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      ),
                      child: const Icon(CupertinoIcons.money_dollar_circle_fill, color: Colors.redAccent, size: 32),
                    ),
                  ],
                ),
              ),

              // Itemized Expenses List
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                  itemCount: expenses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                  itemBuilder: (context, index) {
                    final item = expenses[index];
                    return Container(
                      padding: const EdgeInsets.all(AppTheme.spacingM),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                        boxShadow: AppTheme.cardShadow,
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryBlue.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(AppTheme.radiusM),
                            ),
                            child: const Icon(CupertinoIcons.doc_text_fill, color: AppTheme.primaryBlue, size: 22),
                          ),
                          const SizedBox(width: AppTheme.spacingM),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.description.isNotEmpty ? item.description : 'Expense #${item.id}',
                                  style: AppTheme.bodyLarge.copyWith(fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${item.category} • Logged by ${item.loggedBy}',
                                  style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary),
                                ),
                                Text(
                                  AppDateUtils.formatDateTime(item.timestamp),
                                  style: AppTheme.labelSmall.copyWith(color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '-PKR ${item.amount.toStringAsFixed(0)}',
                            style: AppTheme.bodyLarge.copyWith(
                              color: Colors.redAccent,
                              fontWeight: FontWeight.bold,
                            ),
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
