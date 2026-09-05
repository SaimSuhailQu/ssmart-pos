import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/utils/receipt_printer_helper.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/core/widgets/app_loading_indicator.dart';
import 'package:ssmart_pos_admin/core/widgets/barcode_scanner_sheet.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/models/product.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

class CartItemModel {
  final int? productId;
  final String name;
  final String barcode;
  final double price;
  int quantity;

  CartItemModel({
    this.productId,
    required this.name,
    required this.barcode,
    required this.price,
    this.quantity = 1,
  });

  double get total => price * quantity;
}

class MobileCheckoutScreen extends StatefulWidget {
  const MobileCheckoutScreen({super.key});

  @override
  State<MobileCheckoutScreen> createState() => _MobileCheckoutScreenState();
}

class _MobileCheckoutScreenState extends State<MobileCheckoutScreen> {
  final List<CartItemModel> _cart = [];
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'ALL';
  double _discount = 0.0;
  double _tax = 0.0;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Selected customer for this bill (null = Walk-in Cash Customer)
  CustomerModel? _selectedCustomer;

  double get _subtotal => _cart.fold(0.0, (sum, item) => sum + item.total);
  double get _total => (_subtotal - _discount + _tax).clamp(0.0, double.infinity);
  int get _totalItemCount => _cart.fold(0, (sum, item) => sum + item.quantity);

  void _addToCart(Product product) {
    setState(() {
      final existingIndex = _cart.indexWhere((item) => item.productId == product.id || item.barcode == product.barcode);
      if (existingIndex >= 0) {
        _cart[existingIndex].quantity += 1;
      } else {
        _cart.add(CartItemModel(
          productId: product.id,
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          quantity: 1,
        ));
      }
    });

    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added "${product.name}" to cart'),
        duration: const Duration(milliseconds: 1000),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _addCustomItemDialog() {
    final nameCtrl = TextEditingController(text: 'General Item');
    final priceCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Item Name / Description'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: priceCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Unit Price (PKR)', prefixIcon: Icon(CupertinoIcons.money_dollar)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Quantity', prefixIcon: Icon(CupertinoIcons.number)),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryCyan, foregroundColor: Colors.black),
            onPressed: () {
              final name = nameCtrl.text.trim();
              final price = double.tryParse(priceCtrl.text.trim()) ?? 0;
              final qty = int.tryParse(qtyCtrl.text.trim()) ?? 1;

              if (name.isEmpty || price <= 0) return;

              setState(() {
                _cart.add(CartItemModel(
                  productId: null,
                  name: name,
                  barcode: 'MANUAL',
                  price: price,
                  quantity: qty,
                ));
              });

              Navigator.pop(ctx);
            },
            child: const Text('Add to Bill'),
          ),
        ],
      ),
    );
  }

  void _scanBarcode(List<Product> products) async {
    final scannedBarcode = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const BarcodeScannerSheet(),
    );

    if (scannedBarcode != null && scannedBarcode.isNotEmpty) {
      final matchingProduct = products.firstWhere(
        (p) => p.barcode.trim().toLowerCase() == scannedBarcode.trim().toLowerCase(),
        orElse: () => Product(id: 0, name: '', barcode: '', price: 0, stock: 0, category: '', costPrice: 0),
      );

      if (matchingProduct.id > 0) {
        _addToCart(matchingProduct);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No product found for barcode: $scannedBarcode')),
        );
      }
    }
  }

  void _showCartSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            height: MediaQuery.of(ctx).size.height * 0.85,
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
              top: 16,
              left: 16,
              right: 16,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Current Bill Items (${_cart.length})', style: AppTheme.headlineMedium.copyWith(color: AppTheme.primaryCyan)),
                    IconButton(
                      icon: const Icon(CupertinoIcons.xmark_circle_fill, color: Colors.white60),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const Divider(color: Colors.white24),
                Expanded(
                  child: _cart.isEmpty
                      ? const Center(child: Text('Cart is empty. Add products to continue.', style: TextStyle(color: AppTheme.textSecondary)))
                      : ListView.separated(
                          itemCount: _cart.length,
                          separatorBuilder: (_, __) => const Divider(color: Colors.white10),
                          itemBuilder: (context, index) {
                            final item = _cart[index];
                            return Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                      Text('PKR ${item.price.toStringAsFixed(0)} each', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(CupertinoIcons.minus_circle, color: Colors.redAccent, size: 22),
                                      onPressed: () {
                                        setSheetState(() {
                                          if (item.quantity > 1) {
                                            item.quantity--;
                                          } else {
                                            _cart.removeAt(index);
                                          }
                                        });
                                        setState(() {});
                                      },
                                    ),
                                    Text('${item.quantity}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                                    IconButton(
                                      icon: const Icon(CupertinoIcons.plus_circle, color: AppTheme.successGreen, size: 22),
                                      onPressed: () {
                                        setSheetState(() {
                                          item.quantity++;
                                        });
                                        setState(() {});
                                      },
                                    ),
                                  ],
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'PKR ${item.total.toStringAsFixed(0)}',
                                  style: const TextStyle(color: AppTheme.primaryCyan, fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                              ],
                            );
                          },
                        ),
                ),
                const Divider(color: Colors.white24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Bill:', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    Text(
                      'PKR ${_total.toStringAsFixed(0)}',
                      style: const TextStyle(color: AppTheme.primaryCyan, fontSize: 20, fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryCyan,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(CupertinoIcons.checkmark_alt_circle_fill),
                    label: const Text('Proceed to Payment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    onPressed: _cart.isEmpty
                        ? null
                        : () {
                            Navigator.pop(ctx);
                            _openPaymentModal();
                          },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openPaymentModal() {
    String selectedMethod = 'Cash';
    final tenderedCtrl = TextEditingController(text: _total.toStringAsFixed(0));
    final discountCtrl = TextEditingController(text: _discount > 0 ? _discount.toStringAsFixed(0) : '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setPayState) {
          final double curDiscount = double.tryParse(discountCtrl.text.trim()) ?? 0.0;
          final double curTotal = (_subtotal - curDiscount + _tax).clamp(0.0, double.infinity);
          final double tendered = double.tryParse(tenderedCtrl.text.trim()) ?? curTotal;
          final double change = (tendered - curTotal).clamp(0.0, double.infinity);

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
                      Text('Complete Payment & Checkout', style: AppTheme.headlineMedium.copyWith(color: AppTheme.primaryCyan)),
                      IconButton(
                        icon: const Icon(CupertinoIcons.xmark_circle, color: AppTheme.textSecondary),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Bill Total Banner
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.cardBackground,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.primaryCyan.withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('TOTAL PAYABLE AMOUNT', style: TextStyle(color: AppTheme.textSecondary, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.1)),
                            const SizedBox(height: 2),
                            Text(
                              'PKR ${curTotal.toStringAsFixed(0)}',
                              style: const TextStyle(color: AppTheme.primaryCyan, fontSize: 24, fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                        Text(
                          '${_cart.length} items (${_totalItemCount} pcs)',
                          style: const TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Customer Assignment
                  const Text('Customer Account:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.cardBackground,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(CupertinoIcons.person_crop_circle_fill, color: Colors.amberAccent, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              _selectedCustomer != null ? '${_selectedCustomer!.name} (${_selectedCustomer!.phone})' : 'Walk-in Cash Customer',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ],
                        ),
                        TextButton(
                          onPressed: () => _pickCustomerDialog(setPayState),
                          child: Text(_selectedCustomer != null ? 'Change' : 'Select Khata', style: const TextStyle(color: AppTheme.primaryCyan, fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Payment Method Selector
                  const Text('Payment Method:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ['Cash', 'Card', 'JazzCash', 'EasyPaisa', 'Bank Transfer', 'Khata (Udhaar)'].map((method) {
                      final isSelected = selectedMethod == method;
                      return ChoiceChip(
                        label: Text(method),
                        selected: isSelected,
                        selectedColor: AppTheme.primaryCyan.withOpacity(0.3),
                        backgroundColor: AppTheme.cardBackground,
                        labelStyle: TextStyle(
                          color: isSelected ? AppTheme.primaryCyan : Colors.white70,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 12,
                        ),
                        onSelected: (val) {
                          if (val) setPayState(() => selectedMethod = method);
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Tendered & Discount inputs
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: tenderedCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(
                            labelText: 'Amount Tendered (PKR)',
                            prefixIcon: Icon(CupertinoIcons.money_dollar),
                          ),
                          onChanged: (_) => setPayState(() {}),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: discountCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Discount (PKR)',
                            prefixIcon: Icon(CupertinoIcons.tag_fill),
                          ),
                          onChanged: (val) {
                            setState(() {
                              _discount = double.tryParse(val.trim()) ?? 0.0;
                            });
                            setPayState(() {});
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (selectedMethod == 'Cash' && change > 0) ...[
                    Text(
                      'Change to return: PKR ${change.toStringAsFixed(0)}',
                      style: const TextStyle(color: AppTheme.successGreen, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 8),
                  ],

                  const SizedBox(height: 16),
                  // Complete Sale & Print Action
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryCyan,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(CupertinoIcons.printer_fill),
                      label: const Text('Complete Sale & Print Bill', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                      onPressed: () => _finalizeSale(
                        context: context,
                        modalCtx: ctx,
                        discount: curDiscount,
                        total: curTotal,
                        paymentMethod: selectedMethod,
                        amountTendered: tendered,
                        changeGiven: change,
                      ),
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

  void _pickCustomerDialog(StateSetter setPayState) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StreamBuilder<List<CustomerModel>>(
        stream: context.read<FirebaseService>().getCustomersStream(),
        builder: (context, snap) {
          final customers = snap.data ?? [];
          return Container(
            height: MediaQuery.of(ctx).size.height * 0.7,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Select Customer for Khata Bill', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    IconButton(icon: const Icon(CupertinoIcons.xmark_circle), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(CupertinoIcons.person_crop_circle_badge_xmark, color: Colors.white70),
                  title: const Text('Walk-in Cash Customer', style: TextStyle(color: Colors.white)),
                  onTap: () {
                    setState(() => _selectedCustomer = null);
                    setPayState(() {});
                    Navigator.pop(ctx);
                  },
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: customers.length,
                    itemBuilder: (context, i) {
                      final c = customers[i];
                      return ListTile(
                        leading: const Icon(CupertinoIcons.person_fill, color: Colors.amberAccent),
                        title: Text(c.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        subtitle: Text('${c.phone} • Udhaar: PKR ${c.balance.toStringAsFixed(0)}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                        onTap: () {
                          setState(() => _selectedCustomer = c);
                          setPayState(() {});
                          Navigator.pop(ctx);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _finalizeSale({
    required BuildContext context,
    required BuildContext modalCtx,
    required double discount,
    required double total,
    required String paymentMethod,
    required double amountTendered,
    required double changeGiven,
  }) async {
    if (_cart.isEmpty) return;

    Navigator.pop(modalCtx); // Close payment modal

    final firebaseService = context.read<FirebaseService>();

    final List<SaleItem> saleItems = _cart.map((c) {
      return SaleItem(
        productId: c.productId ?? 0,
        productName: c.name,
        productBarcode: c.barcode,
        quantity: c.quantity,
        price: c.price,
      );
    }).toList();

    try {
      final sale = await firebaseService.processMobileSale(
        items: saleItems,
        subtotal: _subtotal,
        discount: discount,
        tax: _tax,
        total: total,
        paymentMethod: paymentMethod,
        amountTendered: amountTendered,
        changeGiven: changeGiven,
        cashierName: 'Mobile Admin',
        customerId: _selectedCustomer?.id.toString(),
        customerName: _selectedCustomer?.name,
        customerPhone: _selectedCustomer?.phone,
      );

      setState(() {
        _cart.clear();
        _discount = 0.0;
        _tax = 0.0;
        _selectedCustomer = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sale successfully recorded & stock updated!'),
          backgroundColor: AppTheme.successGreen,
        ),
      );

      // Open printable visual receipt sheet with WhatsApp & Print options
      ReceiptPrinterHelper.showReceiptDialog(context, sale: sale);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving sale: $e'), backgroundColor: AppTheme.errorRed),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final firebaseService = context.read<FirebaseService>();

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: AppBar(
        title: const Text('Mobile POS & Billing'),
        actions: [
          IconButton(
            icon: const Icon(CupertinoIcons.plus_app, color: AppTheme.primaryCyan),
            tooltip: 'Add Custom Item',
            onPressed: _addCustomItemDialog,
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceDark,
          border: const Border(top: BorderSide(color: AppTheme.borderColor)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              // Cart info button
              Expanded(
                child: InkWell(
                  onTap: _showCartSheet,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(CupertinoIcons.cart_fill, color: AppTheme.primaryCyan, size: 18),
                          const SizedBox(width: 6),
                          Text(
                            '$_totalItemCount Items in Cart',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Total: PKR ${_total.toStringAsFixed(0)}',
                        style: const TextStyle(color: AppTheme.primaryCyan, fontWeight: FontWeight.w900, fontSize: 16),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _cart.isNotEmpty ? AppTheme.primaryCyan : Colors.grey.shade700,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(CupertinoIcons.checkmark_seal_fill, size: 18),
                label: const Text('Checkout', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                onPressed: _cart.isEmpty ? null : _openPaymentModal,
              ),
            ],
          ),
        ),
      ),
      body: StreamBuilder<List<Product>>(
        stream: firebaseService.getProductsStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const AppLoadingIndicator(message: 'Loading product catalog...');
          }

          if (snapshot.hasError) {
            return AppErrorWidget(
              message: 'Failed to load catalog: ${snapshot.error}',
              onRetry: () => setState(() {}),
            );
          }

          final products = snapshot.data ?? [];

          // Extract categories
          final categories = {'ALL', ...products.map((p) => p.category.trim()).where((c) => c.isNotEmpty)}.toList();

          final q = _searchQuery.trim().toLowerCase();
          List<Product> filteredProducts = products.where((p) {
            if (q.isNotEmpty) {
              final tokens = q.split(RegExp(r'\s+'));
              final searchable = '${p.name} ${p.barcode.trim()} ${p.category.trim()} ${p.price.toStringAsFixed(0)}'.toLowerCase();
              final matchesAllTokens = tokens.every((t) => searchable.contains(t));
              if (!matchesAllTokens) return false;
            }

            if (_selectedCategory != 'ALL' && p.category.trim().toLowerCase() != _selectedCategory.toLowerCase()) {
              return false;
            }
            return true;
          }).toList();

          // If category filter returned 0 results when searching, search across all categories
          if (filteredProducts.isEmpty && q.isNotEmpty && _selectedCategory != 'ALL') {
            final tokens = q.split(RegExp(r'\s+'));
            filteredProducts = products.where((p) {
              final searchable = '${p.name} ${p.barcode.trim()} ${p.category.trim()} ${p.price.toStringAsFixed(0)}'.toLowerCase();
              return tokens.every((t) => searchable.contains(t));
            }).toList();
          }

          return Column(
            children: [
              // Search & Barcode Scan Header
              Padding(
                padding: const EdgeInsets.fromLTRB(AppTheme.spacingM, AppTheme.spacingM, AppTheme.spacingM, 4),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Search products by name or barcode...',
                          hintStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                          prefixIcon: const Icon(CupertinoIcons.search, size: 20, color: AppTheme.textSecondary),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(CupertinoIcons.clear_circled_solid, size: 18, color: Colors.white54),
                                  onPressed: () {
                                    _searchController.clear();
                                    setState(() => _searchQuery = '');
                                  },
                                )
                              : null,
                          filled: true,
                          fillColor: AppTheme.cardBackground,
                          contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppTheme.borderColor)),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppTheme.borderColor)),
                        ),
                        onChanged: (val) => setState(() => _searchQuery = val),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      style: IconButton.styleFrom(backgroundColor: AppTheme.primaryCyan, foregroundColor: Colors.black),
                      icon: const Icon(CupertinoIcons.barcode_viewfinder, size: 22),
                      tooltip: 'Scan Barcode with Camera',
                      onPressed: () => _scanBarcode(products),
                    ),
                  ],
                ),
              ),

              // Categories Row
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingM, vertical: 4),
                child: Row(
                  children: categories.map((cat) {
                    final isSelected = _selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: FilterChip(
                        label: Text(cat),
                        selected: isSelected,
                        selectedColor: AppTheme.primaryCyan.withOpacity(0.3),
                        backgroundColor: AppTheme.cardBackground,
                        labelStyle: TextStyle(
                          color: isSelected ? AppTheme.primaryCyan : Colors.white70,
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(color: isSelected ? AppTheme.primaryCyan : AppTheme.borderColor),
                        ),
                        onSelected: (val) => setState(() => _selectedCategory = cat),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 4),

              // Product Catalog Grid / List
              Expanded(
                child: filteredProducts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(CupertinoIcons.cube_box, size: 64, color: AppTheme.textSecondary),
                            const SizedBox(height: 12),
                            Text(
                              products.isEmpty ? 'No products in catalog.' : 'No products match "$_searchQuery".',
                              style: const TextStyle(color: AppTheme.textSecondary),
                            ),
                            const SizedBox(height: 12),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryCyan, foregroundColor: Colors.black),
                              icon: const Icon(CupertinoIcons.plus),
                              label: const Text('Add Custom Item to Bill'),
                              onPressed: _addCustomItemDialog,
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.all(AppTheme.spacingM),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                          childAspectRatio: 1.25,
                        ),
                        itemCount: filteredProducts.length,
                        itemBuilder: (context, index) {
                          final product = filteredProducts[index];
                          final cartItem = _cart.firstWhere(
                            (c) => c.productId == product.id || c.barcode == product.barcode,
                            orElse: () => CartItemModel(productId: null, name: '', barcode: '', price: 0, quantity: 0),
                          );

                          return InkWell(
                            borderRadius: BorderRadius.circular(AppTheme.radiusM),
                            onTap: () => _addToCart(product),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppTheme.cardBackground,
                                borderRadius: BorderRadius.circular(AppTheme.radiusM),
                                border: Border.all(
                                  color: cartItem.quantity > 0 ? AppTheme.primaryCyan : AppTheme.borderColor,
                                  width: cartItem.quantity > 0 ? 1.5 : 1,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          product.name,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (cartItem.quantity > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primaryCyan,
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            '${cartItem.quantity}x',
                                            style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 11),
                                          ),
                                        ),
                                    ],
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'PKR ${product.price.toStringAsFixed(0)}',
                                        style: const TextStyle(color: AppTheme.primaryCyan, fontWeight: FontWeight.w900, fontSize: 15),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            'Stock: ${product.stock}',
                                            style: TextStyle(
                                              color: product.stock > 5 ? AppTheme.textSecondary : Colors.redAccent,
                                              fontSize: 11,
                                            ),
                                          ),
                                          const Icon(CupertinoIcons.plus_circle_fill, color: AppTheme.primaryCyan, size: 20),
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
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
}
