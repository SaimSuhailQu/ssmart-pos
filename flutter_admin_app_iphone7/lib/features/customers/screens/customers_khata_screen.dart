import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/core/widgets/app_loading_indicator.dart';
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

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Customer Khata & CRM'),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.person_add_solid, color: AppTheme.primaryTeal),
            tooltip: 'Add New Customer',
            onPressed: () => _showCustomerDialog(context, null),
          ),
          PopupMenuButton<String>(
            icon: const Icon(CupertinoIcons.ellipsis_vertical, color: Colors.white70),
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
                    Icon(CupertinoIcons.trash, color: AppTheme.errorRed, size: 18),
                    SizedBox(width: 8),
                    Text('Reset / Clear All Khata', style: TextStyle(color: AppTheme.errorRed, fontSize: 13, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.amber.shade700,
        icon: const Icon(CupertinoIcons.plus_app, color: Colors.black),
        label: const Text('Add Customer', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
        onPressed: () => _showCustomerDialog(context, null),
      ),
      body: StreamBuilder<List<CustomerModel>>(
        stream: firebaseService.getCustomersStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const AppLoadingIndicator(message: 'Loading customer ledgers...');
          }

          if (snapshot.hasError) {
            return AppErrorWidget(
              message: 'Failed to load customers: ${snapshot.error}',
              onRetry: () => setState(() {}),
            );
          }

          final customers = snapshot.data ?? [];
          final totalKhata = customers.fold<double>(0, (sum, c) => sum + c.balance);

          final q = _searchQuery.trim().toLowerCase();
          final digitsQuery = _digitsOnly(q);
          final tokens = q.split(RegExp(r'\s+'));

          final filtered = customers.where((c) {
            if (q.isEmpty) return true;
            final cDigits = _digitsOnly(c.phone);
            final searchable = '${c.name} ${c.phone} ${c.email ?? ''}'.toLowerCase();
            final matchesText = tokens.every((t) => searchable.contains(t));
            final matchesPhone = digitsQuery.isNotEmpty && cDigits.contains(digitsQuery);
            return matchesText || matchesPhone;
          }).toList();

          return Column(
            children: [
              // Metric Card
              Container(
                margin: const EdgeInsets.all(AppTheme.spacingM),
                padding: const EdgeInsets.all(AppTheme.spacingL),
                decoration: BoxDecoration(
                  color: AppTheme.cardBackground,
                  borderRadius: BorderRadius.circular(AppTheme.radiusL),
                  border: Border.all(color: Colors.amber.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Customer Udhaar (Loan)',
                          style: AppTheme.labelMedium.copyWith(color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'PKR ${totalKhata.toStringAsFixed(0)}',
                          style: AppTheme.headlineLarge.copyWith(
                            color: Colors.amber.shade700,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      ),
                      child: const Icon(CupertinoIcons.book_fill, color: Colors.amber, size: 32),
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
                    ? const Center(
                        child: Text(
                          'No customers found.',
                          style: TextStyle(color: AppTheme.textSecondary),
                        ),
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

                          return Container(
                            decoration: BoxDecoration(
                              color: AppTheme.cardBackground,
                              borderRadius: BorderRadius.circular(AppTheme.radiusM),
                              border: Border.all(
                                color: hasDebt ? Colors.amber.withOpacity(0.3) : AppTheme.borderColor,
                              ),
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(AppTheme.radiusM),
                              onTap: () => _showKhataDetailsSheet(context, item),
                              child: Padding(
                                padding: const EdgeInsets.all(AppTheme.spacingM),
                                child: Column(
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          backgroundColor: hasDebt ? Colors.amber.withOpacity(0.15) : AppTheme.primaryBlue.withOpacity(0.1),
                                          child: Icon(
                                            CupertinoIcons.person_fill,
                                            color: hasDebt ? Colors.amber.shade800 : AppTheme.primaryBlue,
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
                                                      style: AppTheme.bodyLarge.copyWith(fontWeight: FontWeight.bold),
                                                    ),
                                                  ),
                                                  const Icon(CupertinoIcons.chevron_right, size: 14, color: AppTheme.textSecondary),
                                                ],
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                item.phone.isNotEmpty ? item.phone : 'No Phone Listed',
                                                style: AppTheme.bodySmall.copyWith(color: AppTheme.textSecondary),
                                              ),
                                              Text(
                                                'Loyalty Points: ${item.points}',
                                                style: AppTheme.labelSmall.copyWith(color: AppTheme.primaryBlue),
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
                                              style: AppTheme.bodyLarge.copyWith(
                                                color: hasDebt ? Colors.amber.shade900 : AppTheme.successGreen,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            Text(
                                              hasDebt ? 'Udhaar Due' : 'Cleared',
                                              style: AppTheme.labelSmall.copyWith(
                                                color: hasDebt ? Colors.amber.shade800 : AppTheme.successGreen,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const Divider(height: 16, color: AppTheme.borderColor),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        // WhatsApp Reminder button
                                        if (item.phone.isNotEmpty) ...[
                                          TextButton.icon(
                                            icon: const Icon(CupertinoIcons.chat_bubble_2_fill, size: 16, color: Color(0xFF25D366)),
                                            label: const Text('WhatsApp', style: TextStyle(color: Color(0xFF25D366), fontSize: 12, fontWeight: FontWeight.bold)),
                                            onPressed: () async {
                                              final success = await WhatsAppHelper.sendCustomerKhataReminder(customer: item);
                                              if (!success) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  const SnackBar(content: Text('Could not open WhatsApp app')),
                                                );
                                              }
                                            },
                                          ),
                                          const SizedBox(width: 6),
                                        ],
                                        // Record Wasool / Udhaar button
                                        TextButton.icon(
                                          icon: const Icon(CupertinoIcons.money_dollar_circle, size: 16, color: Colors.amber),
                                          label: const Text('Loan Entry', style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold)),
                                          onPressed: () => _showKhataTransactionDialog(context, item),
                                        ),
                                        const SizedBox(width: 6),
                                        // Edit Customer button
                                        TextButton.icon(
                                          icon: const Icon(CupertinoIcons.pencil, size: 16, color: AppTheme.primaryCyan),
                                          label: const Text('Edit', style: TextStyle(color: AppTheme.primaryCyan, fontSize: 12)),
                                          onPressed: () => _showCustomerDialog(context, item),
                                        ),
                                        const SizedBox(width: 6),
                                        // Delete button
                                        IconButton(
                                          icon: const Icon(CupertinoIcons.trash, size: 16, color: AppTheme.errorRed),
                                          onPressed: () => _confirmDeleteCustomer(context, item),
                                          tooltip: 'Delete',
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(),
                                        ),
                                      ],
                                    ),
                                  ],
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
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Customer Full Name', prefixIcon: Icon(CupertinoIcons.person)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              keyboardType: TextInputType.phone,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Phone Number (WhatsApp)', prefixIcon: Icon(CupertinoIcons.phone)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              keyboardType: TextInputType.emailAddress,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(labelText: 'Email Address (Optional)', prefixIcon: Icon(CupertinoIcons.mail)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pointsCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: Colors.white),
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
                  await context.read<FirebaseService>().saveCustomer(
                    id: customer?.id.toString(),
                    name: name,
                    phone: phone,
                    email: email,
                    balance: customer?.balance ?? 0,
                    points: points,
                  );

                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(isEditing ? 'Customer "$name" updated!' : 'Customer "$name" added!'),
                      backgroundColor: AppTheme.primaryTeal,
                    ),
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
    String type = 'PAYMENT'; // PAYMENT (Wasool) or LOAN (Udhaar Diya)

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
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
              Text(
                'Khata Entry: ${customer.name}',
                style: AppTheme.headlineMedium.copyWith(color: Colors.amber),
              ),
              Text(
                'Current Balance: PKR ${customer.balance.toStringAsFixed(0)}',
                style: const TextStyle(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: type == 'PAYMENT' ? AppTheme.successGreen : AppTheme.cardBackground,
                        foregroundColor: type == 'PAYMENT' ? Colors.black : Colors.white,
                      ),
                      onPressed: () => setModalState(() => type = 'PAYMENT'),
                      child: const Text('Payment Wasool (-)'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: type == 'LOAN' ? Colors.amber.shade700 : AppTheme.cardBackground,
                        foregroundColor: type == 'LOAN' ? Colors.black : Colors.white,
                      ),
                      onPressed: () => setModalState(() => type = 'LOAN'),
                      child: const Text('Give Loan (+)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Amount (PKR)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Notes / Reason', prefixIcon: Icon(CupertinoIcons.pencil)),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: type == 'PAYMENT' ? AppTheme.successGreen : Colors.amber.shade700,
                    foregroundColor: Colors.black,
                  ),
                  icon: const Icon(CupertinoIcons.checkmark_alt),
                  label: Text(
                    type == 'PAYMENT' ? 'Record Payment Wasool' : 'Record Loan (Udhaar)',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  onPressed: () async {
                    final amount = double.tryParse(amountCtrl.text.trim()) ?? 0;
                    if (amount <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter a valid amount')),
                      );
                      return;
                    }

                    Navigator.pop(ctx);
                    await context.read<FirebaseService>().recordKhataTransaction(
                      customerId: customer.id.toString(),
                      customerName: customer.name,
                      currentBalance: customer.balance,
                      amount: amount,
                      type: type,
                      paymentMethod: 'Cash',
                      notes: noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim(),
                    );

                    final updatedBalance = type == 'LOAN'
                        ? customer.balance + amount
                        : customer.balance - amount;

                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Khata updated for ${customer.name}!'),
                        backgroundColor: AppTheme.primaryTeal,
                        action: customer.phone.isNotEmpty
                            ? SnackBarAction(
                                label: 'WhatsApp Receipt',
                                textColor: Colors.black,
                                onPressed: () {
                                  WhatsAppHelper.sendKhataReceipt(
                                    customerName: customer.name,
                                    phone: customer.phone,
                                    amount: amount,
                                    type: type,
                                    newBalance: updatedBalance,
                                  );
                                },
                              )
                            : null,
                      ),
                    );
                  },
                ),
              ),
            ],
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
              await context.read<FirebaseService>().deleteCustomer(customer.id.toString());
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Deleted ${customer.name}')),
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
        title: const Text('Reset All Khata Records?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
              await context.read<FirebaseService>().clearAllKhataRecords();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('All Khata records cleared & balances reset to PKR 0!'),
                  backgroundColor: AppTheme.primaryTeal,
                ),
              );
            },
            child: const Text('Yes, Reset All', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
