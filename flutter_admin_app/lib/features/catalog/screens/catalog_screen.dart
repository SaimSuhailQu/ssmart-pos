import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/product.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';
import 'package:ssmart_pos_admin/widgets/error_widget.dart';
import 'package:ssmart_pos_admin/widgets/loading_indicator.dart';

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
                    // Search bar
                    TextField(
                      controller: _searchController,
                      style: AppTheme.bodyMedium,
                      decoration: InputDecoration(
                        hintText: 'Search by name, category, or barcode...',
                        prefixIcon: const Icon(CupertinoIcons.search, color: AppTheme.textSecondary),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(CupertinoIcons.xmark_circle_fill, color: AppTheme.textSecondary),
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

                    // Categories scrollable row
                    SizedBox(
                      height: 38,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: categories.map((category) {
                          final isSelected = _selectedCategory == category;
                          return Padding(
                            padding: const EdgeInsets.only(right: AppTheme.spacingS),
                            child: ChoiceChip(
                              label: Text(category),
                              selected: isSelected,
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _selectedCategory = category;
                                  });
                                }
                              },
                              backgroundColor: AppTheme.backgroundLight,
                              selectedColor: AppTheme.primaryCyan.withValues(alpha: 0.15),
                              labelStyle: AppTheme.bodyMedium.copyWith(
                                color: isSelected ? AppTheme.primaryCyan : AppTheme.textSecondary,
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                              ),
                              side: BorderSide(
                                color: isSelected ? AppTheme.primaryCyan.withValues(alpha: 0.4) : AppTheme.borderColor,
                                width: 0.5,
                              ),
                            ),
                          );
                        }).toList(),
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
                        padding: const EdgeInsets.only(bottom: AppTheme.spacingL),
                        itemCount: filteredProducts.length,
                        itemBuilder: (context, index) {
                          final product = filteredProducts[index];
                          return _ProductCatalogCard(product: product);
                        },
                      ),
              ),
            ],
          );
        },
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

  const _ProductCatalogCard({required this.product});

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
            // Row 1: Category Tag & Stock Level Badge
            Row(
              children: [
                // Category badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.secondaryPurple.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.solid(color: AppTheme.secondaryPurple.withValues(alpha: 0.25), width: 0.5),
                  ),
                  child: Text(
                    product.category,
                    style: AppTheme.labelSmall.copyWith(
                      color: AppTheme.secondaryPurple,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const Spacer(),
                // Stock level indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: stockColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.solid(color: stockColor.withValues(alpha: 0.25), width: 0.5),
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
