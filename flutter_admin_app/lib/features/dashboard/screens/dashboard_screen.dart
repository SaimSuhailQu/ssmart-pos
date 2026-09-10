import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/metric_card.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/recent_transactions.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/sales_chart.dart';
import 'package:ssmart_pos_admin/features/pos/screens/mobile_checkout_screen.dart';
import 'package:ssmart_pos_admin/features/transactions/screens/transactions_screen.dart';
import 'package:ssmart_pos_admin/features/catalog/screens/catalog_screen.dart';
import 'package:ssmart_pos_admin/features/customers/screens/customers_khata_screen.dart';
import 'package:ssmart_pos_admin/features/expenses/screens/expenses_screen.dart';
import 'package:ssmart_pos_admin/features/vendors/screens/vendors_screen.dart';
import 'package:ssmart_pos_admin/models/dashboard_metrics.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/services/auth_service.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';
import 'package:ssmart_pos_admin/widgets/manual_closing_dialog.dart';

/// Main dashboard screen showing sales metrics and recent transactions
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Future<void> _handleRefresh() async {
    try {
      final firebaseService = context.read<FirebaseService>();
      await firebaseService.getSalesStream().first.timeout(const Duration(seconds: 4));
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
              Navigator.pop(context);
              await context.read<AuthService>().signOut();
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.read<AuthService>();
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/images/ss_mart_logo.png',
                height: 32,
                width: 32,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => const Icon(
                  CupertinoIcons.chart_bar_square_fill,
                  size: 28,
                  color: AppTheme.primaryCyan,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('SSmart Admin', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                StreamBuilder<ConnectionStatus>(
                  stream: firebaseService.connectionStatusStream,
                  builder: (context, snapshot) {
                    final status = snapshot.data ?? ConnectionStatus.connecting;
                    return Text(
                      status.displayName,
                      style: AppTheme.labelSmall.copyWith(
                        fontSize: 10,
                        color: status.isOnline
                            ? AppTheme.successGreen
                            : AppTheme.textSecondary,
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.cart_badge_plus, color: AppTheme.primaryCyan),
            tooltip: 'Mobile POS Billing',
            onPressed: () {
              Navigator.push(
                context,
                CupertinoPageRoute(
                  builder: (context) => const MobileCheckoutScreen(),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(CupertinoIcons.square_grid_2x2_fill),
            tooltip: 'Items Catalog',
            onPressed: () {
              Navigator.push(
                context,
                CupertinoPageRoute(
                  builder: (context) => const CatalogScreen(),
                ),
              );
            },
          ),
          // User info and logout
          PopupMenuButton<String>(
            icon: const Icon(CupertinoIcons.person_circle),
            offset: const Offset(0, 50),
            onSelected: (value) {
              if (value == 'logout') {
                _handleLogout();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      authService.userDisplayName,
                      style: AppTheme.titleMedium,
                    ),
                    if (authService.userEmail != null)
                      Text(
                        authService.userEmail!,
                        style: AppTheme.bodySmall,
                      ),
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
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primaryCyan,
        icon: const Icon(CupertinoIcons.cart_fill, color: Colors.black),
        label: const Text(
          'Make Bill / POS',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 15),
        ),
        onPressed: () {
          Navigator.push(
            context,
            CupertinoPageRoute(
              builder: (context) => const MobileCheckoutScreen(),
            ),
          );
        },
      ),
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: StreamBuilder<List<Sale>>(
          initialData: firebaseService.cachedSales,
          stream: firebaseService.getSalesStream(),
          builder: (context, snapshot) {
            // Loading state - only display full-screen loading spinner if there is no data at all yet
            if (snapshot.connectionState == ConnectionState.waiting && (!snapshot.hasData || snapshot.data == null)) {
              return const AppLoadingIndicator(
                message: 'Loading dashboard...',
              );
            }

            // Error state - only display error if we don't already have data to show
            if (snapshot.hasError && (!snapshot.hasData || snapshot.data == null)) {
              return AppErrorWidget(
                message: 'Failed to load sales data',
                error: snapshot.error.toString(),
                onRetry: _handleRefresh,
              );
            }

            // Empty state
            if (!snapshot.hasData || snapshot.data!.isEmpty) {
              return _buildEmptyState();
            }

            final allSales = snapshot.data!;
            final todaysMetrics = DashboardMetrics.todayFromSales(allSales);
            final weekMetrics = DashboardMetrics.fromSales(
              allSales,
              daysHistory: AppConstants.chartDaysHistory,
            );

            return _buildDashboardContent(
              todaysMetrics: todaysMetrics,
              weekMetrics: weekMetrics,
              recentTransactions: allSales.take(
                AppConstants.recentTransactionsLimit,
              ).toList(),
            );
          },
        ),
      ),
    );
  }

  Widget _buildDashboardContent({
    required DashboardMetrics todaysMetrics,
    required DashboardMetrics weekMetrics,
    required List<Sale> recentTransactions,
  }) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingM),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick Navigation Hub
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: Row(
              children: [
                Expanded(
                  child: _buildQuickNavCard(
                    title: 'New Bill',
                    subtitle: 'Mobile POS',
                    icon: CupertinoIcons.cart_fill,
                    color: AppTheme.primaryCyan,
                    onTap: () => Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const MobileCheckoutScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingXS),
                Expanded(
                  child: _buildQuickNavCard(
                    title: 'Khata',
                    subtitle: 'CRM & Udhaar',
                    icon: CupertinoIcons.book_fill,
                    color: Colors.amber.shade700,
                    onTap: () => Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const CustomersKhataScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingXS),
                Expanded(
                  child: _buildQuickNavCard(
                    title: 'Expenses',
                    subtitle: 'Cost Ledger',
                    icon: CupertinoIcons.money_dollar_circle_fill,
                    color: Colors.redAccent,
                    onTap: () => Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const ExpensesScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingXS),
                Expanded(
                  child: _buildQuickNavCard(
                    title: 'Vendors',
                    subtitle: 'POs & Stocks',
                    icon: CupertinoIcons.cube_box_fill,
                    color: Colors.purpleAccent,
                    onTap: () => Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const VendorsScreen()),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Today's metrics header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Today\'s Performance',
                  style: AppTheme.titleLarge,
                ),
                Text(
                  '${todaysMetrics.transactionCount} Orders',
                  style: AppTheme.labelSmall.copyWith(
                    color: AppTheme.primaryCyan,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTheme.spacingM),

          // Daily Sales Closing Note Card with 1-Click Copy
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: Container(
              padding: const EdgeInsets.all(AppTheme.spacingM),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF0F2E22),
                    AppTheme.surfaceDark,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppTheme.radiusM),
                border: Border.all(
                  color: AppTheme.successGreen.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppTheme.successGreen.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              CupertinoIcons.sparkles,
                              color: AppTheme.successGreen,
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Daily Closing Note',
                            style: AppTheme.titleMedium.copyWith(
                              color: AppTheme.successGreen,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => ManualClosingDialog.show(context),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppTheme.successGreen,
                              side: const BorderSide(color: AppTheme.successGreen, width: 1),
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            icon: const Icon(CupertinoIcons.plus, size: 12, color: AppTheme.successGreen),
                            label: const Text(
                              'Add Closing',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                            ),
                          ),
                          const SizedBox(width: 6),
                          ElevatedButton.icon(
                            onPressed: () {
                              final now = DateTime.now();
                              final dateFormatted = '${now.day}/${now.month}/${now.year}';
                              final timeFormatted = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
                              
                              // Payment breakdown
                              final cashRev = todaysMetrics.revenueByPaymentMethod.entries
                                  .where((e) => e.key.toLowerCase().contains('cash'))
                                  .fold<double>(0.0, (sum, e) => sum + e.value);
                              final onlineRev = todaysMetrics.revenueByPaymentMethod.entries
                                  .where((e) => e.key.toLowerCase().contains('online') || e.key.toLowerCase().contains('bank') || e.key.toLowerCase().contains('card') || e.key.toLowerCase().contains('jazz') || e.key.toLowerCase().contains('easy'))
                                  .fold<double>(0.0, (sum, e) => sum + e.value);
                              final khataRev = todaysMetrics.revenueByPaymentMethod.entries
                                  .where((e) => e.key.toLowerCase().contains('khata') || e.key.toLowerCase().contains('credit'))
                                  .fold<double>(0.0, (sum, e) => sum + e.value);

                              final text = '🏪 *SS MART & GENERAL STORE*\n'
                                  '📅 *DAILY CLOSING SALES NOTE*\n'
                                  '──────────────────────\n'
                                  '🗓️ *Date:* $dateFormatted\n'
                                  '⏰ *Time Recorded:* $timeFormatted\n'
                                  '──────────────────────\n'
                                  '📦 *Total Orders Completed:* ${todaysMetrics.transactionCount}\n'
                                  '✨ *NET DAILY SALES:* Rs. ${todaysMetrics.totalRevenue.toStringAsFixed(2)}\n'
                                  '──────────────────────\n'
                                  '💳 *PAYMENT BREAKDOWN:*\n'
                                  '• Cash in Drawer: Rs. ${cashRev.toStringAsFixed(2)}\n'
                                  '• Online / Bank / Card: Rs. ${onlineRev.toStringAsFixed(2)}\n'
                                  '• Khata / Credit: Rs. ${khataRev.toStringAsFixed(2)}\n'
                                  '──────────────────────\n'
                                  '✅ *Generated via SSmart Admin Mobile*';

                              Clipboard.setData(ClipboardData(text: text));
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('✅ Daily closing note copied to clipboard!'),
                                  backgroundColor: AppTheme.successGreen,
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.successGreen,
                              foregroundColor: Colors.black,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            icon: const Icon(CupertinoIcons.doc_on_clipboard, size: 12, color: Colors.black),
                            label: const Text(
                              'Copy Note',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.end,
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Today\'s Total Closing Sales',
                            style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            AppDateUtils.formatCurrency(todaysMetrics.totalRevenue),
                            style: AppTheme.titleLarge.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 22,
                              fontFeatures: const [FontFeature.tabularFigures()],
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black45,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Text(
                          '${todaysMetrics.transactionCount} Bills Recorded',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppTheme.textSecondary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (todaysMetrics.revenueByPaymentMethod.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: todaysMetrics.revenueByPaymentMethod.entries.map((entry) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.black38,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Text(
                            '${entry.key}: Rs. ${entry.value.toInt()}',
                            style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: AppTheme.spacingL),

          // Metrics grid
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: AppTheme.spacingM,
              crossAxisSpacing: AppTheme.spacingM,
              childAspectRatio: MediaQuery.of(context).size.width < 390 ? 1.05 : 1.15,
              children: [
                MetricCard(
                  label: 'Total Revenue',
                  value: AppDateUtils.formatCurrency(todaysMetrics.totalRevenue),
                  icon: CupertinoIcons.money_dollar_circle_fill,
                  color: AppTheme.successGreen,
                  subtitle: 'Today',
                ),
                MetricCard(
                  label: 'Transactions',
                  value: AppDateUtils.formatNumber(
                    todaysMetrics.transactionCount,
                  ),
                  icon: CupertinoIcons.doc_text_fill,
                  color: AppTheme.primaryBlue,
                  subtitle: 'Completed',
                ),
                MetricCard(
                  label: 'Average Sale',
                  value: AppDateUtils.formatCurrency(
                    todaysMetrics.averageTransactionValue,
                  ),
                  icon: CupertinoIcons.chart_bar_fill,
                  color: AppTheme.secondaryBlue,
                  subtitle: 'Per transaction',
                ),
                MetricCard(
                  label: 'Top Method',
                  value: todaysMetrics.mostPopularPaymentMethod,
                  icon: CupertinoIcons.creditcard_fill,
                  color: AppTheme.warningOrange,
                  subtitle: 'Payment method',
                ),
              ],
            ),
          ),

          const SizedBox(height: AppTheme.spacingL),

          // Sales trend chart
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: SalesChart(dailyRevenue: weekMetrics.dailyRevenue),
          ),

          const SizedBox(height: AppTheme.spacingL),

          // Recent transactions
          RecentTransactions(
            transactions: recentTransactions,
            onViewAll: () {
              Navigator.push(
                context,
                CupertinoPageRoute(
                  builder: (context) => const TransactionsScreen(),
                ),
              );
            },
          ),

          const SizedBox(height: AppTheme.spacingL),
        ],
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
            const Icon(
              CupertinoIcons.chart_bar_square,
              size: 80,
              color: AppTheme.textTertiary,
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text(
              'No Sales Data Yet',
              style: AppTheme.headlineMedium,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Sales from your POS system will appear here in real-time.',
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingL),
            ElevatedButton.icon(
              onPressed: _handleRefresh,
              icon: const Icon(CupertinoIcons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickNavCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: AppTheme.cardBackground,
          borderRadius: BorderRadius.circular(AppTheme.radiusM),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 9,
                color: AppTheme.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
