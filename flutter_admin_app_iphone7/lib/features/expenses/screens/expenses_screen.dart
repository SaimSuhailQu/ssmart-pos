import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/expense.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'ALL';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

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
              onRetry: () => setState(() {}),
            );
          }

          final allExpenses = snapshot.data ?? [];
          final categories = {'ALL', ...allExpenses.map((e) => e.category.trim()).where((c) => c.isNotEmpty)}.toList();

          final q = _searchQuery.trim().toLowerCase();
          final tokens = q.split(RegExp(r'\s+'));

          final filteredExpenses = allExpenses.where((e) {
            if (q.isNotEmpty) {
              final searchable = '${e.description} ${e.category} ${e.loggedBy ?? ''} ${e.amount.toStringAsFixed(0)}'.toLowerCase();
              final matchesQuery = tokens.every((t) => searchable.contains(t));
              if (!matchesQuery) return false;
            }

            if (_selectedCategory != 'ALL' && e.category.trim().toLowerCase() != _selectedCategory.toLowerCase()) {
              return false;
            }

            return true;
          }).toList();

          final totalExpenses = allExpenses.fold<double>(0, (sum, e) => sum + e.amount);
          final filteredTotal = filteredExpenses.fold<double>(0, (sum, e) => sum + e.amount);

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
                          _searchQuery.isNotEmpty || _selectedCategory != 'ALL' ? 'Filtered Expenses' : 'Total Expenses',
                          style: AppTheme.labelMedium.copyWith(color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'PKR ${(_searchQuery.isNotEmpty || _selectedCategory != 'ALL' ? filteredTotal : totalExpenses).toStringAsFixed(0)}',
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

              // Search Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Search expenses by description, category, amount...',
                    hintStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                    prefixIcon: const Icon(CupertinoIcons.search, size: 20, color: AppTheme.textSecondary),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(CupertinoIcons.clear_circled_solid, size: 18, color: Colors.white54),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppTheme.cardBackground,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppTheme.borderColor)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppTheme.borderColor)),
                  ),
                  onChanged: (val) => setState(() => _searchQuery = val),
                ),
              ),

              // Category Filter Chips
              if (categories.length > 1)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: SizedBox(
                    height: 34,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                      scrollDirection: Axis.horizontal,
                      itemCount: categories.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (ctx, idx) {
                        final cat = categories[idx];
                        final isSel = _selectedCategory.toLowerCase() == cat.toLowerCase();
                        return ChoiceChip(
                          label: Text(cat, style: TextStyle(fontSize: 12, color: isSel ? Colors.white : AppTheme.textSecondary)),
                          selected: isSel,
                          selectedColor: Colors.redAccent,
                          backgroundColor: AppTheme.cardBackground,
                          onSelected: (_) => setState(() => _selectedCategory = cat),
                        );
                      },
                    ),
                  ),
                ),

              // Expense List
              Expanded(
                child: filteredExpenses.isEmpty
                    ? Center(
                        child: Text(
                          allExpenses.isEmpty ? 'No expenses logged yet.' : 'No expenses match your search.',
                          style: const TextStyle(color: AppTheme.textSecondary),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(
                          left: AppTheme.spacingM,
                          right: AppTheme.spacingM,
                          bottom: AppTheme.spacingXL * 2,
                        ),
                        itemCount: filteredExpenses.length,
                        separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                        itemBuilder: (context, index) {
                          final expense = filteredExpenses[index];
                          final formattedDate = AppDateUtils.formatDateTime(DateTime.parse(expense.date));

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
                                    color: Colors.red.withOpacity(0.1),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(CupertinoIcons.arrow_down_right, color: Colors.redAccent, size: 20),
                                ),
                                const SizedBox(width: AppTheme.spacingM),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        expense.description,
                                        style: AppTheme.titleMedium.copyWith(fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.white10,
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              expense.category,
                                              style: const TextStyle(color: Colors.white70, fontSize: 10),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            formattedDate,
                                            style: AppTheme.bodySmall.copyWith(color: AppTheme.textTertiary),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'PKR ${expense.amount.toStringAsFixed(0)}',
                                      style: AppTheme.titleMedium.copyWith(
                                        color: Colors.redAccent,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(CupertinoIcons.trash, color: AppTheme.textTertiary, size: 18),
                                      onPressed: () => _confirmDeleteExpense(context, expense),
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
        child: SingleChildScrollView(
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
              await context.read<FirebaseService>().deleteExpense(expense.id.toString());
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
