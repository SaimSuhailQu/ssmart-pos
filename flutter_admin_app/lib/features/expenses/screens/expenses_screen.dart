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
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.add_circled, color: Colors.redAccent),
            tooltip: 'Log Expense',
            onPressed: () => _showAddExpenseDialog(context),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.redAccent,
        icon: const Icon(CupertinoIcons.plus, color: Colors.white),
        label: const Text('Log Expense', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => _showAddExpenseDialog(context),
      ),
      body: StreamBuilder<List<ExpenseModel>>(
        stream: firebaseService.getExpensesStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const AppLoadingIndicator(message: 'Loading expenses...');
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
                          style: AppTheme.headlineLarge.copyWith(
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
                  padding: const EdgeInsets.only(
                    left: AppTheme.spacingM,
                    right: AppTheme.spacingM,
                    bottom: AppTheme.spacingXL * 2,
                  ),
                  itemCount: expenses.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                  itemBuilder: (context, index) {
                    final item = expenses[index];
                    return Container(
                      padding: const EdgeInsets.all(AppTheme.spacingM),
                      decoration: BoxDecoration(
                        color: AppTheme.cardBackground,
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                        border: Border.all(color: AppTheme.borderColor),
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
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '-PKR ${item.amount.toStringAsFixed(0)}',
                                style: AppTheme.bodyLarge.copyWith(
                                  color: Colors.redAccent,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(CupertinoIcons.trash, size: 16, color: AppTheme.errorRed),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => _confirmDeleteExpense(context, item),
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

  void _showAddExpenseDialog(BuildContext context) {
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final catCtrl = TextEditingController(text: 'General');

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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Log Business Expense',
                  style: AppTheme.headlineMedium.copyWith(color: Colors.redAccent),
                ),
                IconButton(
                  icon: const Icon(CupertinoIcons.xmark_circle, color: AppTheme.textSecondary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Expense Amount (PKR)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Description / Purpose', prefixIcon: Icon(CupertinoIcons.pencil)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: catCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Category (e.g. Rent, Utilities, Refreshments)', prefixIcon: Icon(CupertinoIcons.folder)),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(CupertinoIcons.checkmark_alt),
                label: const Text('Record Expense', style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () async {
                  final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
                  final desc = descCtrl.text.trim();
                  final cat = catCtrl.text.trim().isEmpty ? 'General' : catCtrl.text.trim();

                  if (amount <= 0 || desc.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please enter an amount and description')),
                    );
                    return;
                  }

                  Navigator.pop(ctx);
                  await context.read<FirebaseService>().addExpense(
                    amount: amount,
                    description: desc,
                    category: cat,
                    loggedBy: 'Mobile Admin',
                  );

                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Expense recorded successfully!'),
                      backgroundColor: Colors.redAccent,
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteExpense(BuildContext context, ExpenseModel expense) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Expense?'),
        content: Text('Are you sure you want to delete expense of PKR ${expense.amount.toStringAsFixed(0)}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<FirebaseService>().deleteExpense(expense.id);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Expense deleted')),
              );
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
