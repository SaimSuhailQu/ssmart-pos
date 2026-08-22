import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';

class CustomersKhataScreen extends StatefulWidget {
  const CustomersKhataScreen({super.key});

  @override
  State<CustomersKhataScreen> createState() => _CustomersKhataScreenState();
}

class _CustomersKhataScreenState extends State<CustomersKhataScreen> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Customer Khata & CRM'),
      ),
      body: StreamBuilder<List<CustomerModel>>(
        stream: firebaseService.getCustomersStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingIndicator(message: 'Loading customer ledgers...');
          }

          if (snapshot.hasError) {
            return AppErrorWidget(
              message: 'Failed to load customers: ${snapshot.error}',
              onRetry: () => setState(() {}),
            );
          }

          final customers = snapshot.data ?? [];
          final totalKhata = customers.fold<double>(0, (sum, c) => sum + c.balance);

          final filtered = customers.where((c) {
            final query = _searchQuery.toLowerCase();
            return c.name.toLowerCase().contains(query) || c.phone.contains(query);
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
                  boxShadow: AppTheme.cardShadow,
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
                          style: AppTheme.displaySmall.copyWith(
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
                  placeholder: 'Search customer name or phone...',
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
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
                        padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                        itemBuilder: (context, index) {
                          final item = filtered[index];
                          final hasDebt = item.balance > 0;

                          return Container(
                            padding: const EdgeInsets.all(AppTheme.spacingM),
                            decoration: BoxDecoration(
                              color: AppTheme.cardBackground,
                              borderRadius: BorderRadius.circular(AppTheme.radiusM),
                              border: Border.all(
                                color: hasDebt ? Colors.amber.withOpacity(0.3) : Colors.black.withOpacity(0.05),
                              ),
                              boxShadow: AppTheme.cardShadow,
                            ),
                            child: Row(
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
                                      Text(
                                        item.name,
                                        style: AppTheme.bodyLarge.copyWith(fontWeight: FontWeight.bold),
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
}
