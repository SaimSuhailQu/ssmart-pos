import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/core/utils/whatsapp_helper.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/core/widgets/app_loading_indicator.dart';
import 'package:ssmart_pos_admin/features/vendors/widgets/vendor_po_details_sheet.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

class VendorsScreen extends StatefulWidget {
  const VendorsScreen({super.key});

  @override
  State<VendorsScreen> createState() => _VendorsScreenState();
}

class _VendorsScreenState extends State<VendorsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _poSearchController = TextEditingController();
  final TextEditingController _vendorSearchController = TextEditingController();
  String _poSearchQuery = '';
  String _poFilter = 'ALL'; // ALL, PENDING, RECEIVED, PAYABLE, PAID
  String _vendorSearchQuery = '';
  String _selectedCategory = 'ALL';

  final List<String> _vendorCategories = [
    'ALL',
    'General',
    'Beverages',
    'Snacks',
    'Dairy',
    'Bakery',
    'Frozen',
    'Personal Care',
    'Cleaning',
    'Wholesale',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _poSearchController.dispose();
    _vendorSearchController.dispose();
    super.dispose();
  }

  void _showPODetailsSheet(BuildContext context, PurchaseOrderModel po) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => VendorPODetailsSheet(
        po: po,
        onEdit: () => _showAddEditPODialog(context, po: po),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Vendors & Purchase Orders'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.purpleAccent,
          labelColor: Colors.purpleAccent,
          unselectedLabelColor: AppTheme.textSecondary,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          tabs: const [
            Tab(icon: Icon(CupertinoIcons.doc_text_fill, size: 20), text: 'Purchase Orders'),
            Tab(icon: Icon(CupertinoIcons.building_2_fill, size: 20), text: 'Vendors Directory'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.plus_circle_fill, color: Colors.purpleAccent),
            tooltip: 'Add',
            onPressed: () {
              if (_tabController.index == 0) {
                _showAddEditPODialog(context);
              } else {
                _showAddEditVendorDialog(context);
              }
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.purple.shade700,
        icon: const Icon(CupertinoIcons.plus, color: Colors.white),
        label: Text(
          _tabController.index == 0 ? 'New Purchase Order' : 'Add New Vendor',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        onPressed: () {
          if (_tabController.index == 0) {
            _showAddEditPODialog(context);
          } else {
            _showAddEditVendorDialog(context);
          }
        },
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPurchaseOrdersTab(firebaseService),
          _buildVendorsDirectoryTab(firebaseService),
        ],
      ),
    );
  }

  // ============================================================================
  // TAB 1: PURCHASE ORDERS
  // ============================================================================
  Widget _buildPurchaseOrdersTab(FirebaseService firebaseService) {
    return StreamBuilder<List<PurchaseOrderModel>>(
      stream: firebaseService.getPurchaseOrdersStream(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const AppLoadingIndicator(message: 'Loading vendor purchase orders...');
        }

        if (snapshot.hasError) {
          return AppErrorWidget(
            message: 'Failed to load purchase orders: ${snapshot.error}',
            onRetry: () => setState(() {}),
          );
        }

        final pos = snapshot.data ?? [];
        final totalPayable = pos.fold<double>(0, (sum, p) => sum + p.balanceDue);
        final totalPaid = pos.fold<double>(0, (sum, p) => sum + p.paidAmount);
        final pendingCount = pos.where((p) => !p.isReceived).length;

        final q = _poSearchQuery.trim().toLowerCase();
        final tokens = q.split(RegExp(r'\s+'));
        final filtered = pos.where((po) {
          if (q.isNotEmpty) {
            final itemsSearchable = po.items.map((i) => '${i.productName} ${i.barcode ?? ''}').join(' ');
            final searchable = '${po.id} ${po.vendorName} ${po.phone} ${po.notes} $itemsSearchable'.toLowerCase();
            final matchesQuery = tokens.every((t) => searchable.contains(t));
            if (!matchesQuery) return false;
          }

          switch (_poFilter) {
            case 'PENDING':
              return !po.isReceived;
            case 'RECEIVED':
              return po.isReceived;
            case 'PAYABLE':
              return po.balanceDue > 0;
            case 'PAID':
              return po.balanceDue <= 0 && po.totalCost > 0;
            default:
              return true;
          }
        }).toList();

        return RefreshIndicator(
          onRefresh: () async => setState(() {}),
          child: Column(
            children: [
              // Summary KPI Header
              Container(
                margin: const EdgeInsets.fromLTRB(AppTheme.spacingM, AppTheme.spacingM, AppTheme.spacingM, 0),
                padding: const EdgeInsets.all(AppTheme.spacingM),
                decoration: BoxDecoration(
                  color: AppTheme.cardBackground,
                  borderRadius: BorderRadius.circular(AppTheme.radiusL),
                  border: Border.all(color: Colors.purple.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Vendor Payable Due',
                          style: AppTheme.labelMedium.copyWith(color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'PKR ${totalPayable.toStringAsFixed(0)}',
                          style: AppTheme.headlineLarge.copyWith(
                            color: totalPayable > 0 ? Colors.redAccent : AppTheme.successGreen,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Paid: PKR ${totalPaid.toStringAsFixed(0)} • Pending Fulfillment: $pendingCount',
                          style: const TextStyle(color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.purple.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      ),
                      child: const Icon(CupertinoIcons.cube_box_fill, color: Colors.purpleAccent, size: 30),
                    ),
                  ],
                ),
              ),

              // Search & Filter Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM, vertical: 8),
                child: TextField(
                  controller: _poSearchController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'Search POs by vendor, phone, notes...',
                    hintStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                    prefixIcon: const Icon(CupertinoIcons.search, size: 20, color: AppTheme.textSecondary),
                    suffixIcon: _poSearchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(CupertinoIcons.clear_circled_solid, size: 18, color: Colors.white54),
                            onPressed: () {
                              _poSearchController.clear();
                              setState(() => _poSearchQuery = '');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppTheme.cardBackground,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      borderSide: const BorderSide(color: AppTheme.borderColor),
                    ),
                  ),
                  onChanged: (val) => setState(() => _poSearchQuery = val),
                ),
              ),

              // Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM),
                child: Row(
                  children: [
                    _buildFilterChip('ALL', 'All (${pos.length})'),
                    _buildFilterChip('PAYABLE', 'Payable (${pos.where((p) => p.balanceDue > 0).length})'),
                    _buildFilterChip('PENDING', 'Pending Delivery ($pendingCount)'),
                    _buildFilterChip('RECEIVED', 'Received (${pos.where((p) => p.isReceived).length})'),
                    _buildFilterChip('PAID', 'Cleared / Paid (${pos.where((p) => p.balanceDue <= 0 && p.totalCost > 0).length})'),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // PO List
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Text(
                          pos.isEmpty ? 'No purchase orders recorded yet.' : 'No POs matching your search/filter.',
                          style: const TextStyle(color: AppTheme.textSecondary),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(
                          left: AppTheme.spacingM,
                          right: AppTheme.spacingM,
                          bottom: AppTheme.spacingXL * 3,
                        ),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                        itemBuilder: (context, index) {
                          final po = filtered[index];
                          return _buildPOCard(context, po);
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterChip(String filterKey, String label) {
    final isSelected = _poFilter == filterKey;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        selectedColor: Colors.purple.withOpacity(0.3),
        backgroundColor: AppTheme.cardBackground,
        labelStyle: TextStyle(
          color: isSelected ? Colors.purpleAccent : Colors.white70,
          fontSize: 11,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: isSelected ? Colors.purpleAccent : AppTheme.borderColor),
        ),
        onSelected: (val) {
          setState(() => _poFilter = filterKey);
        },
      ),
    );
  }

  Widget _buildPOCard(BuildContext context, PurchaseOrderModel po) {
    final isCleared = po.balanceDue <= 0;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppTheme.radiusM),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusM),
        onTap: () => _showPODetailsSheet(context, po),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingM),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            po.vendorName,
                            style: AppTheme.bodyLarge.copyWith(fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(CupertinoIcons.chevron_right, size: 14, color: AppTheme.textSecondary),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      // Status chip (Pending / Received)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        margin: const EdgeInsets.only(right: 4),
                        decoration: BoxDecoration(
                          color: po.isReceived ? Colors.teal.withOpacity(0.15) : Colors.orange.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(AppTheme.radiusS),
                        ),
                        child: Text(
                          po.status.toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: po.isReceived ? Colors.tealAccent : Colors.orangeAccent,
                          ),
                        ),
                      ),
                      // Payment chip
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: isCleared ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(AppTheme.radiusS),
                        ),
                        child: Text(
                          isCleared ? 'PAID' : (po.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: isCleared ? Colors.greenAccent : Colors.redAccent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Billed, Paid, Due row
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceDark.withOpacity(0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildAmountColumn('Total Billed', 'PKR ${po.totalCost.toStringAsFixed(0)}', Colors.white),
                    _buildAmountColumn('Paid', 'PKR ${po.paidAmount.toStringAsFixed(0)}', AppTheme.successGreen),
                    _buildAmountColumn('Balance Due', 'PKR ${po.balanceDue.toStringAsFixed(0)}', isCleared ? AppTheme.successGreen : Colors.redAccent, isBold: true),
                  ],
                ),
              ),

              if (po.notes.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  po.notes,
                  style: const TextStyle(color: Colors.white70, fontSize: 11, fontStyle: FontStyle.italic),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],

              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    AppDateUtils.formatDateTime(po.timestamp),
                    style: AppTheme.labelSmall.copyWith(color: AppTheme.textSecondary, fontSize: 10),
                  ),
                  if (po.items.isNotEmpty)
                    Text(
                      '${po.items.length} items',
                      style: const TextStyle(color: Colors.purpleAccent, fontSize: 10, fontWeight: FontWeight.w600),
                    ),
                ],
              ),

              const Divider(height: 14, color: AppTheme.borderColor),

              // Actions Row
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (po.phone.isNotEmpty) ...[
                    TextButton.icon(
                      style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                      icon: const Icon(CupertinoIcons.chat_bubble_2_fill, size: 15, color: Color(0xFF25D366)),
                      label: const Text('WhatsApp', style: TextStyle(color: Color(0xFF25D366), fontSize: 11, fontWeight: FontWeight.bold)),
                      onPressed: () => WhatsAppHelper.sendVendorPO(po: po),
                    ),
                    const SizedBox(width: 4),
                  ],
                  TextButton.icon(
                    style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                    icon: const Icon(CupertinoIcons.money_dollar, size: 15, color: AppTheme.primaryTeal),
                    label: const Text('Pay', style: TextStyle(color: AppTheme.primaryTeal, fontSize: 11, fontWeight: FontWeight.bold)),
                    onPressed: () => _showPODetailsSheet(context, po),
                  ),
                  const SizedBox(width: 4),
                  TextButton.icon(
                    style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
                    icon: const Icon(CupertinoIcons.pencil, size: 15, color: Colors.purpleAccent),
                    label: const Text('Edit', style: TextStyle(color: Colors.purpleAccent, fontSize: 11)),
                    onPressed: () => _showAddEditPODialog(context, po: po),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: const Icon(CupertinoIcons.trash, size: 16, color: AppTheme.errorRed),
                    tooltip: 'Delete PO',
                    onPressed: () => _confirmDeletePO(context, po),
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
  }

  Widget _buildAmountColumn(String title, String value, Color valueColor, {bool isBold = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
        const SizedBox(height: 1),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 12,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // ============================================================================
  // TAB 2: VENDORS DIRECTORY
  // ============================================================================
  Widget _buildVendorsDirectoryTab(FirebaseService firebaseService) {
    return StreamBuilder<List<VendorModel>>(
      stream: firebaseService.getVendorsStream(),
      builder: (context, vendorSnapshot) {
        if (vendorSnapshot.connectionState == ConnectionState.waiting) {
          return const AppLoadingIndicator(message: 'Loading vendor directory...');
        }

        if (vendorSnapshot.hasError) {
          return AppErrorWidget(
            message: 'Failed to load vendors: ${vendorSnapshot.error}',
            onRetry: () => setState(() {}),
          );
        }

        final vendors = vendorSnapshot.data ?? [];

        // Also stream POs to calculate real-time vendor balances
        return StreamBuilder<List<PurchaseOrderModel>>(
          stream: firebaseService.getPurchaseOrdersStream(),
          builder: (context, poSnapshot) {
            final pos = poSnapshot.data ?? [];

            // Map vendor balances & PO counts
            final Map<String, double> vendorBalances = {};
            final Map<String, int> vendorPOCounts = {};

            for (final po in pos) {
              final vKey = po.vendorName.trim().toLowerCase();
              vendorBalances[vKey] = (vendorBalances[vKey] ?? 0.0) + po.balanceDue;
              vendorPOCounts[vKey] = (vendorPOCounts[vKey] ?? 0) + 1;
            }

            final filteredVendors = vendors.where((v) {
              final q = _vendorSearchQuery.trim().toLowerCase();
              if (q.isNotEmpty) {
                final tokens = q.split(RegExp(r'\s+'));
                final searchable = '${v.name} ${v.contact} ${v.category}'.toLowerCase();
                final matchesAll = tokens.every((t) => searchable.contains(t));
                if (!matchesAll) return false;
              }

              if (_selectedCategory != 'ALL' && v.category.trim().toLowerCase() != _selectedCategory.toLowerCase()) {
                return false;
              }

              return true;
            }).toList();

            return Column(
              children: [
                // Top Search & Category Filter
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppTheme.spacingM, AppTheme.spacingM, AppTheme.spacingM, 4),
                  child: TextField(
                    controller: _vendorSearchController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Search vendors by name, phone, category...',
                      hintStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                      prefixIcon: const Icon(CupertinoIcons.search, size: 20, color: AppTheme.textSecondary),
                      suffixIcon: _vendorSearchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(CupertinoIcons.clear_circled_solid, size: 18, color: Colors.white54),
                              onPressed: () {
                                _vendorSearchController.clear();
                                setState(() => _vendorSearchQuery = '');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: AppTheme.cardBackground,
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                        borderSide: const BorderSide(color: AppTheme.borderColor),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radiusM),
                        borderSide: const BorderSide(color: AppTheme.borderColor),
                      ),
                    ),
                    onChanged: (val) => setState(() => _vendorSearchQuery = val),
                  ),
                ),

                // Category Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM, vertical: 4),
                  child: Row(
                    children: _vendorCategories.map((cat) {
                      final isSelected = _selectedCategory == cat;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: FilterChip(
                          label: Text(cat),
                          selected: isSelected,
                          selectedColor: Colors.purple.withOpacity(0.3),
                          backgroundColor: AppTheme.cardBackground,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.purpleAccent : Colors.white70,
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                            side: BorderSide(color: isSelected ? Colors.purpleAccent : AppTheme.borderColor),
                          ),
                          onSelected: (val) => setState(() => _selectedCategory = cat),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 4),

                // Vendors List
                Expanded(
                  child: filteredVendors.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(CupertinoIcons.building_2_fill, size: 64, color: AppTheme.textSecondary),
                              const SizedBox(height: 12),
                              Text(
                                vendors.isEmpty ? 'No vendors added yet.' : 'No vendors matching "$_vendorSearchQuery".',
                                style: const TextStyle(color: AppTheme.textSecondary),
                              ),
                              const SizedBox(height: 12),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.purpleAccent,
                                  foregroundColor: Colors.white,
                                ),
                                icon: const Icon(CupertinoIcons.plus),
                                label: const Text('Add New Vendor Profile'),
                                onPressed: () => _showAddEditVendorDialog(context),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.only(
                            left: AppTheme.spacingM,
                            right: AppTheme.spacingM,
                            bottom: AppTheme.spacingXL * 3,
                          ),
                          itemCount: filteredVendors.length,
                          separatorBuilder: (_, __) => const SizedBox(height: AppTheme.spacingS),
                          itemBuilder: (context, index) {
                            final vendor = filteredVendors[index];
                            final double due = vendorBalances[vendor.name.trim().toLowerCase()] ?? 0.0;
                            final int poCount = vendorPOCounts[vendor.name.trim().toLowerCase()] ?? 0;

                            return _buildVendorCard(context, vendor, due, poCount);
                          },
                        ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildVendorCard(BuildContext context, VendorModel vendor, double due, int poCount) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.cardBackground,
        borderRadius: BorderRadius.circular(AppTheme.radiusM),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingM),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: Colors.purple.withOpacity(0.2),
                        child: Text(
                          vendor.name.isNotEmpty ? vendor.name[0].toUpperCase() : 'V',
                          style: const TextStyle(color: Colors.purpleAccent, fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              vendor.name,
                              style: AppTheme.bodyLarge.copyWith(fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.white10,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    vendor.category,
                                    style: const TextStyle(color: Colors.white70, fontSize: 10),
                                  ),
                                ),
                                if (vendor.contact.isNotEmpty) ...[
                                  const SizedBox(width: 8),
                                  const Icon(CupertinoIcons.phone, size: 11, color: AppTheme.textSecondary),
                                  const SizedBox(width: 2),
                                  Text(
                                    vendor.contact,
                                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Balance Due', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
                    Text(
                      'PKR ${due.toStringAsFixed(0)}',
                      style: TextStyle(
                        color: due > 0 ? Colors.redAccent : AppTheme.successGreen,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      '$poCount POs recorded',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
            const Divider(height: 16, color: AppTheme.borderColor),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    if (vendor.contact.isNotEmpty) ...[
                      IconButton(
                        icon: const Icon(CupertinoIcons.phone_fill, size: 18, color: AppTheme.primaryCyan),
                        tooltip: 'Call Vendor',
                        onPressed: () async {
                          final uri = Uri.parse('tel:${vendor.contact}');
                          if (await canLaunchUrl(uri)) await launchUrl(uri);
                        },
                      ),
                      IconButton(
                        icon: const Icon(CupertinoIcons.chat_bubble_2_fill, size: 18, color: Color(0xFF25D366)),
                        tooltip: 'WhatsApp Vendor',
                        onPressed: () => WhatsAppHelper.openWhatsApp(
                          phone: vendor.contact,
                          message: 'Assalam-o-Alaikum ${vendor.name}, regarding SS Mart purchase orders and ledger balance.',
                        ),
                      ),
                    ],
                  ],
                ),
                Row(
                  children: [
                    TextButton.icon(
                      icon: const Icon(CupertinoIcons.plus_circle, size: 14, color: Colors.purpleAccent),
                      label: const Text('Create PO', style: TextStyle(color: Colors.purpleAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                      onPressed: () => _showAddEditPODialog(context, prefillVendor: vendor),
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(CupertinoIcons.pencil, size: 16, color: Colors.white70),
                      tooltip: 'Edit Vendor Profile',
                      onPressed: () => _showAddEditVendorDialog(context, vendor: vendor),
                    ),
                    IconButton(
                      icon: const Icon(CupertinoIcons.trash, size: 16, color: AppTheme.errorRed),
                      tooltip: 'Delete Vendor Profile',
                      onPressed: () => _confirmDeleteVendor(context, vendor),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // DIALOGS: ADD / EDIT PURCHASE ORDER
  // ============================================================================
  void _showAddEditPODialog(BuildContext context, {PurchaseOrderModel? po, VendorModel? prefillVendor}) {
    final isEditing = po != null;
    final nameCtrl = TextEditingController(text: po?.vendorName ?? prefillVendor?.name ?? '');
    final contactCtrl = TextEditingController(text: po?.contactPerson ?? prefillVendor?.name ?? '');
    final phoneCtrl = TextEditingController(text: po?.phone ?? prefillVendor?.contact ?? '');
    final emailCtrl = TextEditingController(text: po?.email ?? '');
    final billedCtrl = TextEditingController(text: po != null && po.totalCost > 0 ? po.totalCost.toStringAsFixed(0) : '');
    final paidCtrl = TextEditingController(text: po != null && po.paidAmount > 0 ? po.paidAmount.toStringAsFixed(0) : '0');
    final noteCtrl = TextEditingController(text: po?.notes ?? '');
    String selectedStatus = po?.status ?? 'Pending';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return Padding(
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isEditing ? 'Update Purchase Order #${po.id}' : 'New Purchase Order',
                        style: AppTheme.headlineMedium.copyWith(color: Colors.purpleAccent),
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
                    decoration: const InputDecoration(
                      labelText: 'Vendor / Company Name *',
                      prefixIcon: Icon(CupertinoIcons.building_2_fill),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Phone (WhatsApp Ledger)',
                      prefixIcon: Icon(CupertinoIcons.phone),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: billedCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Total Bill (PKR) *',
                            prefixIcon: Icon(CupertinoIcons.money_dollar),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: paidCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Paid Amount (PKR)',
                            prefixIcon: Icon(CupertinoIcons.checkmark_seal_fill),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Order Status Selector
                  Row(
                    children: [
                      const Text('Fulfillment Status:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                      const SizedBox(width: 12),
                      ChoiceChip(
                        label: const Text('Pending'),
                        selected: selectedStatus == 'Pending',
                        selectedColor: Colors.orange.withOpacity(0.3),
                        labelStyle: TextStyle(
                          color: selectedStatus == 'Pending' ? Colors.orangeAccent : Colors.white70,
                          fontWeight: selectedStatus == 'Pending' ? FontWeight.bold : FontWeight.normal,
                        ),
                        onSelected: (val) {
                          if (val) setDialogState(() => selectedStatus = 'Pending');
                        },
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: const Text('Received'),
                        selected: selectedStatus == 'Received',
                        selectedColor: Colors.teal.withOpacity(0.3),
                        labelStyle: TextStyle(
                          color: selectedStatus == 'Received' ? Colors.tealAccent : Colors.white70,
                          fontWeight: selectedStatus == 'Received' ? FontWeight.bold : FontWeight.normal,
                        ),
                        onSelected: (val) {
                          if (val) setDialogState(() => selectedStatus = 'Received');
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Invoice # / Notes / Items description',
                      prefixIcon: Icon(CupertinoIcons.doc_plaintext),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.purple.shade700,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(CupertinoIcons.checkmark_alt_circle),
                      label: Text(isEditing ? 'Update Purchase Order' : 'Save Purchase Order', style: const TextStyle(fontWeight: FontWeight.bold)),
                      onPressed: () async {
                        final name = nameCtrl.text.trim();
                        final phone = phoneCtrl.text.trim();
                        final billed = double.tryParse(billedCtrl.text.trim()) ?? 0;
                        final paid = double.tryParse(paidCtrl.text.trim()) ?? 0;

                        if (name.isEmpty || billed <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please enter vendor name and billed amount (> 0)')),
                          );
                          return;
                        }

                        final paymentStatus = paid >= billed && billed > 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid');

                        Navigator.pop(ctx);
                        await context.read<FirebaseService>().saveVendorPurchaseOrder(
                          id: po?.id.toString(),
                          vendorId: po?.vendorId ?? prefillVendor?.id,
                          vendorName: name,
                          contactPerson: contactCtrl.text.trim().isNotEmpty ? contactCtrl.text.trim() : name,
                          phone: phone,
                          email: emailCtrl.text.trim(),
                          totalAmount: billed,
                          paidAmount: paid,
                          status: selectedStatus,
                          paymentStatus: paymentStatus,
                          notes: noteCtrl.text.trim(),
                          items: po?.items,
                          payments: po?.payments,
                          orderEntries: po?.orderEntries,
                        );

                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(isEditing ? 'Purchase Order updated!' : 'Purchase Order created!'),
                            backgroundColor: Colors.purpleAccent,
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ============================================================================
  // DIALOGS: ADD / EDIT VENDOR PROFILE
  // ============================================================================
  void _showAddEditVendorDialog(BuildContext context, {VendorModel? vendor}) {
    final isEditing = vendor != null;
    final nameCtrl = TextEditingController(text: vendor?.name ?? '');
    final phoneCtrl = TextEditingController(text: vendor?.contact ?? '');
    String selectedCat = vendor?.category ?? 'General';
    if (!_vendorCategories.contains(selectedCat) && selectedCat != 'ALL') {
      selectedCat = 'General';
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return Padding(
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isEditing ? 'Edit Vendor Profile' : 'New Vendor Profile',
                        style: AppTheme.headlineMedium.copyWith(color: Colors.purpleAccent),
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
                    decoration: const InputDecoration(
                      labelText: 'Vendor / Company Name *',
                      prefixIcon: Icon(CupertinoIcons.building_2_fill),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Contact Phone Number (WhatsApp)',
                      prefixIcon: Icon(CupertinoIcons.phone),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('Category:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _vendorCategories.where((c) => c != 'ALL').map((c) {
                      final isSelected = selectedCat == c;
                      return ChoiceChip(
                        label: Text(c),
                        selected: isSelected,
                        selectedColor: Colors.purple.withOpacity(0.3),
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.purpleAccent : Colors.white70,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 12,
                        ),
                        onSelected: (val) {
                          if (val) setDialogState(() => selectedCat = c);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.purple.shade700,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(CupertinoIcons.checkmark_alt_circle),
                      label: Text(isEditing ? 'Update Vendor' : 'Save Vendor Profile', style: const TextStyle(fontWeight: FontWeight.bold)),
                      onPressed: () async {
                        final name = nameCtrl.text.trim();
                        final phone = phoneCtrl.text.trim();

                        if (name.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please enter vendor name')),
                          );
                          return;
                        }

                        Navigator.pop(ctx);
                        await context.read<FirebaseService>().saveVendor(
                          id: vendor?.id.toString(),
                          name: name,
                          contact: phone,
                          category: selectedCat,
                        );

                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(isEditing ? 'Vendor updated!' : 'Vendor profile saved!'),
                            backgroundColor: Colors.purpleAccent,
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _confirmDeletePO(BuildContext context, PurchaseOrderModel po) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Purchase Order?'),
        content: Text('Are you sure you want to delete PO #${po.id} for "${po.vendorName}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<FirebaseService>().deleteVendorPurchaseOrder(po.id.toString());
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Deleted PO for ${po.vendorName}')),
              );
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteVendor(BuildContext context, VendorModel vendor) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Vendor Profile?'),
        content: Text('Are you sure you want to delete vendor "${vendor.name}"? This will not delete historical purchase orders.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<FirebaseService>().deleteVendor(vendor.id.toString());
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Deleted vendor profile for ${vendor.name}')),
              );
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
