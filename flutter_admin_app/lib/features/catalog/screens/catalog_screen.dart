import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/currency_formatter.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/core/widgets/app_loading_indicator.dart';
import 'package:ssmart_pos_admin/core/widgets/barcode_scanner_sheet.dart';
import 'package:ssmart_pos_admin/models/product.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

/// Screen displaying the items catalog database with real-time sync
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'All';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Product> _filterProducts(List<Product> products) {
    var filtered = products;

    // Apply category filter
    if (_selectedCategory != 'All') {
      filtered = filtered.where((p) => p.category.toLowerCase() == _selectedCategory.toLowerCase()).toList();
    }

    // Apply search query
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((p) {
        final matchesName = p.name.toLowerCase().contains(query);
        final matchesBarcode = p.barcode.contains(query);
        final matchesCategory = p.category.toLowerCase().contains(query);
        return matchesName || matchesBarcode || matchesCategory;
      }).toList();
    }

    return filtered;
  }

  Set<String> _extractCategories(List<Product> products) {
    final categories = {'All'};
    for (var p in products) {
      if (p.category.isNotEmpty) {
        categories.add(p.category);
      }
    }
    return categories;
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Items Catalog'),
        leading: IconButton(
          icon: const Icon(CupertinoIcons.back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.add_circled, color: AppTheme.primaryTeal),
            tooltip: 'Add New Item',
            onPressed: () => _showProductDialog(context, null),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primaryTeal,
        icon: const Icon(CupertinoIcons.plus, color: Colors.black),
        label: const Text('Add Product', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
        onPressed: () => _showProductDialog(context, null),
      ),
      body: StreamBuilder<List<Product>>(
        stream: firebaseService.getProductsStream(),
        builder: (context, snapshot) {
          // Loading state
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const AppLoadingIndicator(
              message: 'Loading catalog...',
            );
          }

          // Error state
          if (snapshot.hasError) {
            return AppErrorWidget(
              message: 'Failed to load products database',
              error: snapshot.error.toString(),
              onRetry: () => setState(() {}),
            );
          }

          // Empty state
          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return _buildEmptyState();
          }

          final allProducts = snapshot.data!;
          final filteredProducts = _filterProducts(allProducts);
          final categories = _extractCategories(allProducts);

          return Column(
            children: [
              // Search & Categories header
              Container(
                color: AppTheme.cardBackground,
                padding: const EdgeInsets.all(AppTheme.spacingM),
                child: Column(
                  children: [
                    // Search bar with camera scan button
                    TextField(
                      controller: _searchController,
                      style: AppTheme.bodyMedium,
                      decoration: InputDecoration(
                        hintText: 'Search or scan barcode...',
                        prefixIcon: const Icon(CupertinoIcons.search, color: AppTheme.textSecondary),
                        suffixIcon: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_searchQuery.isNotEmpty)
                              IconButton(
                                icon: const Icon(CupertinoIcons.xmark_circle_fill, color: AppTheme.textSecondary, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              ),
                            IconButton(
                              icon: const Icon(CupertinoIcons.barcode_viewfinder, color: AppTheme.primaryCyan, size: 22),
                              tooltip: 'Scan Barcode with Camera',
                              onPressed: () async {
                                final scanned = await showModalBottomSheet<String>(
                                  context: context,
                                  isScrollControlled: true,
                                  backgroundColor: Colors.transparent,
                                  builder: (ctx) => const BarcodeScannerSheet(),
                                );
                                if (scanned != null && scanned.isNotEmpty) {
                                  _searchController.text = scanned;
                                  setState(() => _searchQuery = scanned);
                                }
                              },
                            ),
                          ],
                        ),
                      ),
                      onChanged: (val) => setState(() => _searchQuery = val),
                    ),
                    const SizedBox(height: AppTheme.spacingS),

                    // Categories horizontal list
                    SizedBox(
                      height: 36,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: categories.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, idx) {
                          final cat = categories.elementAt(idx);
                          final isSelected = cat.toLowerCase() == _selectedCategory.toLowerCase();

                          return FilterChip(
                            label: Text(cat),
                            selected: isSelected,
                            onSelected: (selected) {
                              setState(() {
                                _selectedCategory = cat;
                              });
                            },
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),

              // Total items summary bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM, vertical: AppTheme.spacingS),
                child: Row(
                  children: [
                    Text(
                      'Showing ${filteredProducts.length} of ${allProducts.length} items',
                      style: AppTheme.bodySmall,
                    ),
                    const Spacer(),
                    const Icon(CupertinoIcons.circle_fill, size: 8, color: AppTheme.primaryTeal),
                    const SizedBox(width: 4),
                    Text(
                      'Real-time Synced',
                      style: AppTheme.labelSmall.copyWith(color: AppTheme.primaryTeal),
                    ),
                  ],
                ),
              ),

              // Products list
              Expanded(
                child: filteredProducts.isEmpty
                    ? _buildNoResultsState()
                    : ListView.builder(
                        padding: const EdgeInsets.only(bottom: AppTheme.spacingXL * 2),
                        itemCount: filteredProducts.length,
                        itemBuilder: (context, index) {
                          final product = filteredProducts[index];
                          return _ProductCatalogCard(
                            product: product,
                            onEdit: () => _showProductDialog(context, product),
                            onDelete: () => _confirmDeleteProduct(context, product),
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

  void _showProductDialog(BuildContext context, Product? product) {
    final isEditing = product != null;
    final nameCtrl = TextEditingController(text: product?.name ?? '');
    final barcodeCtrl = TextEditingController(text: product?.barcode ?? '');
    final priceCtrl = TextEditingController(text: product?.price != null ? product!.price.toString() : '');
    final costCtrl = TextEditingController(text: product?.costPrice != null ? product!.costPrice.toString() : '');
    final stockCtrl = TextEditingController(text: product?.stock != null ? product!.stock.toString() : '0');
    final catCtrl = TextEditingController(text: product?.category ?? 'General');

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
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isEditing ? 'Edit Product' : 'Add New Product',
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
                decoration: const InputDecoration(labelText: 'Item Name', prefixIcon: Icon(CupertinoIcons.tag)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: barcodeCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Barcode / SKU',
                  prefixIcon: const Icon(CupertinoIcons.barcode),
                  suffixIcon: IconButton(
                    icon: const Icon(CupertinoIcons.camera_fill, color: AppTheme.primaryCyan),
                    tooltip: 'Scan Barcode',
                    onPressed: () async {
                      final scanned = await showModalBottomSheet<String>(
                        context: ctx,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (scannerCtx) => const BarcodeScannerSheet(),
                      );
                      if (scanned != null && scanned.isNotEmpty) {
                        barcodeCtrl.text = scanned;
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: priceCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Retail Price (Rs)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: costCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Cost Price (Rs)', prefixIcon: Icon(CupertinoIcons.cart)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: stockCtrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Stock Qty', prefixIcon: Icon(CupertinoIcons.cube_box)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: catCtrl,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: 'Category', prefixIcon: Icon(CupertinoIcons.folder)),
                    ),
                  ),
                ],
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
                  label: Text(isEditing ? 'Save Changes' : 'Create Item', style: const TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    final barcode = barcodeCtrl.text.trim();
                    final price = double.tryParse(priceCtrl.text.trim()) ?? 0;
                    final cost = double.tryParse(costCtrl.text.trim()) ?? 0;
                    final stock = int.tryParse(stockCtrl.text.trim()) ?? 0;
                    final cat = catCtrl.text.trim().isEmpty ? 'General' : catCtrl.text.trim();

                    if (name.isEmpty || barcode.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please fill item name and barcode')),
                      );
                      return;
                    }

                    Navigator.pop(ctx);
                    await context.read<FirebaseService>().saveProduct(
                      id: product?.id.toString(),
                      name: name,
                      barcode: barcode,
                      price: price,
                      costPrice: cost,
                      stock: stock,
                      category: cat,
                    );

                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(isEditing ? 'Item "$name" updated!' : 'Item "$name" added to catalog!'),
                        backgroundColor: AppTheme.primaryTeal,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeleteProduct(BuildContext context, Product product) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Product?'),
        content: Text('Are you sure you want to delete "${product.name}" (${product.barcode})?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.errorRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<FirebaseService>().deleteProduct(product.id.toString());
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Deleted "${product.name}"')),
              );
            },
            child: const Text('Delete'),
          ),
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
              CupertinoIcons.circle_grid_hex_fill,
              size: 80,
              color: AppTheme.secondaryPurple,
            ),
            const SizedBox(height: AppTheme.spacingL),
            Text(
              'No Catalog Data',
              style: AppTheme.headlineMedium,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Your items database has not been synced from the Electron POS app yet.',
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
              CupertinoIcons.search_circle,
              size: 70,
              color: AppTheme.textSecondary,
            ),
            const SizedBox(height: AppTheme.spacingM),
            Text(
              'No matching items',
              style: AppTheme.titleLarge,
            ),
            const SizedBox(height: AppTheme.spacingS),
            Text(
              'Try adjusting your search filters or clear the query.',
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
                  _selectedCategory = 'All';
                });
              },
              child: const Text('Reset Filters'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Card showing individual product details
class _ProductCatalogCard extends StatelessWidget {
  final Product product;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _ProductCatalogCard({
    required this.product,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final bool isLowStock = product.stock > 0 && product.stock < 15;
    final bool isOutOfStock = product.stock == 0;

    Color stockColor = AppTheme.primaryTeal;
    String stockLabel = 'In Stock';
    if (isOutOfStock) {
      stockColor = AppTheme.errorRed;
      stockLabel = 'Out of Stock';
    } else if (isLowStock) {
      stockColor = AppTheme.warningOrange;
      stockLabel = 'Low Stock';
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingM),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Row 1: Category Tag, Stock Level Badge & Action Buttons
            Row(
              children: [
                // Category badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.secondaryPurple.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppTheme.secondaryPurple.withValues(alpha: 0.25), width: 0.5),
                  ),
                  child: Text(
                    product.category,
                    style: AppTheme.labelSmall.copyWith(
                      color: AppTheme.secondaryPurple,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Stock level indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: stockColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: stockColor.withValues(alpha: 0.25), width: 0.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: stockColor,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(color: stockColor, blurRadius: 4, spreadRadius: 1),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${product.stock} ($stockLabel)',
                        style: AppTheme.labelSmall.copyWith(
                          color: stockColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                // Edit button
                IconButton(
                  icon: const Icon(CupertinoIcons.pencil, size: 18, color: AppTheme.primaryCyan),
                  onPressed: onEdit,
                  tooltip: 'Edit Item',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 12),
                // Delete button
                IconButton(
                  icon: const Icon(CupertinoIcons.trash, size: 18, color: AppTheme.errorRed),
                  onPressed: onDelete,
                  tooltip: 'Delete Item',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: AppTheme.spacingS),

            // Row 2: Product Name
            Text(
              product.name,
              style: AppTheme.titleMedium.copyWith(color: AppTheme.textPrimary),
            ),
            const SizedBox(height: AppTheme.spacingXS),

            // Row 3: Barcode
            Row(
              children: [
                const Icon(CupertinoIcons.barcode, size: 14, color: AppTheme.textSecondary),
                const SizedBox(width: 4),
                Text(
                  product.barcode,
                  style: AppTheme.bodySmall.copyWith(fontFamily: 'monospace'),
                ),
              ],
            ),
            const SizedBox(height: AppTheme.spacingM),

            const Divider(color: AppTheme.borderColor, height: 1),
            const SizedBox(height: AppTheme.spacingM),

            // Row 4: Pricing Columns (Selling Price, Cost Price, Markup)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Selling Price
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'SELLING PRICE',
                      style: AppTheme.labelSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppDateUtils.formatCurrency(product.price),
                      style: AppTheme.titleLarge.copyWith(color: AppTheme.primaryCyan),
                    ),
                  ],
                ),
                // Cost Price
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'COST PRICE',
                      style: AppTheme.labelSmall,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppDateUtils.formatCurrency(product.costPrice),
                      style: AppTheme.titleLarge.copyWith(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
                // Markup
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'MARKUP',
                      style: AppTheme.labelSmall,
                    ),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryTeal.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '+${product.markupPercentage.toStringAsFixed(1)}%',
                        style: AppTheme.labelMedium.copyWith(
                          color: AppTheme.primaryTeal,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
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
}
