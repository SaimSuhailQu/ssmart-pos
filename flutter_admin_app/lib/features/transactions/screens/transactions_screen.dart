import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';

/// Screen displaying all transactions with filtering and search
class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedFilter = 'All';

  final List<String> _filterOptions = [
    'All',
    'Today',
    'This Week',
    'This Month',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Sale> _filterSales(List<Sale> sales) {
    var filtered = sales;

    // Apply date filter
    if (_selectedFilter != 'All') {
      final now = DateTime.now();
      DateTime startDate;

      switch (_selectedFilter) {
        case 'Today':
          startDate = AppDateUtils.getStartOfToday();
          break;
        case 'This Week':
          startDate = now.subtract(const Duration(days: 7));
          break;
        case 'This Month':
          startDate = DateTime(now.year, now.month, 1);
          break;
        default:
          startDate = DateTime(2000, 1, 1);
      }

      filtered = filtered.where((sale) {
        try {
          final saleDate = DateTime.parse(sale.timestamp);
          return saleDate.isAfter(startDate);
        } catch (e) {
          return false;
        }
      }).toList();
    }

    // Apply search query
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((sale) {
        final matchesId = sale.id.toLowerCase().contains(query);
        final matchesAmount = sale.total.toString().contains(query);
        final matchesPayment =
            sale.paymentMethod.toLowerCase().contains(query);
        final matchesCashier =
            sale.userName?.toLowerCase().contains(query) ?? false;

        return matchesId ||
               matchesAmount ||
               matchesPayment ||
               matchesCashier;
      }).toList();
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('All Transactions'),
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          // Search and filter bar
          Container(
            color: AppTheme.cardBackground,
            padding: const EdgeInsets.all(AppTheme.spacingM),
            child: Column(
              children: [
                // Search field
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search transactions...',
                    prefixIcon: const Icon(CupertinoIcons.search),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(CupertinoIcons.xmark_circle_fill),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchQuery = '';
                              });
                            },
                          )
                        : null,
                  ),
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
                    });
                  },
                ),
                const SizedBox(height: AppTheme.spacingM),

                // Filter chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _filterOptions.map((filter) {
                      final isSelected = _selectedFilter == filter;
                      return Padding(
                        padding: const EdgeInsets.only(right: AppTheme.spacingS),
                        child: FilterChip(
                          label: Text(filter),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              _selectedFilter = filter;
                            });
                          },
                          backgroundColor: AppTheme.backgroundLight,
                          selectedColor: AppTheme.primaryBlue.withValues(alpha: 0.2),
                          labelStyle: AppTheme.bodyMedium.copyWith(
                            color: isSelected
                                ? AppTheme.primaryBlue
                                : AppTheme.textPrimary,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),

          // Transactions list
          Expanded(
            child: StreamBuilder<List<Sale>>(
              stream: firebaseService.getSalesStream(),
              builder: (context, snapshot) {
                // Loading state
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const AppLoadingIndicator(
                    message: 'Loading transactions...',
                  );
                }

                // Error state
                if (snapshot.hasError) {
                  return AppErrorWidget(
                    message: 'Failed to load transactions',
                    error: snapshot.error.toString(),
                    onRetry: () {
                      setState(() {});
                    },
                  );
                }

                // Empty state
                if (!snapshot.hasData || snapshot.data!.isEmpty) {
                  return _buildEmptyState();
                }

                final filteredSales = _filterSales(snapshot.data!);

                if (filteredSales.isEmpty) {
                  return _buildNoResultsState();
                }

                return _buildTransactionsList(filteredSales);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsList(List<Sale> sales) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingM),
      itemCount: sales.length,
      separatorBuilder: (context, index) => const SizedBox(
        height: AppTheme.spacingS,
      ),
      itemBuilder: (context, index) {
        final sale = sales[index];
        return _TransactionCard(sale: sale);
      },
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
              CupertinoIcons.doc_text,
              size: 80,
              color: AppTheme.textTertiary,
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text(
              'No Transactions Yet',
              style: AppTheme.headlineMedium,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Transactions from your POS will appear here.',
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoResultsState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXL),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              CupertinoIcons.search,
              size: 80,
              color: AppTheme.textTertiary,
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text(
              'No Results Found',
              style: AppTheme.headlineMedium,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Try adjusting your filters or search query.',
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingL),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _searchController.clear();
                  _searchQuery = '';
                  _selectedFilter = 'All';
                });
              },
              child: const Text('Clear Filters'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Individual transaction card
class _TransactionCard extends StatelessWidget {
  final Sale sale;

  const _TransactionCard({required this.sale});

  @override
  Widget build(BuildContext context) {
    final totalUnits = sale.items?.fold<int>(0, (sum, item) => sum + item.quantity) ?? 0;

    return Card(
      child: InkWell(
        onTap: () => _showTransactionDetails(context),
        borderRadius: BorderRadius.circular(AppTheme.radiusM),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingM),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row: Total Amount + Payment Chip
              Row(
                children: [
                  Expanded(
                    child: Text(
                      AppDateUtils.formatCurrency(sale.total),
                      style: AppTheme.titleLarge.copyWith(
                        color: AppTheme.successGreen,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  _buildPaymentMethodChip(),
                ],
              ),
              const SizedBox(height: AppTheme.spacingS),

              // Date, Time, ID, Cashier Grid
              Wrap(
                spacing: AppTheme.spacingM,
                runSpacing: AppTheme.spacingXS,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(CupertinoIcons.time, size: 13, color: AppTheme.textSecondary),
                      const SizedBox(width: 4),
                      Text(AppDateUtils.formatDateTime(sale.timestamp), style: AppTheme.bodySmall),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(CupertinoIcons.number, size: 13, color: AppTheme.textSecondary),
                      const SizedBox(width: 4),
                      Text('Sale #${sale.id}', style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary)),
                    ],
                  ),
                  if (sale.userName != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(CupertinoIcons.person, size: 13, color: AppTheme.textSecondary),
                        const SizedBox(width: 4),
                        Text(sale.userName!, style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary)),
                      ],
                    ),
                ],
              ),

              // Items Summary Header
              if (sale.items != null && sale.items!.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingM),
                const Divider(height: 1, color: AppTheme.borderColor),
                const SizedBox(height: AppTheme.spacingS),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(CupertinoIcons.cart_fill, size: 14, color: AppTheme.primaryCyan),
                        const SizedBox(width: 6),
                        Text(
                          'Items ($totalUnits total units, ${sale.items!.length} unique)',
                          style: AppTheme.labelMedium.copyWith(color: AppTheme.textPrimary, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const Icon(CupertinoIcons.chevron_right, size: 14, color: AppTheme.textSecondary),
                  ],
                ),
                const SizedBox(height: AppTheme.spacingS),

                // Inline preview of items (up to 3)
                ...sale.items!.take(3).map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 4.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                '• ${item.productName}',
                                style: AppTheme.bodySmall.copyWith(color: AppTheme.textPrimary),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              '${item.quantity}x @ ${AppDateUtils.formatCurrency(item.price)}',
                              style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ),

                if (sale.items!.length > 3)
                  Padding(
                    padding: const EdgeInsets.only(top: 2.0),
                    child: Text(
                      '+ ${sale.items!.length - 3} more items...',
                      style: AppTheme.labelSmall.copyWith(color: AppTheme.textSecondary, fontStyle: FontStyle.italic),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentMethodChip() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: AppTheme.primaryBlue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        sale.paymentMethod,
        style: AppTheme.labelMedium.copyWith(
          color: AppTheme.primaryBlue,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  void _showTransactionDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TransactionDetailsSheet(sale: sale),
    );
  }
}

/// Bottom sheet showing detailed transaction information
class _TransactionDetailsSheet extends StatelessWidget {
  final Sale sale;

  const _TransactionDetailsSheet({required this.sale});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: AppTheme.cardBackground,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusL),
        ),
      ),
      child: Column(
        children: [
          // Handle
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
                TextButton.icon(
                  icon: const Icon(CupertinoIcons.chat_bubble_2_fill, color: Color(0xFF25D366), size: 18),
                  label: const Text('WhatsApp', style: TextStyle(color: Color(0xFF25D366), fontWeight: FontWeight.bold)),
                  onPressed: () => _promptWhatsAppReceipt(context),
                ),
                const SizedBox(width: 4),
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
                  // Amount
                  Center(
                    child: Text(
                      AppDateUtils.formatCurrency(sale.total),
                      style: AppTheme.displayLarge.copyWith(
                        color: AppTheme.successGreen,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppTheme.spacingL),

                  // Details
                  _DetailSection(
                    title: 'Transaction Information',
                    children: [
                      _DetailRow('Transaction ID', sale.id),
                      _DetailRow(
                        'Date & Time',
                        AppDateUtils.formatDateTime(sale.timestamp),
                      ),
                      _DetailRow('Payment Method', sale.paymentMethod),
                      if (sale.userName != null)
                        _DetailRow('Cashier', sale.userName!),
                      if (sale.storeBranch != null)
                        _DetailRow('Branch', sale.storeBranch!),
                    ],
                  ),

                  const SizedBox(height: AppTheme.spacingL),

                  // Amounts breakdown
                  _DetailSection(
                    title: 'Amount Breakdown',
                    children: [
                      _DetailRow(
                        'Subtotal',
                        AppDateUtils.formatCurrency(sale.subtotal),
                      ),
                      if (sale.tax > 0)
                        _DetailRow(
                          'Tax',
                          AppDateUtils.formatCurrency(sale.tax),
                        ),
                      if (sale.discount > 0)
                        _DetailRow(
                          'Discount',
                          AppDateUtils.formatCurrency(sale.discount),
                          isNegative: true,
                        ),
                      const Divider(),
                      _DetailRow(
                        'Total',
                        AppDateUtils.formatCurrency(sale.total),
                        isBold: true,
                      ),
                    ],
                  ),

                  // Items
                  if (sale.items != null && sale.items!.isNotEmpty) ...[
                    const SizedBox(height: AppTheme.spacingL),
                    _DetailSection(
                      title: 'Items (${sale.items!.length})',
                      children: sale.items!
                          .map((item) => _ItemRow(item: item))
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _promptWhatsAppReceipt(BuildContext context) {
    final phoneCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Send WhatsApp Receipt'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Enter customer WhatsApp phone number to send itemized receipt:', style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                hintText: '03001234567',
                labelText: 'Phone Number',
                prefixIcon: Icon(CupertinoIcons.phone),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.black),
            icon: const Icon(CupertinoIcons.chat_bubble_2_fill, size: 16),
            label: const Text('Open WhatsApp', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () async {
              final phone = phoneCtrl.text.trim();
              if (phone.isEmpty) return;
              Navigator.pop(ctx);
              final success = await WhatsAppHelper.sendSaleReceipt(sale: sale, phone: phone);
              if (!success) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Could not open WhatsApp app')),
                );
              }
            },
          ),
        ],
      ),
    );
  }
}

class _DetailSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _DetailSection({
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTheme.titleMedium,
        ),
        const SizedBox(height: AppTheme.spacingM),
        ...children,
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final bool isNegative;

  const _DetailRow(
    this.label,
    this.value, {
    this.isBold = false,
    this.isNegative = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingS),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: (isBold ? AppTheme.titleMedium : AppTheme.bodyMedium)
                .copyWith(color: AppTheme.textSecondary),
          ),
          Text(
            isNegative ? '-$value' : value,
            style: (isBold ? AppTheme.titleMedium : AppTheme.bodyMedium)
                .copyWith(
              color: isNegative ? AppTheme.errorRed : AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  final SaleItem item;

  const _ItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingS),
      padding: const EdgeInsets.all(AppTheme.spacingM),
      decoration: BoxDecoration(
        color: AppTheme.cardBackground,
        border: Border.all(color: AppTheme.borderColor),
        borderRadius: BorderRadius.circular(AppTheme.radiusS),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (item.productCategory != null && item.productCategory!.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.backgroundLight,
                          border: Border.all(color: AppTheme.borderColor),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          item.productCategory!,
                          style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.textSecondary),
                        ),
                      ),
                    Expanded(
                      child: Text(
                        item.productName,
                        style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (item.productBarcode != null) ...[
                      Text(
                        'Barcode: ${item.productBarcode}',
                        style: AppTheme.bodySmall.copyWith(fontSize: 11, color: AppTheme.textTertiary),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      'Qty: ${item.quantity} × ${AppDateUtils.formatCurrency(item.price)}',
                      style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            AppDateUtils.formatCurrency(item.total),
            style: AppTheme.titleMedium.copyWith(fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
        ],
      ),
    );
  }
}
