import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/executive_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';
import 'package:ssmart_pos_admin/core/widgets/liquid_scaffold.dart';
import 'package:ssmart_pos_admin/core/widgets/staggered_entrance.dart';
import 'package:ssmart_pos_admin/features/dashboard/screens/daily_closings_screen.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/executive_hero_card.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/executive_metric_card.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/executive_sales_chart.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/recent_transactions.dart';
import 'package:ssmart_pos_admin/features/licensing/screens/license_manager_screen.dart';
import 'package:ssmart_pos_admin/features/pos/screens/mobile_checkout_screen.dart';
import 'package:ssmart_pos_admin/features/transactions/screens/transactions_screen.dart';
import 'package:ssmart_pos_admin/features/catalog/screens/catalog_screen.dart';
import 'package:ssmart_pos_admin/features/customers/screens/customers_khata_screen.dart';
import 'package:ssmart_pos_admin/features/expenses/screens/expenses_screen.dart';
import 'package:ssmart_pos_admin/features/vendors/screens/vendors_screen.dart';
import 'package:ssmart_pos_admin/models/dashboard_metrics.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/store_ops_strip.dart';
import 'package:ssmart_pos_admin/services/auth_service.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/license_banner.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';
import 'package:ssmart_pos_admin/widgets/manual_closing_dialog.dart';

/// Executive Dark dashboard — "Option A" premium redesign.
///
/// Every section arrives in a staggered cascade, numbers count up, and the
/// whole screen speaks the haptic vocabulary: taps tick, primary actions
/// knock, the chart scrubs, and a long-press on the hero copies the daily
/// closing summary.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  /// Bumped on every successful refresh so entrance animations replay.
  int _refreshCycle = 0;

  Future<void> _handleRefresh() async {
    try {
      final firebaseService = context.read<FirebaseService>();
      await firebaseService
          .getSalesStream()
          .first
          .timeout(const Duration(seconds: 4));
      await Haptics.success();
      if (mounted) setState(() => _refreshCycle++);
    } catch (_) {
      // Stream timeout or network fallback, state remains stable
    }
  }

  void _handleLogout() {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.pop(context),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () async {
              await Haptics.medium();
              if (context.mounted) Navigator.pop(context);
              await context.read<AuthService>().signOut();
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  /// Yesterday's revenue, for the hero delta pill.
  double _yesterdayRevenue(List<Sale> sales) {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day - 1);
    final end = DateTime(now.year, now.month, now.day);
    double total = 0;
    for (final s in sales) {
      final ts = AppDateUtils.parseDateTime(s.timestamp);
      if (ts == null) continue;
      final local = ts.isUtc ? ts.toLocal() : ts;
      if (!local.isBefore(start) && local.isBefore(end)) total += s.total;
    }
    return total;
  }

  /// Shared by the hero long-press and the Copy Note button.
  Future<void> _copyDailySummary(DashboardMetrics m) async {
    final now = DateTime.now();
    final dateFormatted = '${now.day}/${now.month}/${now.year}';
    final timeFormatted =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    final cashRev = m.revenueByPaymentMethod.entries
        .where((e) => e.key.toLowerCase().contains('cash'))
        .fold<double>(0.0, (sum, e) => sum + e.value);
    final onlineRev = m.revenueByPaymentMethod.entries
        .where((e) =>
            e.key.toLowerCase().contains('online') ||
            e.key.toLowerCase().contains('bank') ||
            e.key.toLowerCase().contains('card') ||
            e.key.toLowerCase().contains('jazz') ||
            e.key.toLowerCase().contains('easy'))
        .fold<double>(0.0, (sum, e) => sum + e.value);
    final khataRev = m.revenueByPaymentMethod.entries
        .where((e) =>
            e.key.toLowerCase().contains('khata') ||
            e.key.toLowerCase().contains('credit'))
        .fold<double>(0.0, (sum, e) => sum + e.value);

    final text = '🏪 *SS MART*\n'
        '📅 *DAILY CLOSING SALES NOTE*\n'
        '──────────────────────\n'
        '🗓️ *Date:* $dateFormatted\n'
        '⏰ *Time Recorded:* $timeFormatted\n'
        '──────────────────────\n'
        '📦 *Total Orders Completed:* ${m.transactionCount}\n'
        '✨ *NET DAILY SALES:* Rs. ${m.totalRevenue.toStringAsFixed(2)}\n'
        '──────────────────────\n'
        '💳 *PAYMENT BREAKDOWN:*\n'
        '• Cash in Drawer: Rs. ${cashRev.toStringAsFixed(2)}\n'
        '• Online / Bank / Card: Rs. ${onlineRev.toStringAsFixed(2)}\n'
        '• Khata / Credit: Rs. ${khataRev.toStringAsFixed(2)}\n'
        '──────────────────────\n'
        '✅ *Generated via SS MART Admin Mobile*';

    await Clipboard.setData(ClipboardData(text: text));
    await Haptics.success();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('✅ Daily closing note copied to clipboard!'),
        backgroundColor: ExecutiveTheme.goldDeep,
        duration: Duration(seconds: 2),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.read<AuthService>();
    final firebaseService = context.read<FirebaseService>();

    return LiquidScaffold(
      executiveAmbience: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Container(
              height: 34,
              width: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                gradient: const LinearGradient(
                  colors: [ExecutiveTheme.goldLight, ExecutiveTheme.goldDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: ExecutiveTheme.gold.withValues(alpha: 0.35),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: const Text(
                'SS',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: ExecutiveTheme.navyDeep,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SS MART',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: ExecutiveTheme.ink,
                  ),
                ),
                StreamBuilder<ConnectionStatus>(
                  stream: firebaseService.connectionStatusStream,
                  builder: (context, snapshot) {
                    final status =
                        snapshot.data ?? ConnectionStatus.connecting;
                    final online = status.isOnline;
                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: online
                                ? ExecutiveTheme.successMint
                                : ExecutiveTheme.slateDim,
                            boxShadow: online
                                ? [
                                    BoxShadow(
                                      color: ExecutiveTheme.successMint
                                          .withValues(alpha: 0.8),
                                      blurRadius: 6,
                                    )
                                  ]
                                : null,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          status.displayName,
                          style: AppTheme.labelSmall.copyWith(
                            fontSize: 10,
                            color: online
                                ? ExecutiveTheme.successMint
                                : ExecutiveTheme.slate,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ],
        ),
        actions: [
          _appBarAction(
            icon: CupertinoIcons.cart_badge_plus,
            tooltip: 'Mobile POS Billing',
            onTap: () => _go(const MobileCheckoutScreen()),
          ),
          _appBarAction(
            icon: CupertinoIcons.calendar_badge_plus,
            tooltip: 'Daily Closing Sales',
            onTap: () => _go(const DailyClosingsScreen()),
          ),
          _appBarAction(
            icon: CupertinoIcons.square_grid_2x2_fill,
            tooltip: 'Items Catalog',
            onTap: () => _go(const CatalogScreen()),
          ),
          PopupMenuButton<String>(
            icon: const Icon(CupertinoIcons.person_circle,
                color: ExecutiveTheme.gold),
            offset: const Offset(0, 50),
            onSelected: (value) async {
              await Haptics.tap();
              if (!context.mounted) return;
              if (value == 'logout') {
                _handleLogout();
              } else if (value == 'licenses') {
                _go(const LicenseManagerScreen());
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(authService.userDisplayName,
                        style: AppTheme.titleMedium),
                    if (authService.userEmail != null)
                      Text(authService.userEmail!,
                          style: AppTheme.bodySmall),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'licenses',
                child: Row(
                  children: [
                    Icon(CupertinoIcons.shield,
                        size: 18, color: ExecutiveTheme.gold),
                    SizedBox(width: 8),
                    Text('License Manager'),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(CupertinoIcons.square_arrow_right, size: 18),
                    SizedBox(width: 8),
                    Text('Sign Out'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: GestureDetector(
        onTap: () async {
          await Haptics.medium();
          if (context.mounted) _go(const MobileCheckoutScreen());
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: const LinearGradient(
              colors: [ExecutiveTheme.goldLight, ExecutiveTheme.goldDeep],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: ExecutiveTheme.gold.withValues(alpha: 0.4),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(CupertinoIcons.cart_fill,
                  color: ExecutiveTheme.navyDeep, size: 19),
              SizedBox(width: 8),
              Text(
                'Make Bill / POS',
                style: TextStyle(
                  color: ExecutiveTheme.navyDeep,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          const LicenseBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _handleRefresh,
              color: ExecutiveTheme.gold,
              child: StreamBuilder<List<Sale>>(
                initialData: firebaseService.cachedSales,
                stream: firebaseService.getSalesStream(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState ==
                          ConnectionState.waiting &&
                      (!snapshot.hasData || snapshot.data == null)) {
                    return const AppLoadingIndicator(
                      message: 'Loading dashboard...',
                    );
                  }
                  if (snapshot.hasError &&
                      (!snapshot.hasData || snapshot.data == null)) {
                    return AppErrorWidget(
                      message: 'Failed to load sales data',
                      error: snapshot.error.toString(),
                      onRetry: _handleRefresh,
                    );
                  }
                  if (!snapshot.hasData || snapshot.data!.isEmpty) {
                    return _buildEmptyState();
                  }

                  final allSales = snapshot.data!;
                  final todaysMetrics =
                      DashboardMetrics.todayFromSales(allSales);
                  final weekMetrics = DashboardMetrics.fromSales(
                    allSales,
                    daysHistory: AppConstants.chartDaysHistory,
                  );
                  final yesterdayRev = _yesterdayRevenue(allSales);

                  return _buildDashboardContent(
                    todaysMetrics: todaysMetrics,
                    weekMetrics: weekMetrics,
                    yesterdayRevenue: yesterdayRev,
                    recentTransactions: allSales
                        .take(AppConstants.recentTransactionsLimit)
                        .toList(),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _appBarAction({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return IconButton(
      icon: Icon(icon, color: ExecutiveTheme.gold),
      tooltip: tooltip,
      onPressed: () async {
        await Haptics.tap();
        onTap();
      },
    );
  }

  void _go(Widget screen) {
    Navigator.push(
      context,
      CupertinoPageRoute(builder: (_) => screen),
    );
  }

  Widget _buildDashboardContent({
    required DashboardMetrics todaysMetrics,
    required DashboardMetrics weekMetrics,
    required double yesterdayRevenue,
    required List<Sale> recentTransactions,
  }) {
    final deltaPct = yesterdayRevenue > 0
        ? (todaysMetrics.totalRevenue - yesterdayRevenue) /
            yesterdayRevenue *
            100
        : 0.0;
    final now = DateTime.now();
    final dateLabel =
        '${_weekday(now.weekday)}, ${now.day} ${_month(now.month)}';

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingM),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Greeting
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: StaggeredEntrance(
              delay: Duration.zero,
              repeatKey: _refreshCycle,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_greeting()}, ${context.read<AuthService>().userDisplayName.split(' ').first}',
                    style: ExecutiveTheme.bodyGold.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Here\'s your store today · $dateLabel',
                    style: ExecutiveTheme.metricLabel,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppTheme.spacingM),

          // Hero — animated revenue, long-press copies summary
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: StaggeredEntrance(
              delay: const Duration(milliseconds: 70),
              repeatKey: _refreshCycle,
              child: ExecutiveHeroCard(
                revenue: todaysMetrics.totalRevenue,
                orderCount: todaysMetrics.transactionCount,
                averageOrder: todaysMetrics.averageTransactionValue,
                deltaPct: deltaPct,
                dateLabel: dateLabel,
                onCopySummary: () => _copyDailySummary(todaysMetrics),
              ),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Quick actions
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: StaggeredEntrance(
              delay: const Duration(milliseconds: 140),
              repeatKey: _refreshCycle,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('QUICK ACTIONS', style: ExecutiveTheme.sectionLabel),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _quickAction(
                          'New Bill',
                          'POS',
                          CupertinoIcons.cart_fill,
                          () => _go(const MobileCheckoutScreen()),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _quickAction(
                          'Khata',
                          'Udhaar',
                          CupertinoIcons.book_fill,
                          () => _go(const CustomersKhataScreen()),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _quickAction(
                          'Expenses',
                          'Ledger',
                          CupertinoIcons.money_dollar_circle_fill,
                          () => _go(const ExpensesScreen()),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _quickAction(
                          'Vendors',
                          'Stock',
                          CupertinoIcons.cube_box_fill,
                          () => _go(const VendorsScreen()),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Store ops strip (stock alerts + expenses)
          StaggeredEntrance(
            delay: const Duration(milliseconds: 210),
            repeatKey: _refreshCycle,
            child: StoreOpsStrip(
              cachedExpenses:
                  context.read<FirebaseService>().cachedExpenses ?? const [],
              productStream:
                  context.read<FirebaseService>().getProductsStream(),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Metrics grid
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: StaggeredEntrance(
              delay: const Duration(milliseconds: 280),
              repeatKey: _refreshCycle,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('PERFORMANCE',
                          style: ExecutiveTheme.sectionLabel),
                      Text(
                        '${todaysMetrics.transactionCount} orders',
                        style: ExecutiveTheme.deltaUp.copyWith(
                          color: ExecutiveTheme.gold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.32,
                    children: [
                      ExecutiveMetricCard(
                        label: 'Revenue',
                        value: AppDateUtils.formatCurrency(
                            todaysMetrics.totalRevenue),
                        delta:
                            '${deltaPct >= 0 ? '▲' : '▼'} ${deltaPct.abs().toStringAsFixed(1)}% vs yesterday',
                        deltaPositive: deltaPct >= 0,
                        icon: CupertinoIcons.money_dollar_circle_fill,
                        onTap: () => _go(const TransactionsScreen()),
                      ),
                      ExecutiveMetricCard(
                        label: 'Orders',
                        value: '${todaysMetrics.transactionCount}',
                        delta: 'completed today',
                        icon: CupertinoIcons.doc_text_fill,
                        onTap: () => _go(const TransactionsScreen()),
                      ),
                      ExecutiveMetricCard(
                        label: 'Avg order',
                        value: AppDateUtils.formatCurrency(
                            todaysMetrics.averageTransactionValue),
                        delta: 'per transaction',
                        icon: CupertinoIcons.chart_bar_fill,
                      ),
                      ExecutiveMetricCard(
                        label: 'Top method',
                        value: todaysMetrics.mostPopularPaymentMethod,
                        delta: 'payment method',
                        icon: CupertinoIcons.creditcard_fill,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Weekly chart
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: StaggeredEntrance(
              delay: const Duration(milliseconds: 350),
              repeatKey: _refreshCycle,
              child: ExecutiveSalesChart(
                  dailyRevenue: weekMetrics.dailyRevenue),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Daily closing card
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: StaggeredEntrance(
              delay: const Duration(milliseconds: 420),
              repeatKey: _refreshCycle,
              child: _closingCard(todaysMetrics),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Recent transactions
          StaggeredEntrance(
            delay: const Duration(milliseconds: 490),
            repeatKey: _refreshCycle,
            child: RecentTransactions(
              transactions: recentTransactions,
              onViewAll: () async {
                await Haptics.tap();
                if (context.mounted) _go(const TransactionsScreen());
              },
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),
        ],
      ),
    );
  }

  /// Executive-styled daily closing card (gold accents, haptic buttons).
  Widget _closingCard(DashboardMetrics m) {
    return Container(
      decoration: ExecutiveTheme.cardDecoration.copyWith(
        border: Border.all(
          color: ExecutiveTheme.gold.withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: ExecutiveTheme.gold.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppTheme.spacingM),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: ExecutiveTheme.goldFaint,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: ExecutiveTheme.gold.withValues(alpha: 0.3),
                  ),
                ),
                child: const Icon(
                  CupertinoIcons.doc_on_clipboard_fill,
                  color: ExecutiveTheme.gold,
                  size: 16,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'Daily Closing',
                style: ExecutiveTheme.bodyGold.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
              const Spacer(),
              _closingBtn(
                'View All',
                CupertinoIcons.calendar,
                ExecutiveTheme.gold,
                () => _go(const DailyClosingsScreen()),
              ),
              const SizedBox(width: 6),
              _closingBtn(
                'Add',
                CupertinoIcons.plus,
                ExecutiveTheme.successMint,
                () => ManualClosingDialog.show(context),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('NET DAILY SALES',
                        style: ExecutiveTheme.metricLabel),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        AppDateUtils.formatCurrency(m.totalRevenue),
                        style: ExecutiveTheme.metricValue.copyWith(
                          fontSize: 24,
                          color: ExecutiveTheme.goldLight,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () async {
                  await Haptics.medium();
                  _copyDailySummary(m);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        ExecutiveTheme.goldLight,
                        ExecutiveTheme.goldDeep
                      ],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(CupertinoIcons.doc_on_clipboard,
                          size: 14, color: ExecutiveTheme.navyDeep),
                      SizedBox(width: 6),
                      Text(
                        'Copy Note',
                        style: TextStyle(
                          color: ExecutiveTheme.navyDeep,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (m.revenueByPaymentMethod.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: m.revenueByPaymentMethod.entries.map((e) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: ExecutiveTheme.cardSurface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: ExecutiveTheme.cardBorder),
                  ),
                  child: Text(
                    '${e.key}: Rs. ${e.value.toInt()}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: ExecutiveTheme.slate,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _closingBtn(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: () async {
        await Haptics.tap();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickAction(
    String title,
    String subtitle,
    IconData icon,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: () async {
        await Haptics.tap();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 4),
        decoration: ExecutiveTheme.cardDecoration.copyWith(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ExecutiveTheme.goldFaint,
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: ExecutiveTheme.gold.withValues(alpha: 0.25),
                ),
              ),
              child: Icon(icon, color: ExecutiveTheme.gold, size: 19),
            ),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: ExecutiveTheme.ink,
                ),
                maxLines: 1,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 9,
                color: ExecutiveTheme.slateDim,
              ),
              maxLines: 1,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: ExecutiveTheme.goldFaint,
                shape: BoxShape.circle,
                border: Border.all(
                  color: ExecutiveTheme.gold.withValues(alpha: 0.3),
                ),
              ),
              child: const Icon(
                CupertinoIcons.chart_bar_square,
                size: 44,
                color: ExecutiveTheme.gold,
              ),
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text('No Sales Data Yet',
                style: ExecutiveTheme.bodyGold.copyWith(
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                )),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Sales from your POS system will appear here in real-time.',
              style: AppTheme.bodyMedium.copyWith(
                color: ExecutiveTheme.slate,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingL),
            GestureDetector(
              onTap: () async {
                await Haptics.medium();
                _handleRefresh();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 22, vertical: 12),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [
                      ExecutiveTheme.goldLight,
                      ExecutiveTheme.goldDeep
                    ],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(CupertinoIcons.refresh,
                        color: ExecutiveTheme.navyDeep, size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Refresh',
                      style: TextStyle(
                        color: ExecutiveTheme.navyDeep,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _weekday(int w) {
    const d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return d[w - 1];
  }

  String _month(int m) {
    const mo = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return mo[m - 1];
  }
}
