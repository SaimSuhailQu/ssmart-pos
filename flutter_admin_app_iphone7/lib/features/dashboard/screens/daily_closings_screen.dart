import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';
import 'package:ssmart_pos_admin/widgets/manual_closing_dialog.dart';

/// Dedicated screen to view and record Daily Closing Sales for any date
class DailyClosingsScreen extends StatefulWidget {
  const DailyClosingsScreen({super.key});

  @override
  State<DailyClosingsScreen> createState() => _DailyClosingsScreenState();
}

class _DailyClosingsScreenState extends State<DailyClosingsScreen> {
  DateTime _selectedDate = DateTime.now();
  String _viewFilter = 'Daily'; // 'Daily', 'This Month', 'All History'
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppTheme.primaryCyan,
              surface: AppTheme.surfaceDark,
              onSurface: AppTheme.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _viewFilter = 'Daily';
      });
    }
  }

  /// Groups sales by date string (YYYY-MM-DD)
  Map<String, List<Sale>> _groupSalesByDate(List<Sale> sales) {
    final Map<String, List<Sale>> groups = {};
    for (final s in sales) {
      final dt = AppDateUtils.parseDateTime(s.timestamp);
      if (dt == null) continue;
      final localDt = dt.isUtc ? dt.toLocal() : dt;
      final key = '${localDt.year}-${localDt.month.toString().padLeft(2, '0')}-${localDt.day.toString().padLeft(2, '0')}';
      groups.putIfAbsent(key, () => []).add(s);
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.watch<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Daily Closing Sales'),
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.calendar),
            tooltip: 'Pick Date',
            onPressed: _pickDate,
          ),
          IconButton(
            icon: const Icon(CupertinoIcons.add_circled, color: AppTheme.primaryCyan),
            tooltip: 'Add Closing for Date',
            onPressed: () => ManualClosingDialog.show(
              context,
              initialDate: _selectedDate,
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primaryCyan,
        foregroundColor: Colors.black,
        icon: const Icon(CupertinoIcons.plus_app_fill, color: Colors.black),
        label: const Text(
          'Add Daily Closing',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
        ),
        onPressed: () => ManualClosingDialog.show(
          context,
          initialDate: _selectedDate,
        ),
      ),
      body: StreamBuilder<List<Sale>>(
        initialData: firebaseService.cachedSales,
        stream: firebaseService.getSalesStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && (!snapshot.hasData || snapshot.data == null)) {
            return const AppLoadingIndicator(message: 'Loading closing records...');
          }

          if (snapshot.hasError && (!snapshot.hasData || snapshot.data == null)) {
            return AppErrorWidget(
              message: 'Failed to load sales data',
              error: snapshot.error.toString(),
            );
          }

          final allSales = snapshot.data ?? [];
          final grouped = _groupSalesByDate(allSales);

          // Find sales for currently selected date
          final selectedDateKey = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
          final selectedDaySales = grouped[selectedDateKey] ?? [];

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // Top Date Control & Selector Strip
              SliverToBoxAdapter(
                child: _buildDateControlHeader(),
              ),

              // Summary Card for Selected Date
              SliverToBoxAdapter(
                child: _buildSelectedDateSummaryCard(selectedDaySales, selectedDateKey),
              ),

              // Filter Tabs & Search
              SliverToBoxAdapter(
                child: _buildFilterBar(),
              ),

              // Historical Closing Days List
              _buildHistorySection(grouped),

              const SliverToBoxAdapter(
                child: SizedBox(height: 80),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDateControlHeader() {
    final isToday = _isSameDay(_selectedDate, DateTime.now());
    final isYesterday = _isSameDay(_selectedDate, DateTime.now().subtract(const Duration(days: 1)));
    final formattedTitle = isToday
        ? 'Today (${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year})'
        : isYesterday
            ? 'Yesterday (${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year})'
            : '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM, vertical: AppTheme.spacingS),
      color: AppTheme.cardBackground,
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(CupertinoIcons.chevron_left_circle, color: AppTheme.primaryCyan, size: 28),
                onPressed: () {
                  setState(() {
                    _selectedDate = _selectedDate.subtract(const Duration(days: 1));
                    _viewFilter = 'Daily';
                  });
                },
              ),
              Expanded(
                child: InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceDark,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.primaryCyan.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(CupertinoIcons.calendar_today, size: 16, color: AppTheme.primaryCyan),
                        const SizedBox(width: 8),
                        Text(
                          formattedTitle,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(CupertinoIcons.chevron_right_circle, color: AppTheme.primaryCyan, size: 28),
                onPressed: () {
                  setState(() {
                    _selectedDate = _selectedDate.add(const Duration(days: 1));
                    _viewFilter = 'Daily';
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Quick day jump pills
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildQuickDatePill('Today', DateTime.now()),
              const SizedBox(width: 8),
              _buildQuickDatePill('Yesterday', DateTime.now().subtract(const Duration(days: 1))),
              const SizedBox(width: 8),
              _buildQuickDatePill('Day Before', DateTime.now().subtract(const Duration(days: 2))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickDatePill(String label, DateTime targetDate) {
    final isSelected = _isSameDay(_selectedDate, targetDate);
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedDate = targetDate;
          _viewFilter = 'Daily';
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryCyan : AppTheme.surfaceDark,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppTheme.primaryCyan : Colors.white12,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.black : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildSelectedDateSummaryCard(List<Sale> sales, String dateKey) {
    double totalRevenue = 0.0;
    double cashAmount = 0.0;
    double onlineAmount = 0.0;
    double khataAmount = 0.0;
    Sale? manualClosingSale;

    for (final s in sales) {
      totalRevenue += s.total;
      final pMethod = s.paymentMethod.toLowerCase();

      // Check if manual closing entry
      final isManual = s.items?.any((i) => i.productBarcode == 'MANUAL-CLOSING') == true;
      if (isManual) {
        manualClosingSale = s;
      }

      if (s.payments != null && s.payments!.isNotEmpty) {
        for (final p in s.payments!) {
          final m = p.method.toLowerCase();
          if (m.contains('cash')) {
            cashAmount += p.amount;
          } else if (m.contains('online') || m.contains('bank') || m.contains('card') || m.contains('jazz') || m.contains('easy')) {
            onlineAmount += p.amount;
          } else if (m.contains('khata') || m.contains('credit')) {
            khataAmount += p.amount;
          } else {
            cashAmount += p.amount;
          }
        }
      } else {
        if (pMethod.contains('cash')) {
          cashAmount += s.total;
        } else if (pMethod.contains('online') || pMethod.contains('bank') || pMethod.contains('card') || pMethod.contains('jazz') || pMethod.contains('easy')) {
          onlineAmount += s.total;
        } else if (pMethod.contains('khata') || pMethod.contains('credit')) {
          khataAmount += s.total;
        } else {
          cashAmount += s.total;
        }
      }
    }

    return Padding(
      padding: const EdgeInsets.all(AppTheme.spacingM),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF0D281E), AppTheme.surfaceDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.successGreen.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.successGreen.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(CupertinoIcons.sparkles, color: AppTheme.successGreen, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Closing Sale: $dateKey',
                            style: const TextStyle(
                              color: AppTheme.successGreen,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${sales.length} Total Record(s)',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                  OutlinedButton.icon(
                    onPressed: () {
                      ManualClosingDialog.show(
                        context,
                        initialDate: _selectedDate,
                        initialTotal: manualClosingSale != null ? manualClosingSale.total : (totalRevenue > 0 ? totalRevenue : null),
                        initialCash: cashAmount > 0 ? cashAmount : null,
                        initialOnline: onlineAmount > 0 ? onlineAmount : null,
                        initialNotes: manualClosingSale?.items?.first.productName.replaceAll('Daily Closing: ', ''),
                      );
                    },
                    icon: const Icon(CupertinoIcons.pencil, size: 13, color: AppTheme.successGreen),
                    label: Text(
                      manualClosingSale != null ? 'Edit Closing' : 'Add / Set',
                      style: const TextStyle(color: AppTheme.successGreen, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.successGreen),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Total Net Sale Display
              Text(
                'NET CLOSING SALE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                  color: Colors.white.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                AppDateUtils.formatCurrency(totalRevenue),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.5,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 16),

              // Breakdown Chips
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black38,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildBreakdownCol(
                        'Cash in Drawer',
                        AppDateUtils.formatCurrency(cashAmount),
                        CupertinoIcons.money_dollar_circle_fill,
                        Colors.greenAccent,
                      ),
                    ),
                    Container(height: 30, width: 1, color: Colors.white12),
                    Expanded(
                      child: _buildBreakdownCol(
                        'Online / Bank',
                        AppDateUtils.formatCurrency(onlineAmount),
                        CupertinoIcons.creditcard_fill,
                        Colors.cyanAccent,
                      ),
                    ),
                    if (khataAmount > 0) ...[
                      Container(height: 30, width: 1, color: Colors.white12),
                      Expanded(
                        child: _buildBreakdownCol(
                          'Khata / Udhaar',
                          AppDateUtils.formatCurrency(khataAmount),
                          CupertinoIcons.book_fill,
                          Colors.amberAccent,
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              if (manualClosingSale != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryCyan.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.primaryCyan.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(CupertinoIcons.info_circle, size: 14, color: AppTheme.primaryCyan),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          manualClosingSale.items?.first.productName ?? 'Manual Closing Logged',
                          style: const TextStyle(fontSize: 11, color: AppTheme.primaryCyan),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),
              // Copy Closing Report Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    final dateStr = '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}';
                    final text = '🏪 *SS MART & GENERAL STORE*\n'
                        '📅 *DAILY CLOSING SUMMARY*\n'
                        '──────────────────────\n'
                        '🗓️ *Date:* $dateStr\n'
                        '📦 *Total Orders / Bills:* ${sales.length}\n'
                        '✨ *TOTAL CLOSING SALE:* Rs. ${totalRevenue.toStringAsFixed(2)}\n'
                        '──────────────────────\n'
                        '💵 *Cash in Drawer:* Rs. ${cashAmount.toStringAsFixed(2)}\n'
                        '💳 *Online / Bank:* Rs. ${onlineAmount.toStringAsFixed(2)}\n'
                        '📖 *Khata (Credit):* Rs. ${khataAmount.toStringAsFixed(2)}\n'
                        '──────────────────────\n'
                        '✅ *Verified & Logged via SSmart Admin*';

                    Clipboard.setData(ClipboardData(text: text));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('✅ Closing report copied to clipboard!'),
                        backgroundColor: AppTheme.successGreen,
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  icon: const Icon(CupertinoIcons.doc_on_clipboard_fill, size: 15, color: Colors.black),
                  label: const Text(
                    'Copy Daily Closing Summary',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.successGreen,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBreakdownCol(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: color,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Historical Closing Log',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              Row(
                children: [
                  _buildViewFilterChip('Daily'),
                  const SizedBox(width: 6),
                  _buildViewFilterChip('This Month'),
                  const SizedBox(width: 6),
                  _buildViewFilterChip('All History'),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search date (e.g. 2026-09, 2026-09-11)...',
              prefixIcon: const Icon(CupertinoIcons.search, size: 18),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(CupertinoIcons.xmark_circle_fill, size: 16),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
            ),
            onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
          ),
        ],
      ),
    );
  }

  Widget _buildViewFilterChip(String label) {
    final isSelected = _viewFilter == label;
    return GestureDetector(
      onTap: () => setState(() => _viewFilter = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryCyan.withValues(alpha: 0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppTheme.primaryCyan : Colors.white12,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? AppTheme.primaryCyan : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildHistorySection(Map<String, List<Sale>> grouped) {
    // Filter keys
    List<String> keys = grouped.keys.toList();
    keys.sort((a, b) => b.compareTo(a)); // Newest date first

    final now = DateTime.now();

    if (_viewFilter == 'Daily') {
      final selectedDateKey = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
      keys = keys.where((k) => k == selectedDateKey).toList();
    } else if (_viewFilter == 'This Month') {
      final monthPrefix = '${now.year}-${now.month.toString().padLeft(2, '0')}';
      keys = keys.where((k) => k.startsWith(monthPrefix)).toList();
    }

    if (_searchQuery.isNotEmpty) {
      keys = keys.where((k) => k.toLowerCase().contains(_searchQuery)).toList();
    }

    if (keys.isEmpty) {
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Center(
            child: Column(
              children: [
                const Icon(CupertinoIcons.calendar_badge_minus, size: 48, color: AppTheme.textSecondary),
                const SizedBox(height: 12),
                const Text(
                  'No Closing Records Found',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Tap the button below to record daily sales for this date.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => ManualClosingDialog.show(context, initialDate: _selectedDate),
                  icon: const Icon(CupertinoIcons.plus, size: 14),
                  label: const Text('Add Closing Sale Now'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryCyan,
                    foregroundColor: Colors.black,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final dateStr = keys[index];
            final daySales = grouped[dateStr] ?? [];
            final total = daySales.fold<double>(0.0, (sum, s) => sum + s.total);
            final bool hasManual = daySales.any((s) => s.items?.any((i) => i.productBarcode == 'MANUAL-CLOSING') == true);

            // Parse date for title
            DateTime? parsedDt;
            try {
              final parts = dateStr.split('-');
              parsedDt = DateTime(int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
            } catch (_) {}

            final isCurrentSelected = parsedDt != null && _isSameDay(parsedDt, _selectedDate);

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: isCurrentSelected ? AppTheme.surfaceDark : AppTheme.cardBackground,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isCurrentSelected ? AppTheme.primaryCyan : Colors.white10,
                  width: isCurrentSelected ? 1.5 : 1,
                ),
              ),
              child: ListTile(
                onTap: () {
                  if (parsedDt != null) {
                    setState(() {
                      _selectedDate = parsedDt!;
                      _viewFilter = 'Daily';
                    });
                  }
                },
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: hasManual
                        ? AppTheme.primaryCyan.withValues(alpha: 0.15)
                        : AppTheme.successGreen.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    hasManual ? CupertinoIcons.square_list_fill : CupertinoIcons.cart_fill,
                    color: hasManual ? AppTheme.primaryCyan : AppTheme.successGreen,
                    size: 20,
                  ),
                ),
                title: Row(
                  children: [
                    Text(
                      dateStr,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: isCurrentSelected ? AppTheme.primaryCyan : Colors.white,
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (hasManual)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryCyan.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Manual Closing',
                          style: TextStyle(fontSize: 9, color: AppTheme.primaryCyan, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    '${daySales.length} Transactions / Entries Recorded',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  ),
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      AppDateUtils.formatCurrency(total),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Colors.white,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isCurrentSelected ? 'Selected' : 'View Breakdown',
                      style: TextStyle(
                        fontSize: 10,
                        color: isCurrentSelected ? AppTheme.primaryCyan : AppTheme.textSecondary,
                        fontWeight: isCurrentSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
          childCount: keys.length,
        ),
      ),
    );
  }
}
