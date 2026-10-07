import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/core/widgets/app_loading_indicator.dart';
import 'package:ssmart_pos_admin/core/widgets/graphite_empty_state.dart';
import 'package:ssmart_pos_admin/core/widgets/liquid_scaffold.dart';
import 'package:ssmart_pos_admin/models/expense.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

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

    return LiquidScaffold(
      graphiteAmbience: true,
      appBar: AppBar(
        title: const Text('Expense Counter'),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.add_circled, color: GraphiteTheme.platinum),
            tooltip: 'Log Expense',
            onPressed: () => _showAddExpenseDialog(context),
          ),
        ],
      ),
      floatingActionButton: Container(
        decoration: GraphiteTheme.primaryButtonDecoration,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => _showAddExpenseDialog(context),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(CupertinoIcons.plus, color: GraphiteTheme.graphiteDeep, size: 20),
                  const SizedBox(width: 8),
                  Text('Log Expense', style: GraphiteTheme.primaryButtonText.copyWith(fontSize: 14)),
                ],
              ),
            ),
          ),
        ),
      ),
      body: StreamBuilder<List<ExpenseModel>>(
        initialData: firebaseService.cachedExpenses,
        stream: firebaseService.getExpensesStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && (!snapshot.hasData || snapshot.data == null)) {
            return const AppLoadingIndicator(message: 'Loading expenses...');
          }

          if (snapshot.hasError && (!snapshot.hasData || snapshot.data == null)) {
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
              final searchable = '${e.description} ${e.category} ${e.loggedBy} ${e.amount.toStringAsFixed(0)}'.toLowerCase();
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
              // Hero Summary Header — Noir Graphite Card
              Container(
                margin: const EdgeInsets.all(AppTheme.spacingM),
                padding: const EdgeInsets.all(AppTheme.spacingL),
                decoration: GraphiteTheme.platinumCardDecoration,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (_searchQuery.isNotEmpty || _selectedCategory != 'ALL' ? 'FILTERED EXPENSES' : 'TOTAL EXPENSES').toUpperCase(),
                            style: GraphiteTheme.eyebrow,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Text('PKR ', style: GraphiteTheme.heroCurrency),
                                Text(
                                  (_searchQuery.isNotEmpty || _selectedCategory != 'ALL' ? filteredTotal : totalExpenses).toStringAsFixed(0),
                                  style: GraphiteTheme.heroAmount.copyWith(
                                    fontSize: 36,
                                    color: GraphiteTheme.errorRed,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: GraphiteTheme.platinumFaint,
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                        border: Border.all(color: GraphiteTheme.cardBorder),
                      ),
                      child: const Icon(CupertinoIcons.money_dollar_circle_fill, color: GraphiteTheme.errorRed, size: 28),
                    ),
                  ],
                ),
              ),

              // Search Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(color: AppTheme.textRed),
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
                          label: Text(
                            cat,
                            style: GraphiteTheme.pillText(filled: isSel).copyWith(
                              color: isSel ? GraphiteTheme.graphiteDeep : GraphiteTheme.slate,
                            ),
                          ),
                          selected: isSel,
                          selectedColor: GraphiteTheme.platinum,
                          backgroundColor: GraphiteTheme.cardSurface,
                          side: BorderSide(
                            color: isSel ? GraphiteTheme.platinum : GraphiteTheme.cardBorder,
                          ),
                          onSelected: (_) => setState(() => _selectedCategory = cat),
                        );
                      },
                    ),
                  ),
                ),

              // Expense List
              Expanded(
                child: filteredExpenses.isEmpty
                    ? GraphiteEmptyState(
                        icon: allExpenses.isEmpty
                            ? CupertinoIcons.creditcard
                            : CupertinoIcons.search,
                        title: allExpenses.isEmpty
                            ? 'No Expenses Logged'
                            : 'No Matching Expenses',
                        message: allExpenses.isEmpty
                            ? 'Tap the Log Expense button above to record your store overhead and operational payouts.'
                            : 'Try adjusting your search keywords or switching category filters.',
                        iconColor: GraphiteTheme.platinum,
                        actionLabel: allExpenses.isEmpty ? null : 'Reset Filters',
                        actionIcon: CupertinoIcons.arrow_counterclockwise,
                        onAction: allExpenses.isEmpty
                            ? null
                            : () {
                                setState(() {
                                  _searchController.clear();
                                  _searchQuery = '';
                                  _selectedCategory = 'ALL';
                                });
                              },
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
                              color: GraphiteTheme.graphiteCard,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: GraphiteTheme.cardBorder),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: const BoxDecoration(
                                    color: GraphiteTheme.platinumFaint,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(CupertinoIcons.arrow_down_right, color: GraphiteTheme.errorRed, size: 20),
                                ),
                                const SizedBox(width: AppTheme.spacingM),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        expense.description,
                                        style: GraphiteTheme.bodyStrong,
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: GraphiteTheme.cardSurface,
                                              border: Border.all(color: GraphiteTheme.cardBorder),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              expense.category,
                                              style: GraphiteTheme.captionPlatinum.copyWith(fontSize: 10),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            formattedDate,
                                            style: GraphiteTheme.body.copyWith(color: GraphiteTheme.slateDim, fontSize: 11),
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
                                      style: GraphiteTheme.metricValue.copyWith(
                                        color: GraphiteTheme.errorRed,
                                        fontSize: 16,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(CupertinoIcons.trash, color: GraphiteTheme.slateDim, size: 18),
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
                    style: GraphiteTheme.bodyStrong.copyWith(fontSize: 18),
                  ),
                  IconButton(
                    icon: const Icon(CupertinoIcons.xmark_circle, color: GraphiteTheme.slate),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(color: AppTheme.textRed),
                decoration: const InputDecoration(labelText: 'Expense Amount (PKR)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtrl,
                textCapitalization: TextCapitalization.sentences,
                style: const TextStyle(color: AppTheme.textRed),
                decoration: const InputDecoration(labelText: 'Description / Purpose', prefixIcon: Icon(CupertinoIcons.pencil)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: catCtrl,
                textCapitalization: TextCapitalization.words,
                style: const TextStyle(color: AppTheme.textRed),
                decoration: const InputDecoration(labelText: 'Category (e.g. Rent, Utilities, Refreshments)', prefixIcon: Icon(CupertinoIcons.folder)),
              ),
              const SizedBox(height: 24),
              Container(
                width: double.infinity,
                height: 48,
                decoration: GraphiteTheme.primaryButtonDecoration,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () async {
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

                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Expense recorded successfully!'),
                          backgroundColor: GraphiteTheme.graphiteCard,
                        ),
                      );
                    },
                    child: Center(
                      child: Text('Record Expense', style: GraphiteTheme.primaryButtonText),
                    ),
                  ),
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
              if (!context.mounted) return;
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
