import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/widgets/glass_card.dart';
import 'package:ssmart_pos_admin/models/daily_closing.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';
import 'package:ssmart_pos_admin/widgets/manual_closing_dialog.dart';

/// Dedicated screen displaying only Daily Closing records for any date
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

  /// Groups closings by date string (YYYY-MM-DD)
  Map<String, List<DailyClosingModel>> _groupClosingsByDate(List<DailyClosingModel> closings) {
    final Map<String, List<DailyClosingModel>> groups = {};
    for (final c in closings) {
      groups.putIfAbsent(c.date, () => []).add(c);
    }
    return groups;
  }

  Future<void> _confirmDeleteClosing(BuildContext context, FirebaseService firebaseService, DailyClosingModel closing) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Daily Closing?'),
        content: Text(
          'Are you sure you want to delete the daily closing for ${closing.date} (Rs. ${closing.total.toStringAsFixed(2)})? This will remove it permanently.',
          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.errorRed,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete Permanently'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      try {
        await firebaseService.deleteDailyClosing(closing.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🗑️ Daily closing deleted successfully.'),
              backgroundColor: AppTheme.warningOrange,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete closing: $e'), backgroundColor: AppTheme.errorRed),
          );
        }
      }
    }
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
      body: StreamBuilder<List<DailyClosingModel>>(
        stream: firebaseService.getDailyClosingsStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && (!snapshot.hasData || snapshot.data == null)) {
            return const AppLoadingIndicator(message: 'Loading closing records...');
          }

          if (snapshot.hasError && (!snapshot.hasData || snapshot.data == null)) {
            return AppErrorWidget(
              message: 'Failed to load daily closing records',
              error: snapshot.error.toString(),
            );
          }

          final allClosings = snapshot.data ?? [];
          final grouped = _groupClosingsByDate(allClosings);

          // Find closings for currently selected date
          final selectedDateKey = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
          final selectedDayClosings = grouped[selectedDateKey] ?? [];

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // Top Date Control & Selector Strip
              SliverToBoxAdapter(
                child: _buildDateControlHeader(),
              ),

              // Summary Card for Selected Date
              SliverToBoxAdapter(
                child: _buildSelectedDateSummaryCard(context, firebaseService, selectedDayClosings, selectedDateKey),
              ),

              // Filter Tabs & Search
              SliverToBoxAdapter(
                child: _buildFilterBar(),
              ),

              // Historical Closing Days List
              _buildHistorySection(firebaseService, grouped),

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

  Widget _buildSelectedDateSummaryCard(
    BuildContext context,
    FirebaseService firebaseService,
    List<DailyClosingModel> closings,
    String dateKey,
  ) {
    double totalRevenue = 0.0;
    double cashAmount = 0.0;
    double onlineAmount = 0.0;
    DailyClosingModel? primaryClosing;

    if (closings.isNotEmpty) {
      primaryClosing = closings.first;
      for (final c in closings) {
        totalRevenue += c.total;
        cashAmount += c.cashAmount;
        onlineAmount += c.onlineAmount;
      }
    }

    return Padding(
      padding: const EdgeInsets.all(AppTheme.spacingM),
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        borderColor: AppTheme.successGreen.withValues(alpha: 0.4),
        enableGlow: true,
        glowColor: AppTheme.successGreen,
        gradient: const LinearGradient(
          colors: [Color(0xDD0D281E), Color(0xEE141722)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
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
                            closings.isEmpty
                                ? 'No Closing Logged Yet'
                                : '${closings.length} Closing Entry Recorded',
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      if (primaryClosing != null) ...[
                        IconButton(
                          icon: const Icon(CupertinoIcons.trash, color: AppTheme.errorRed, size: 18),
                          tooltip: 'Delete Closing Record',
                          onPressed: () => _confirmDeleteClosing(context, firebaseService, primaryClosing!),
                        ),
                        const SizedBox(width: 4),
                      ],
                      OutlinedButton.icon(
                        onPressed: () {
                          ManualClosingDialog.show(
                            context,
                            closingId: primaryClosing?.id,
                            initialDate: _selectedDate,
                            initialTotal: primaryClosing?.total,
                            initialCash: primaryClosing != null && primaryClosing.cashAmount > 0 ? primaryClosing.cashAmount : null,
                            initialOnline: primaryClosing != null && primaryClosing.onlineAmount > 0 ? primaryClosing.onlineAmount : null,
                            initialNotes: primaryClosing?.notes,
                          );
                        },
                        icon: Icon(primaryClosing != null ? CupertinoIcons.pencil : CupertinoIcons.plus, size: 13, color: AppTheme.successGreen),
                        label: Text(
                          primaryClosing != null ? 'Edit' : 'Add Closing',
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
                ],
              ),
              const SizedBox(height: 16),

              // Total Net Sale Display
              Text(
                'NET DAILY CLOSING SALE',
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
                  ],
                ),
              ),

              if (primaryClosing != null && primaryClosing.notes.isNotEmpty) ...[
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
                          primaryClosing.notes,
                          style: const TextStyle(fontSize: 11, color: AppTheme.primaryCyan),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // Copy Closing Report Button
              if (closings.isNotEmpty)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final dateStr = '${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}';
                      final text = '🏪 *SS MART & GENERAL STORE*\n'
                          '📅 *DAILY CLOSING SUMMARY*\n'
                          '──────────────────────\n'
                          '🗓️ *Date:* $dateStr\n'
                          '✨ *TOTAL CLOSING SALE:* Rs. ${totalRevenue.toStringAsFixed(2)}\n'
                          '──────────────────────\n'
                          '💵 *Cash in Drawer:* Rs. ${cashAmount.toStringAsFixed(2)}\n'
                          '💳 *Online / Bank:* Rs. ${onlineAmount.toStringAsFixed(2)}\n'
                          '${primaryClosing?.notes.isNotEmpty == true ? '📝 *Notes:* ${primaryClosing!.notes}\n' : ''}'
                          '──────────────────────\n'
                          '✅ *Recorded via SSmart Admin*';

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
              hintText: 'Search date (e.g. 2026-09, 2026-09-12)...',
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

  Widget _buildHistorySection(FirebaseService firebaseService, Map<String, List<DailyClosingModel>> grouped) {
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
                  'No Daily Closing Logged',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Tap the button below to add a closing sale record for this date.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => ManualClosingDialog.show(context, initialDate: _selectedDate),
                  icon: const Icon(CupertinoIcons.plus, size: 14),
                  label: const Text('Add Daily Closing Sale'),
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
            final dayClosings = grouped[dateStr] ?? [];
            final total = dayClosings.fold<double>(0.0, (sum, c) => sum + c.total);
            final firstClosing = dayClosings.isNotEmpty ? dayClosings.first : null;

            // Parse date for title
            DateTime? parsedDt;
            try {
              final parts = dateStr.split('-');
              parsedDt = DateTime(int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
            } catch (_) {}

            final isCurrentSelected = parsedDt != null && _isSameDay(parsedDt, _selectedDate);

            return GlassCard(
              margin: const EdgeInsets.only(bottom: 8),
              borderRadius: 12,
              padding: EdgeInsets.zero,
              borderColor: isCurrentSelected ? AppTheme.primaryCyan : Colors.white12,
              borderWidth: isCurrentSelected ? 1.5 : 1,
              backgroundColor: isCurrentSelected ? AppTheme.surfaceDark : null,
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
                    color: AppTheme.successGreen.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    CupertinoIcons.calendar_badge_plus,
                    color: AppTheme.successGreen,
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
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.successGreen.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Daily Closing',
                        style: TextStyle(fontSize: 9, color: AppTheme.successGreen, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    firstClosing?.notes.isNotEmpty == true
                        ? firstClosing!.notes
                        : 'Cash: Rs. ${firstClosing?.cashAmount.toStringAsFixed(0) ?? '0'} • Online: Rs. ${firstClosing?.onlineAmount.toStringAsFixed(0) ?? '0'}',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Column(
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
                          isCurrentSelected ? 'Selected' : 'View / Edit',
                          style: TextStyle(
                            fontSize: 10,
                            color: isCurrentSelected ? AppTheme.primaryCyan : AppTheme.textSecondary,
                            fontWeight: isCurrentSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                    if (firstClosing != null) ...[
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(CupertinoIcons.trash, size: 16, color: AppTheme.errorRed),
                        tooltip: 'Delete Closing',
                        onPressed: () => _confirmDeleteClosing(context, firebaseService, firstClosing),
                      ),
                    ],
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
