import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/widgets/glass_card.dart';
import 'package:ssmart_pos_admin/features/catalog/screens/catalog_screen.dart';
import 'package:ssmart_pos_admin/features/expenses/screens/expenses_screen.dart';
import 'package:ssmart_pos_admin/models/expense.dart';
import 'package:ssmart_pos_admin/models/product.dart';

enum _OpsCardKind { alerts, expenses }

/// Combined "Store Operations" strip for the dashboard:
///  - Low-stock & out-of-stock inventory alerts with total restock value.
///  - Today's expenses total, pulled live from the expense ledger.
///
/// A single stream subscription (products) keeps rebuilds cheap; the expense
/// total is computed from the already-cached expense list.
class StoreOpsStrip extends StatefulWidget {
  final List<ExpenseModel> cachedExpenses;
  final Stream<List<Product>> productStream;
  final List<Product>? initialProducts;

  const StoreOpsStrip({
    super.key,
    required this.cachedExpenses,
    required this.productStream,
    this.initialProducts,
  });

  @override
  State<StoreOpsStrip> createState() => _StoreOpsStripState();
}

class _StoreOpsStripState extends State<StoreOpsStrip> {
  StreamSubscription<List<Product>>? _productSub;
  List<Product>? _products;

  @override
  void initState() {
    super.initState();
    _products = widget.initialProducts;
    _productSub = widget.productStream.listen((products) {
      if (mounted) setState(() => _products = products);
    }, onError: (_) {
      // Stream errors are non-fatal: the strip simply keeps its last data.
    });
  }

  @override
  void didUpdateWidget(covariant StoreOpsStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.productStream != oldWidget.productStream) {
      _productSub?.cancel();
      _productSub = widget.productStream.listen((products) {
        if (mounted) setState(() => _products = products);
      }, onError: (_) {});
    }
  }

  @override
  void dispose() {
    _productSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final products = _products ?? const <Product>[];
    final lowStock = products
        .where((p) => p.stock > 0 && p.stock < 15)
        .toList()
      ..sort((a, b) => a.stock.compareTo(b.stock));
    final outOfStock = products.where((p) => p.stock <= 0).toList();

    final now = DateTime.now();
    final todaysExpenses = widget.cachedExpenses.where((e) {
      final ts = DateTime.tryParse(e.timestamp) ??
          AppDateUtils.parseDateTime(e.timestamp);
      if (ts == null) return false;
      final local = ts.isUtc ? ts.toLocal() : ts;
      return local.year == now.year &&
          local.month == now.month &&
          local.day == now.day;
    }).toList();
    final todaysExpenseTotal =
        todaysExpenses.fold<double>(0, (sum, e) => sum + e.amount);

    final hasAlerts = lowStock.isNotEmpty || outOfStock.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isCompact = constraints.maxWidth < 380;
          final alertCard = _buildCard(
            kind: _OpsCardKind.alerts,
            isCompact: isCompact,
            child: hasAlerts
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _badge('${outOfStock.length}', AppTheme.errorRed),
                          const SizedBox(width: 6),
                          _badge('${lowStock.length}', AppTheme.warningOrange),
                          const SizedBox(width: 6),
                          const Icon(
                            CupertinoIcons.exclamationmark_triangle_fill,
                            size: 13,
                            color: AppTheme.warningOrange,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Items need restocking',
                        style: AppTheme.labelSmall.copyWith(
                          color: AppTheme.textSecondary,
                          fontSize: 10,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      const Icon(
                        CupertinoIcons.checkmark_seal_fill,
                        size: 16,
                        color: AppTheme.successGreen,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Inventory healthy',
                        style: AppTheme.labelSmall.copyWith(
                          color: AppTheme.textSecondary,
                          fontSize: 10,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
          );

          final expenseCard = _buildCard(
            kind: _OpsCardKind.expenses,
            isCompact: isCompact,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Icon(
                  CupertinoIcons.money_dollar_circle_fill,
                  size: 16,
                  color: AppTheme.errorRed,
                ),
                const SizedBox(height: 6),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.center,
                  child: Text(
                    'PKR ${todaysExpenseTotal.toStringAsFixed(0)}',
                    style: AppTheme.titleMedium.copyWith(
                      fontWeight: FontWeight.w800,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
                Text(
                  'Today\'s expenses',
                  style: AppTheme.labelSmall.copyWith(
                    color: AppTheme.textSecondary,
                    fontSize: 10,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );

          if (isCompact) {
            return Column(
              children: [
                alertCard,
                const SizedBox(height: AppTheme.spacingS),
                expenseCard,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: alertCard),
              const SizedBox(width: AppTheme.spacingM),
              Expanded(child: expenseCard),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCard({
    required _OpsCardKind kind,
    required bool isCompact,
    required Widget child,
  }) {
    return GlassCard(
      onTap: () {
        Navigator.push(
          context,
          CupertinoPageRoute(
            builder: (_) => kind == _OpsCardKind.alerts
                ? const CatalogScreen()
                : const ExpensesScreen(),
          ),
        );
      },
      borderRadius: AppTheme.radiusM,
      padding: EdgeInsets.all(isCompact ? 12 : 14),
      borderColor: kind == _OpsCardKind.alerts
          ? AppTheme.warningOrange.withValues(alpha: 0.30)
          : AppTheme.errorRed.withValues(alpha: 0.30),
      child: child,
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: color,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}
