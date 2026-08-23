import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/metric_card.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/recent_transactions.dart';
import 'package:ssmart_pos_admin/features/dashboard/widgets/sales_chart.dart';
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

/// Main dashboard screen showing sales metrics and recent transactions
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Future<void> _handleRefresh() async {
    // Clear cache to force fresh data
    context.read<FirebaseService>().clearCache();

    // Wait a moment for the stream to emit new data
    await Future.delayed(const Duration(seconds: 1));
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Dashboard'),
            StreamBuilder<ConnectionStatus>(
              stream: firebaseService.connectionStatusStream,
              builder: (context, snapshot) {
                final status = snapshot.data ?? ConnectionStatus.connecting;
                return Text(
                  status.displayName,
                  style: AppTheme.labelSmall.copyWith(
                    color: status.isOnline
                        ? AppTheme.successGreen
                        : AppTheme.textSecondary,
                  ),
                );
              },
            ),
          ],
        ),
        actions: [
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
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        child: StreamBuilder<List<Sale>>(
          stream: firebaseService.getSalesStream(),
          builder: (context, snapshot) {
            // Loading state
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const AppLoadingIndicator(
                message: 'Loading dashboard...',
              );
            }

            // Error state
            if (snapshot.hasError) {
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
                    title: 'Khata / Loans',
                    subtitle: 'CRM & Udhaar',
                    icon: CupertinoIcons.book_fill,
                    color: Colors.amber.shade700,
                    onTap: () => Navigator.push(
                      context,
                      CupertinoPageRoute(builder: (_) => const CustomersKhataScreen()),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingS),
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
                const SizedBox(width: AppTheme.spacingS),
                Expanded(
                  child: _buildQuickNavCard(
                    title: 'Vendors',
                    subtitle: 'POs & Stocks',
                    icon: CupertinoIcons.cube_box_fill,
                    color: Colors.purple,
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
            child: Text(
              'Today\'s Performance',
              style: AppTheme.titleLarge,
            ),
          ),
          const SizedBox(height: AppTheme.spacingM),

          // Metrics grid
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
            child: GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: AppTheme.spacingM,
              crossAxisSpacing: AppTheme.spacingM,
              childAspectRatio: 1.3,
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
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: AppTheme.cardBackground,
          borderRadius: BorderRadius.circular(AppTheme.radiusM),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 9,
                color: AppTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
