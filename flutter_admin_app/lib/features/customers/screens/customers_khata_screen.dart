import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/core/widgets/staggered_entrance.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';
import 'package:ssmart_pos_admin/core/widgets/shakable.dart';
import 'package:ssmart_pos_admin/core/widgets/shimmer.dart';
import 'package:ssmart_pos_admin/core/widgets/success_overlay.dart';
import 'package:ssmart_pos_admin/core/widgets/swipeable_row.dart';
import 'package:ssmart_pos_admin/core/widgets/graphite_empty_state.dart';
import 'package:ssmart_pos_admin/core/widgets/liquid_scaffold.dart';
import 'package:ssmart_pos_admin/features/customers/widgets/customer_khata_details_sheet.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

class CustomersKhataScreen extends StatefulWidget {
  const CustomersKhataScreen({super.key});

  @override
  State<CustomersKhataScreen> createState() => _CustomersKhataScreenState();
}

class _CustomersKhataScreenState extends State<CustomersKhataScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _digitsOnly(String s) => s.replaceAll(RegExp(r'\D'), '');

  /// Total udhaar (what customers owe). Only positive balances count:
  /// a customer with credit (overpaid / negative ledger value) must not
  /// cancel out real debt — the headline previously showed e.g. PKR -7808.
  double _totalUdhaar(List<CustomerModel> customers) {
    return customers.fold<double>(0, (sum, c) => sum + (c.balance > 0 ? c.balance : 0));
  }

  /// Fire-and-report wrapper: surfaces silent CRUD failures instead of
  /// swallowing them (root cause of "nothing happens" delete/edit reports).
  Future<void> _runCrud(Future<void> Function() op, String successMsg) async {
    try {
      await op();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(successMsg), backgroundColor: AppTheme.successGreen),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Action failed: $e'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return LiquidScaffold(
      graphiteAmbience: true,
      appBar: AppBar(
        // Short title: with the back button + two actions, the longer
        // "Customer Khata & CRM" ellipsized at larger text scales.
        title: const Text('Customer Khata'),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.person_add_solid, color: GraphiteTheme.platinum),
            tooltip: 'Add New Customer',
            onPressed: () => _showCustomerDialog(context, null),
          ),
          PopupMenuButton<String>(
            icon: const Icon(CupertinoIcons.ellipsis_vertical, color: GraphiteTheme.slate),
            onSelected: (val) {
              if (val == 'clear_khata') {
                _confirmClearAllKhata(context);
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'clear_khata',
                child: Row(
                  children: [
                    Icon(CupertinoIcons.trash, color: GraphiteTheme.errorRed, size: 18),
                    SizedBox(width: 8),
                    Text('Reset / Clear All Khata', style: TextStyle(color: GraphiteTheme.errorRed, fontSize: 13, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: Container(
        decoration: GraphiteTheme.primaryButtonDecoration,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => _showCustomerDialog(context, null),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(CupertinoIcons.plus_app, color: GraphiteTheme.graphiteDeep, size: 20),
                  const SizedBox(width: 8),
                  Text('Add Customer', style: GraphiteTheme.primaryButtonText.copyWith(fontSize: 14)),
                ],
              ),
            ),
          ),
        ),
      ),
      body: StreamBuilder<List<CustomerModel>>(
        initialData: firebaseService.cachedCustomers,
        stream: firebaseService.getCustomersStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting && (!snapshot.hasData || snapshot.data == null)) {
            return const Padding(
              padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
              child: ShimmerList(itemCount: 5, itemHeight: 170),
            );
          }

          if (snapshot.hasError && (!snapshot.hasData || snapshot.data == null)) {
            return AppErrorWidget(
              message: 'Failed to load customers: ${snapshot.error}',
              onRetry: () => setState(() {}),
            );
          }

          final customers = snapshot.data ?? [];
          final totalKhata = _totalUdhaar(customers);

          final q = _searchQuery.trim().toLowerCase();
          final digitsQuery = _digitsOnly(q);
          final tokens = q.split(RegExp(r'\s+'));

          final filtered = customers.where((c) {
            if (q.isEmpty) return true;
            final cDigits = _digitsOnly(c.phone);
            final searchable = '${c.name} ${c.phone} ${c.email}'.toLowerCase();
            final matchesText = tokens.every((t) => searchable.contains(t));
            final matchesPhone = digitsQuery.isNotEmpty && cDigits.contains(digitsQuery);
            return matchesText || matchesPhone;
          }).toList();

          return Column(
            children: [
              // Hero Metric Card — Noir Graphite Signature Styling
              Container(
                margin: const EdgeInsets.all(AppTheme.spacingM),
                padding: const EdgeInsets.all(AppTheme.spacingL),
                decoration: GraphiteTheme.platinumCardDecoration,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TOTAL CUSTOMER UDHAAR (LOAN)',
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
                                  totalKhata.toStringAsFixed(0),
                                  style: GraphiteTheme.heroAmount.copyWith(
                                    fontSize: 36,
                                    // Udhaar due = bad → red; nothing owed → slate.
                                    color: totalKhata > 0 ? GraphiteTheme.errorRed : GraphiteTheme.slate,
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
                      child: const Icon(CupertinoIcons.book_fill, color: GraphiteTheme.platinum, size: 28),
                    ),
                  ],
                ),
              ),

              // Search Box
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                child: CupertinoSearchTextField(
                  controller: _searchController,
                  placeholder: 'Search customer name or phone...',
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
                    });
                  },
                  onSuffixTap: () {
                    _searchController.clear();
                    setState(() {
                      _searchQuery = '';
                    });
                  },
                ),
              ),
              const SizedBox(height: AppTheme.spacingM),

              // Customers List
              Expanded(
                child: filtered.isEmpty
                    ? GraphiteEmptyState(
                        icon: customers.isEmpty
                            ? CupertinoIcons.person_2
                            : CupertinoIcons.search,
                        title: customers.isEmpty
                            ? 'No Customers Found'
                            : 'No Matching Customers',
                        message: customers.isEmpty
                            ? 'Customers registered at your POS cash counter or added to ledger will appear here.'
                            : 'No customer matches your name or phone number search.',
                        iconColor: GraphiteTheme.platinum,
                        actionLabel: customers.isEmpty ? null : 'Clear Search',
                        actionIcon: CupertinoIcons.arrow_counterclockwise,
                        onAction: customers.isEmpty
                            ? null
                            : () {
                                setState(() {
                                  _searchController.clear();
                                  _searchQuery = '';
                                });
                              },
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(
                          left: AppTheme.spacingM,
                          right: AppTheme.spacingM,
                          bottom: AppTheme.spacingXL * 2,
                        ),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                        itemBuilder: (context, index) {
                          final item = filtered[index];
                          final hasDebt = item.balance > 0;
                          final hasCredit = item.balance < 0;

                          return StaggeredEntrance(
                            delay: Duration(milliseconds: (index % 12) * 35),
                            child: SwipeableRow(
                              actions: [
                                SwipeAction(
                                  icon: CupertinoIcons.doc_text,
                                  label: 'Details',
                                  color: AppTheme.primaryTeal,
                                  onTap: () => _showKhataDetailsSheet(context, item),
                                ),
                                SwipeAction(
                                  icon: CupertinoIcons.money_dollar_circle,
                                  label: 'Add Entry',
                                  color: AppTheme.successGreen,
                                  onTap: () => _showKhataTransactionDialog(context, item),
                                ),
                              ],
                              child: Container(
                            decoration: BoxDecoration(
                              color: GraphiteTheme.graphiteCard,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: hasDebt
                                    ? GraphiteTheme.redAccent.withValues(alpha: 0.35)
                                    : GraphiteTheme.cardBorder,
                                width: 1,
                              ),
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () => _showKhataDetailsSheet(context, item),
                              child: Padding(
                                padding: const EdgeInsets.all(AppTheme.spacingM),
                                child: Column(
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        CircleAvatar(
                                          backgroundColor: hasDebt
                                              ? GraphiteTheme.redAccent.withValues(alpha: 0.12)
                                              : GraphiteTheme.platinumFaint,
                                          child: Icon(
                                            CupertinoIcons.person_fill,
                                            color: hasDebt ? GraphiteTheme.redAccent : GraphiteTheme.platinum,
                                          ),
                                        ),
                                        const SizedBox(width: AppTheme.spacingM),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      item.name,
                                                      style: GraphiteTheme.bodyStrong,
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                  const Icon(CupertinoIcons.chevron_right, size: 14, color: GraphiteTheme.slateDim),
                                                ],
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                item.phone.isNotEmpty ? item.phone : 'No Phone Listed',
                                                style: GraphiteTheme.body.copyWith(color: GraphiteTheme.slate, fontSize: 12),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                'Loyalty Points: ${item.points}',
                                                style: GraphiteTheme.captionPlatinum.copyWith(fontSize: 10),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              'PKR ${item.balance.toStringAsFixed(0)}',
                                              style: GraphiteTheme.metricValue.copyWith(
                                                color: hasDebt
                                                    ? GraphiteTheme.redAccent
                                                    : hasCredit
                                                        ? GraphiteTheme.slate
                                                        : GraphiteTheme.platinumLight,
                                                fontSize: 18,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: hasDebt
                                                    ? GraphiteTheme.redAccent.withValues(alpha: 0.12)
                                                    : GraphiteTheme.platinumFaint,
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: Text(
                                                hasDebt
                                                    ? 'Udhaar Due'
                                                    : hasCredit
                                                        ? 'Advance / Credit'
                                                        : 'Cleared',
                                                style: TextStyle(
                                                  color: hasDebt
                                                      ? GraphiteTheme.redAccent
                                                      : GraphiteTheme.slate,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const Divider(height: 16, color: GraphiteTheme.cardBorder),
                                    // Wrap keeps every action reachable on narrow
                                    // screens; the old fixed Row pushed the delete
                                    // icon past the card edge (half-clipped trash).
                                    Wrap(
                                      alignment: WrapAlignment.end,
                                      spacing: 2,
                                      runSpacing: 0,
                                      children: [
                                        // WhatsApp Reminder button
                                        if (item.phone.isNotEmpty)
                                          TextButton.icon(
                                            icon: const Icon(CupertinoIcons.chat_bubble_2_fill, size: 15, color: Color(0xFF25D366)),
                                            label: const Text('WhatsApp', style: TextStyle(color: Color(0xFF25D366), fontSize: 12, fontWeight: FontWeight.bold)),
                                            onPressed: () async {
                                              final success = await WhatsAppHelper.sendCustomerKhataReminder(customer: item);
                                              if (!context.mounted) return;
                                              if (!success) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  const SnackBar(content: Text('Could not open WhatsApp app')),
                                                );
                                              }
                                            },
                                          ),
                                        // Record Wasool / Udhaar button
                                        TextButton.icon(
                                          icon: const Icon(CupertinoIcons.money_dollar_circle, size: 16, color: GraphiteTheme.platinum),
                                          label: const Text('Loan Entry', style: TextStyle(color: GraphiteTheme.platinum, fontSize: 12, fontWeight: FontWeight.bold)),
                                          onPressed: () => _showKhataTransactionDialog(context, item),
                                        ),
                                        // Edit Customer button
                                        TextButton.icon(
                                          icon: const Icon(CupertinoIcons.pencil, size: 15, color: GraphiteTheme.slate),
                                          label: const Text('Edit', style: TextStyle(color: GraphiteTheme.slate, fontSize: 12)),
                                          onPressed: () => _showCustomerDialog(context, item),
                                        ),
                                        // Delete button — visualSize keeps the icon
                                        // from being clipped by the card's rounded edge.
                                        IconButton(
                                          icon: const Icon(CupertinoIcons.trash, size: 15, color: GraphiteTheme.errorRed),
                                          onPressed: () => _confirmDeleteCustomer(context, item),
                                          tooltip: 'Delete',
                                          padding: const EdgeInsets.symmetric(horizontal: 6),
                                          constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            ),
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

  void _showKhataDetailsSheet(BuildContext context, CustomerModel customer) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CustomerKhataDetailsSheet(
        customer: customer,
        onAddEntry: () => _showKhataTransactionDialog(context, customer),
      ),
    );
  }

  void _showCustomerDialog(BuildContext context, CustomerModel? customer) {
    final isEditing = customer != null;
    final nameCtrl = TextEditingController(text: customer?.name ?? '');
    final phoneCtrl = TextEditingController(text: customer?.phone ?? '');
    final emailCtrl = TextEditingController(text: customer?.email ?? '');
    final pointsCtrl = TextEditingController(text: customer?.points != null ? customer!.points.toString() : '0');

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
                  isEditing ? 'Edit Customer' : 'Add New Customer',
                  style: AppTheme.headlineMedium.copyWith(color: AppTheme.primaryTeal),
                ),
                IconButton(
                  icon: const Icon(CupertinoIcons.xmark_circle, color: AppTheme.textSecondary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: nameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Customer Full Name', prefixIcon: Icon(CupertinoIcons.person)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone Number (WhatsApp)', prefixIcon: Icon(CupertinoIcons.phone)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email Address (Optional)', prefixIcon: Icon(CupertinoIcons.mail)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pointsCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Loyalty Points', prefixIcon: Icon(CupertinoIcons.star)),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryTeal,
                  foregroundColor: Colors.black,
                ),
                icon: const Icon(CupertinoIcons.checkmark_alt_circle),
                label: Text(isEditing ? 'Update Customer' : 'Save Customer', style: const TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () async {
                  final name = nameCtrl.text.trim();
                  final phone = phoneCtrl.text.trim();
                  final email = emailCtrl.text.trim();
                  final points = int.tryParse(pointsCtrl.text.trim()) ?? 0;

                  if (name.isEmpty || phone.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Name and phone number are required')),
                    );
                    return;
                  }

                  Navigator.pop(ctx);
                  await _runCrud(
                    () => context.read<FirebaseService>().saveCustomer(
                      id: customer?.id.toString(),
                      key: customer?.key,
                      name: name,
                      phone: phone,
                      email: email,
                      balance: customer?.balance ?? 0,
                      points: points,
                    ),
                    isEditing ? 'Customer "$name" updated!' : 'Customer "$name" added!',
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showKhataTransactionDialog(BuildContext context, CustomerModel customer) {
    final amountCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    final shakeCtrl = ShakeController();
    String type = 'PAYMENT'; // PAYMENT (Wasool) or LOAN (Udhaar Diya)

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Shakable(
          controller: shakeCtrl,
          child: Container(
          decoration: const BoxDecoration(
            color: AppTheme.surfaceDark,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + AppTheme.spacingL,
            top: AppTheme.spacingL,
            left: AppTheme.spacingL,
            right: AppTheme.spacingL,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text('Khata Entry: ${customer.name}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: GraphiteTheme.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    IconButton(icon: const Icon(CupertinoIcons.xmark_circle_fill, color: AppTheme.textSecondary), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const SizedBox(height: AppTheme.spacingM),
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('Cash Received (Wasool)'),
                        selected: type == 'PAYMENT',
                        selectedColor: AppTheme.successGreen,
                        onSelected: (val) {
                          if (val) {
                            Haptics.select();
                            setModalState(() => type = 'PAYMENT');
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: AppTheme.spacingS),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('Give Loan (Udhaar)'),
                        selected: type == 'LOAN',
                        selectedColor: GraphiteTheme.redAccent,
                        onSelected: (val) {
                          if (val) {
                            Haptics.select();
                            setModalState(() => type = 'LOAN');
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppTheme.spacingM),
                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: GraphiteTheme.ink, fontSize: 18, fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(labelText: 'Amount (PKR)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
                ),
                const SizedBox(height: AppTheme.spacingM),
                TextField(
                  controller: noteCtrl,
                  style: const TextStyle(color: GraphiteTheme.ink),
                  decoration: const InputDecoration(labelText: 'Description / Notes (Optional)', prefixIcon: Icon(CupertinoIcons.doc_text)),
                ),
                const SizedBox(height: AppTheme.spacingL),
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: type == 'PAYMENT' ? AppTheme.successGreen : GraphiteTheme.redAccent,
                      foregroundColor: Colors.black,
                    ),
                    child: Text('Confirm ${type == 'PAYMENT' ? 'Wasool' : 'Udhaar'}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: () async {
                      final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
                      if (amount <= 0) {
                        Haptics.error();
                        shakeCtrl.shake();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Please enter a valid amount')),
                        );
                        return;
                      }

                      Navigator.pop(ctx);
                      try {
                        await context.read<FirebaseService>().recordKhataTransaction(
                          customerId: customer.dbKey,
                          customerName: customer.name,
                          currentBalance: customer.balance,
                          amount: amount,
                          type: type,
                          paymentMethod: 'Cash',
                          notes: noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim(),
                        );
                      } catch (e) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Action failed: $e'),
                            backgroundColor: AppTheme.errorRed,
                          ),
                        );
                        return;
                      }

                      if (!context.mounted) return;
                      showSuccessOverlay(context, message: 'Khata entry saved');

                      final updatedBalance = type == 'LOAN'
                          ? customer.balance + amount
                          : customer.balance - amount;

                      if (!context.mounted) return;
                      if (customer.phone.isNotEmpty) {
                        WhatsAppHelper.sendKhataReceipt(
                          customerName: customer.name,
                          phone: customer.phone,
                          amount: amount,
                          type: type,
                          newBalance: updatedBalance,
                        );
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
          ),
        ),
      ),
    );
  }

  void _confirmDeleteCustomer(BuildContext context, CustomerModel customer) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Customer?'),
        content: Text('Are you sure you want to delete ${customer.name} and clear their record?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await _runCrud(
                () => context.read<FirebaseService>().deleteCustomer(
                  customer.id.toString(),
                  key: customer.dbKey,
                ),
                'Deleted ${customer.name}',
              );
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _confirmClearAllKhata(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Reset All Khata Records?', style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold)),
        content: const Text(
          'This will permanently delete all audit loan/payment transactions and reset all customer balances to PKR 0 in the cloud and local system. Are you sure?',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              await _runCrud(
                () => context.read<FirebaseService>().clearAllKhataRecords(),
                'All Khata records cleared & balances reset to PKR 0!',
              );
            },
            child: const Text('Yes, Reset All', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
