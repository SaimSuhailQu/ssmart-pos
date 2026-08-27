import 'dart:async';
import 'package:firebase_database/firebase_database.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/models/product.dart';
import 'package:ssmart_pos_admin/models/expense.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';

/// Service class for Firebase Realtime Database operations
/// Handles all interactions with Firebase including real-time streams and data queries
class FirebaseService {
  final FirebaseDatabase _database;

  // Connection status
  ConnectionStatus _currentStatus = ConnectionStatus.connecting;
  final _connectionStatusController = StreamController<ConnectionStatus>.broadcast();

  // Cache for sales data to reduce redundant queries
  List<Sale>? _cachedSales;
  DateTime? _cacheTimestamp;
  static const _cacheDuration = Duration(minutes: 5);

  FirebaseService(this._database) {
    _initializeConnectionListener();
    _enableOfflineSyncing();
  }

  /// Automatically caches all records to local disk so app works 100% offline
  void _enableOfflineSyncing() {
    try {
      _database.ref(FirebasePaths.sales).keepSynced(true);
      _database.ref(FirebasePaths.products).keepSynced(true);
      _database.ref(FirebasePaths.expenses).keepSynced(true);
      _database.ref(FirebasePaths.customers).keepSynced(true);
      _database.ref(FirebasePaths.vendors).keepSynced(true);
      _database.ref(FirebasePaths.purchaseOrders).keepSynced(true);
      _database.ref('customer_khata').keepSynced(true);
    } catch (e) {
      print('keepSynced error: $e');
    }
  }

  /// Initialize connection status listener
  void _initializeConnectionListener() {
    final connectedRef = _database.ref(FirebasePaths.connectionInfo);
    connectedRef.onValue.listen((event) {
      final isConnected = event.snapshot.value as bool? ?? false;
      _currentStatus = isConnected ? ConnectionStatus.online : ConnectionStatus.offline;
      if (!_connectionStatusController.isClosed) {
        _connectionStatusController.add(_currentStatus);
      }
    });
  }

  /// Current connection status
  ConnectionStatus get currentStatus => _currentStatus;

  /// Get connection status stream (seeded with current state)
  Stream<ConnectionStatus> get connectionStatusStream async* {
    yield _currentStatus;
    yield* _connectionStatusController.stream;
  }

  /// Get real-time stream of all sales
  /// This stream will emit new data whenever sales are added/modified in Firebase
  Stream<List<Sale>> getSalesStream() {
    final salesRef = _database.ref(FirebasePaths.sales);

    return salesRef.onValue.map((event) {
      final salesData = event.snapshot.value;

      if (salesData == null) {
        _cachedSales = [];
        _cacheTimestamp = DateTime.now();
        return <Sale>[];
      }

      final List<Sale> sales = [];

      void addSaleSafely(String key, dynamic value) {
        if (value != null && value is Map) {
          try {
            sales.add(
              Sale.fromJson(
                key,
                value,
              ),
            );
          } catch (e) {
            print('Error parsing individual sale $key: $e');
          }
        }
      }

      if (salesData is Map) {
        salesData.forEach((key, value) {
          addSaleSafely(key.toString(), value);
        });
      } else if (salesData is List) {
        for (int i = 0; i < salesData.length; i++) {
          final value = salesData[i];
          addSaleSafely(i.toString(), value);
        }
      }

      // Sort by timestamp descending (newest first)
      sales.sort((a, b) {
        try {
          final dateA = AppDateUtils.parseDateTime(a.timestamp);
          final dateB = AppDateUtils.parseDateTime(b.timestamp);
          if (dateA == null && dateB == null) return 0;
          if (dateA == null) return 1;
          if (dateB == null) return -1;
          return dateB.compareTo(dateA);
        } catch (e) {
          return 0;
        }
      });

      // Update cache
      _cachedSales = sales;
      _cacheTimestamp = DateTime.now();

      return sales;
    }).handleError((error) {
      print('Error in sales stream: $error');
      return _cachedSales ?? <Sale>[];
    });
  }

  /// Get sales for today only
  Stream<List<Sale>> getTodaysSalesStream() {
    return getSalesStream().map((sales) {
      return sales.where((sale) => AppDateUtils.isToday(sale.timestamp)).toList();
    });
  }

  /// Get sales for a specific date range
  Stream<List<Sale>> getSalesInRangeStream(DateTime start, DateTime end) {
    return getSalesStream().map((sales) {
      return sales.where((sale) {
        final saleDate = AppDateUtils.parseDateTime(sale.timestamp);
        if (saleDate == null) return false;
        final local = saleDate.isUtc ? saleDate.toLocal() : saleDate;
        return local.isAfter(start) && local.isBefore(end);
      }).toList();
    });
  }

  /// Get a single sale by ID
  Future<Sale?> getSaleById(String saleId) async {
    try {
      final saleRef = _database.ref(FirebasePaths.saleById(saleId));
      final snapshot = await saleRef.get();

      if (!snapshot.exists) {
        return null;
      }

      return Sale.fromJson(
        saleId,
        snapshot.value as Map<dynamic, dynamic>,
      );
    } catch (e) {
      print('Error fetching sale $saleId: $e');
      return null;
    }
  }

  /// Get paginated sales
  /// Useful for loading transactions in batches
  Future<List<Sale>> getPaginatedSales({
    required int limit,
    String? startAfterKey,
  }) async {
    try {
      var query = _database.ref(FirebasePaths.sales).orderByKey().limitToFirst(limit);

      if (startAfterKey != null) {
        query = query.startAfter(startAfterKey);
      }

      final snapshot = await query.get();

      if (!snapshot.exists) {
        return [];
      }

      final salesMap = snapshot.value as Map<dynamic, dynamic>;
      return salesMap.entries
          .map(
            (entry) => Sale.fromJson(
              entry.key.toString(),
              entry.value as Map<dynamic, dynamic>,
            ),
          )
          .toList();
    } catch (e) {
      print('Error fetching paginated sales: $e');
      return [];
    }
  }

  /// Get total transaction count
  Future<int> getTransactionCount() async {
    try {
      final salesRef = _database.ref(FirebasePaths.sales);
      final snapshot = await salesRef.get();

      if (!snapshot.exists) {
        return 0;
      }

      final salesMap = snapshot.value as Map<dynamic, dynamic>;
      return salesMap.length;
    } catch (e) {
      print('Error getting transaction count: $e');
      return 0;
    }
  }

  /// Get today's total revenue
  Future<double> getTodaysRevenue() async {
    try {
      final todaysSales = await getTodaysSalesStream().first;
      return todaysSales.fold<double>(0.0, (sum, sale) => sum + sale.total);
    } catch (e) {
      print('Error calculating todays revenue: $e');
      return 0.0;
    }
  }

  /// Check if cache is valid
  bool get _isCacheValid {
    if (_cachedSales == null || _cacheTimestamp == null) {
      return false;
    }
    final age = DateTime.now().difference(_cacheTimestamp!);
    return age < _cacheDuration;
  }

  /// Get cached sales if available and valid
  List<Sale>? getCachedSales() {
    return _isCacheValid ? _cachedSales : null;
  }

  /// Clear the cache
  void clearCache() {
    _cachedSales = null;
    _cacheTimestamp = null;
  }

  /// Test connection to Firebase
  Future<bool> testConnection() async {
    try {
      final connectedRef = _database.ref(FirebasePaths.connectionInfo);
      final snapshot = await connectedRef.get();
      return snapshot.value as bool? ?? false;
    } catch (e) {
      print('Connection test failed: $e');
      return false;
    }
  }

  /// Get real-time stream of all products (items catalog)
  Stream<List<Product>> getProductsStream() {
    final productsRef = _database.ref(FirebasePaths.products);

    return productsRef.onValue.map((event) {
      final productsData = event.snapshot.value;

      if (productsData == null) {
        return <Product>[];
      }

      try {
        final List<Product> products = [];
        if (productsData is Map) {
          productsData.forEach((key, value) {
            final id = int.tryParse(key.toString()) ?? 0;
            if (value != null && value is Map) {
              products.add(Product.fromJson(id, value));
            }
          });
        } else if (productsData is List) {
          for (int i = 0; i < productsData.length; i++) {
            final value = productsData[i];
            if (value != null && value is Map) {
              products.add(Product.fromJson(i, value));
            }
          }
        }

        // Sort by product name
        products.sort((a, b) => a.name.compareTo(b.name));
        return products;
      } catch (e) {
        print('Error parsing products catalog: $e');
        return <Product>[];
      }
    }).handleError((error) {
      print('Error in products stream: $error');
      return <Product>[];
    });
  }

  /// Get real-time stream of all expenses
  Stream<List<ExpenseModel>> getExpensesStream() {
    final expensesRef = _database.ref(FirebasePaths.expenses);
    return expensesRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <ExpenseModel>[];
      final List<ExpenseModel> list = [];
      if (data is Map) {
        data.forEach((k, v) {
          if (v is Map) list.add(ExpenseModel.fromJson(k.toString(), v));
        });
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] is Map) list.add(ExpenseModel.fromJson(i.toString(), data[i]));
        }
      }
      list.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      return list;
    }).handleError((err) {
      print('Error in expenses stream: $err');
      return <ExpenseModel>[];
    });
  }

  /// Get real-time stream of all customers with Khata / loan balances
  Stream<List<CustomerModel>> getCustomersStream() {
    final custRef = _database.ref(FirebasePaths.customers);
    return custRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <CustomerModel>[];
      final List<CustomerModel> list = [];
      if (data is Map) {
        data.forEach((k, v) {
          if (v is Map) list.add(CustomerModel.fromJson(k.toString(), v));
        });
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] is Map) list.add(CustomerModel.fromJson(i.toString(), data[i]));
        }
      }
      list.sort((a, b) => b.balance.compareTo(a.balance));
      return list;
    }).handleError((err) {
      print('Error in customers stream: $err');
      return <CustomerModel>[];
    });
  }

  /// Get real-time stream of audit entries for a specific customer's khata
  Stream<List<Map<String, dynamic>>> getCustomerKhataStream(String customerId) {
    final khataRef = _database.ref('customer_khata/$customerId');
    return khataRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <Map<String, dynamic>>[];
      final List<Map<String, dynamic>> list = [];
      if (data is Map) {
        data.forEach((k, v) {
          if (v is Map) {
            final entry = Map<String, dynamic>.from(v);
            entry['key'] = k.toString();
            list.add(entry);
          }
        });
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] is Map) {
            final entry = Map<String, dynamic>.from(data[i]);
            entry['key'] = i.toString();
            list.add(entry);
          }
        }
      }
      list.sort((a, b) {
        final tA = a['timestamp']?.toString() ?? '';
        final tB = b['timestamp']?.toString() ?? '';
        return tB.compareTo(tA);
      });
      return list;
    }).handleError((err) {
      print('Error in customer khata stream: $err');
      return <Map<String, dynamic>>[];
    });
  }

  /// Get real-time stream of all registered vendors
  Stream<List<VendorModel>> getVendorsStream() {
    final vendorsRef = _database.ref(FirebasePaths.vendors);
    return vendorsRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <VendorModel>[];
      final List<VendorModel> list = [];
      if (data is Map) {
        data.forEach((k, v) {
          if (v is Map) list.add(VendorModel.fromJson(k.toString(), v));
        });
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] is Map) list.add(VendorModel.fromJson(i.toString(), data[i]));
        }
      }
      list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      return list;
    }).handleError((err) {
      print('Error in vendors stream: $err');
      return <VendorModel>[];
    });
  }

  /// Get real-time stream of all vendors and purchase orders
  Stream<List<PurchaseOrderModel>> getPurchaseOrdersStream() {
    final poRef = _database.ref(FirebasePaths.purchaseOrders);
    return poRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <PurchaseOrderModel>[];
      final List<PurchaseOrderModel> list = [];
      if (data is Map) {
        data.forEach((k, v) {
          if (v is Map) list.add(PurchaseOrderModel.fromJson(k.toString(), v));
        });
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] is Map) list.add(PurchaseOrderModel.fromJson(i.toString(), data[i]));
        }
      }
      list.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      return list;
    }).handleError((err) {
      print('Error in POs stream: $err');
      return <PurchaseOrderModel>[];
    });
  }

  // ============================================================================
  // MOBILE CRUD OPERATIONS (Products, Customers, Khata Loans, Expenses, Vendors)
  // ============================================================================

  /// Product CRUD
  Future<void> saveProduct({
    String? id,
    required String name,
    required String barcode,
    required double price,
    required double costPrice,
    required int stock,
    required String category,
  }) async {
    final String prodId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final productRef = _database.ref('${FirebasePaths.products}/$prodId');
    await productRef.set({
      'id': int.tryParse(prodId) ?? prodId,
      'name': name,
      'barcode': barcode,
      'price': price,
      'cost_price': costPrice,
      'stock': stock,
      'category': category,
    });
  }

  Future<void> deleteProduct(String id) async {
    await _database.ref('${FirebasePaths.products}/$id').remove();
  }

  /// Process & Complete a Mobile POS Sale Transaction
  Future<Sale> processMobileSale({
    required List<SaleItem> items,
    required double subtotal,
    required double discount,
    required double tax,
    required double total,
    required String paymentMethod,
    required double amountTendered,
    required double changeGiven,
    String? cashierName,
    String? customerId,
    String? customerName,
    String? customerPhone,
  }) async {
    final String saleId = DateTime.now().millisecondsSinceEpoch.toString();
    final String timestamp = DateTime.now().toIso8601String();

    final sale = Sale(
      id: saleId,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: total,
      paymentMethod: paymentMethod,
      amountTendered: amountTendered,
      changeGiven: changeGiven,
      timestamp: timestamp,
      storeBranch: 'Mobile POS App',
      userName: cashierName ?? 'Mobile Cashier',
      items: items,
      payments: [
        PaymentDetail(
          method: paymentMethod,
          amount: total,
        ),
      ],
    );

    // 1. Push Sale transaction to Firebase
    await _database.ref('${FirebasePaths.sales}/$saleId').set(sale.toJson());

    // 2. Decrement inventory for catalog items
    for (final item in items) {
      if (item.productId != null) {
        try {
          final prodRef = _database.ref('${FirebasePaths.products}/${item.productId}/stock');
          final snap = await prodRef.get();
          if (snap.exists && snap.value != null) {
            final currentStock = (snap.value is num) ? (snap.value as num).toInt() : (int.tryParse(snap.value.toString()) ?? 0);
            final newStock = (currentStock - item.quantity).clamp(0, 999999);
            await prodRef.set(newStock);
          }
        } catch (e) {
          print('Inventory update warning for product ${item.productId}: $e');
        }
      }
    }

    // 3. If payment is Khata (Udhaar / Credit), record in customer ledger
    if (paymentMethod.toLowerCase().contains('khata') || paymentMethod.toLowerCase().contains('udhaar') || paymentMethod.toLowerCase().contains('loan')) {
      if (customerId != null && customerId.isNotEmpty) {
        try {
          final khataRef = _database.ref('customer_khata/$customerId').push();
          await khataRef.set({
            'id': DateTime.now().millisecondsSinceEpoch,
            'customer_id': int.tryParse(customerId) ?? customerId,
            'type': 'LOAN',
            'amount': total,
            'payment_method': 'Khata Bill #$saleId',
            'notes': 'Mobile POS Checkout: ${items.map((i) => '${i.quantity}x ${i.productName}').join(', ')}',
            'timestamp': timestamp,
          });

          // Compute exact balance from all entries
          final snap = await _database.ref('customer_khata/$customerId').get();
          if (snap.exists && snap.value != null) {
            double calcBal = 0.0;
            final data = snap.value;
            if (data is Map) {
              data.forEach((_, v) {
                if (v is Map) {
                  final eType = v['type']?.toString().toUpperCase() ?? 'LOAN';
                  final double eAmt = (v['amount'] is num)
                      ? (v['amount'] as num).toDouble()
                      : (double.tryParse(v['amount']?.toString() ?? '0') ?? 0.0);
                  calcBal += (eType == 'LOAN' ? eAmt : -eAmt);
                }
              });
            } else if (data is List) {
              for (final v in data) {
                if (v is Map) {
                  final eType = v['type']?.toString().toUpperCase() ?? 'LOAN';
                  final double eAmt = (v['amount'] is num)
                      ? (v['amount'] as num).toDouble()
                      : (double.tryParse(v['amount']?.toString() ?? '0') ?? 0.0);
                  calcBal += (eType == 'LOAN' ? eAmt : -eAmt);
                }
              }
            }
            await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(calcBal);
          }
        } catch (e) {
          print('Khata credit sale update warning: $e');
        }
      }
    }

    return sale;
  }

  /// Customer & Khata CRUD
  Future<void> saveCustomer({
    String? id,
    required String name,
    required String phone,
    required String email,
    double balance = 0,
    int points = 0,
  }) async {
    final String custId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final custRef = _database.ref('${FirebasePaths.customers}/$custId');
    await custRef.set({
      'id': int.tryParse(custId) ?? custId,
      'name': name,
      'phone': phone,
      'email': email,
      'balance': balance,
      'points': points,
    });
  }

  Future<void> deleteCustomer(String id) async {
    await _database.ref('${FirebasePaths.customers}/$id').remove();
    await _database.ref('customer_khata/$id').remove();
  }

  /// Record Loan / Payment in Customer Khata
  Future<void> recordKhataTransaction({
    required String customerId,
    required String customerName,
    required double currentBalance,
    required double amount,
    required String type, // 'LOAN' (Udhaar Diya) or 'PAYMENT' (Wasool Hua)
    required String paymentMethod,
    String? notes,
  }) async {
    // 1. Push khata entry audit record
    final entryRef = _database.ref('customer_khata/$customerId').push();
    await entryRef.set({
      'id': DateTime.now().millisecondsSinceEpoch,
      'customer_id': int.tryParse(customerId) ?? customerId,
      'type': type,
      'amount': amount,
      'payment_method': paymentMethod,
      'notes': notes ?? (type == 'LOAN' ? 'Mobile App Udhaar Entry' : 'Mobile App Loan Repayment'),
      'timestamp': DateTime.now().toIso8601String(),
    });

    // 2. Fetch all khata entries to calculate the exact, authoritative balance
    try {
      final snap = await _database.ref('customer_khata/$customerId').get();
      if (snap.exists && snap.value != null) {
        double calcBal = 0.0;
        final data = snap.value;
        if (data is Map) {
          data.forEach((_, v) {
            if (v is Map) {
              final eType = v['type']?.toString().toUpperCase() ?? 'LOAN';
              final double eAmt = (v['amount'] is num)
                  ? (v['amount'] as num).toDouble()
                  : (double.tryParse(v['amount']?.toString() ?? '0') ?? 0.0);
              calcBal += (eType == 'LOAN' ? eAmt : -eAmt);
            }
          });
        } else if (data is List) {
          for (final v in data) {
            if (v is Map) {
              final eType = v['type']?.toString().toUpperCase() ?? 'LOAN';
              final double eAmt = (v['amount'] is num)
                  ? (v['amount'] as num).toDouble()
                  : (double.tryParse(v['amount']?.toString() ?? '0') ?? 0.0);
              calcBal += (eType == 'LOAN' ? eAmt : -eAmt);
            }
          }
        }
        await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(calcBal);
      } else {
        final double newBalance = type == 'LOAN' ? currentBalance + amount : currentBalance - amount;
        await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(newBalance);
      }
    } catch (e) {
      final double newBalance = type == 'LOAN' ? currentBalance + amount : currentBalance - amount;
      await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(newBalance);
    }
  }

  Future<void> clearAllKhataRecords() async {
    // 1. Remove all audit entries
    await _database.ref('customer_khata').remove();

    // 2. Reset all customer balances to 0
    final custSnap = await _database.ref(FirebasePaths.customers).get();
    if (custSnap.exists && custSnap.value != null) {
      final val = custSnap.value;
      if (val is Map) {
        for (final key in val.keys) {
          await _database.ref('${FirebasePaths.customers}/$key/balance').set(0);
        }
      }
    }
  }

  /// Expense CRUD
  Future<void> addExpense({
    required double amount,
    required String description,
    required String category,
    String loggedBy = 'Mobile Admin',
  }) async {
    final String expId = DateTime.now().millisecondsSinceEpoch.toString();
    final expenseRef = _database.ref('${FirebasePaths.expenses}/$expId');
    await expenseRef.set({
      'id': int.tryParse(expId) ?? expId,
      'amount': amount,
      'description': description,
      'category': category,
      'logged_by': loggedBy,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  Future<void> deleteExpense(String id) async {
    await _database.ref('${FirebasePaths.expenses}/$id').remove();
  }

  /// Vendor CRUD
  Future<void> saveVendor({
    String? id,
    required String name,
    required String contact,
    required String category,
  }) async {
    final String vendorId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final vendorRef = _database.ref('${FirebasePaths.vendors}/$vendorId');
    await vendorRef.set({
      'id': int.tryParse(vendorId) ?? vendorId,
      'name': name.trim(),
      'contact': contact.trim(),
      'category': category.trim().isNotEmpty ? category.trim() : 'General',
    });
  }

  Future<void> deleteVendor(String id) async {
    await _database.ref('${FirebasePaths.vendors}/$id').remove();
  }

  /// Vendor & Restock Purchase Orders CRUD
  Future<void> saveVendorPurchaseOrder({
    String? id,
    int? vendorId,
    required String vendorName,
    String? contactPerson,
    String? phone,
    String? email,
    required double totalAmount,
    required double paidAmount,
    String? status,
    required String paymentStatus,
    String? notes,
    List<dynamic>? items,
    List<dynamic>? payments,
    List<dynamic>? orderEntries,
  }) async {
    final String poId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final int finalVendorId = vendorId ?? (int.tryParse(poId) ?? 0);
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');

    // If new payments list was provided or initial paid amount was entered
    List<dynamic> poPayments = payments ?? [];
    if (poPayments.isEmpty && paidAmount > 0) {
      poPayments = [
        {
          'id': DateTime.now().millisecondsSinceEpoch,
          'amount': paidAmount,
          'payment_method': 'Cash',
          'notes': 'Initial deposit / payment',
          'timestamp': DateTime.now().toIso8601String(),
        }
      ];
    }

    // Determine normalized payment status
    String calcPaymentStatus = paymentStatus;
    if (totalAmount > 0) {
      if (paidAmount >= totalAmount) {
        calcPaymentStatus = 'Paid';
      } else if (paidAmount > 0) {
        calcPaymentStatus = 'Partially Paid';
      } else {
        calcPaymentStatus = 'Unpaid';
      }
    }

    final payload = {
      'id': int.tryParse(poId) ?? poId,
      'vendor_id': finalVendorId,
      'vendor_name': vendorName,
      'contact_person': (contactPerson != null && contactPerson.trim().isNotEmpty) ? contactPerson.trim() : vendorName,
      'phone': phone ?? '',
      'email': email ?? '',
      'total_cost': totalAmount,
      'total_amount': totalAmount,
      'paid_amount': paidAmount,
      'status': status ?? 'Pending',
      'payment_status': calcPaymentStatus,
      'notes': notes ?? '',
      'items': items ?? [],
      'payments': poPayments,
      'order_entries': orderEntries ?? [],
      'timestamp': DateTime.now().toIso8601String(),
    };

    await poRef.set(payload);

    // Also auto-sync vendor into vendors collection if not present
    if (vendorName.trim().isNotEmpty) {
      final vendorSearchRef = _database.ref('${FirebasePaths.vendors}/$finalVendorId');
      final snap = await vendorSearchRef.get();
      if (!snap.exists) {
        await vendorSearchRef.set({
          'id': finalVendorId,
          'name': vendorName.trim(),
          'contact': phone ?? '',
          'category': 'General',
        });
      }
    }
  }

  /// Record Partial or Full Payment on a Purchase Order
  Future<void> recordVendorPayment({
    required String poId,
    required int vendorId,
    required double amount,
    required String paymentMethod,
    String? notes,
  }) async {
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');
    final snapshot = await poRef.get();

    if (!snapshot.exists || snapshot.value == null) {
      throw Exception('Purchase Order #$poId not found');
    }

    final poData = Map<String, dynamic>.from(snapshot.value as Map);
    final rawCost = poData['total_cost'] ?? poData['total_amount'] ?? 0.0;
    final double totalCost = (rawCost is num) ? rawCost.toDouble() : (double.tryParse(rawCost.toString()) ?? 0.0);
    final rawPaid = poData['paid_amount'] ?? 0.0;
    final double currentPaid = (rawPaid is num) ? rawPaid.toDouble() : (double.tryParse(rawPaid.toString()) ?? 0.0);

    final double newPaidAmount = currentPaid + amount;
    String newPaymentStatus = 'Unpaid';
    if (newPaidAmount >= totalCost && totalCost > 0) {
      newPaymentStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'Partially Paid';
    }

    // Get current payments list
    List<dynamic> currentPayments = [];
    if (poData['payments'] is List) {
      currentPayments = List.from(poData['payments'] as List);
    } else if (poData['payments'] is Map) {
      (poData['payments'] as Map).forEach((_, v) {
        if (v != null) currentPayments.add(v);
      });
    }

    currentPayments.add({
      'id': DateTime.now().millisecondsSinceEpoch,
      'amount': amount,
      'payment_method': paymentMethod,
      'notes': notes ?? 'Payment recorded from mobile app',
      'timestamp': DateTime.now().toIso8601String(),
    });

    await poRef.update({
      'paid_amount': newPaidAmount,
      'payment_status': newPaymentStatus,
      'payments': currentPayments,
    });
  }

  /// Update Purchase Order Status (e.g. 'Pending' -> 'Received')
  Future<void> updatePurchaseOrderStatus(String poId, String newStatus) async {
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');
    await poRef.update({
      'status': newStatus,
    });
  }

  Future<void> deleteVendorPurchaseOrder(String id) async {
    await _database.ref('${FirebasePaths.purchaseOrders}/$id').remove();
  }

  /// Dispose resources
  void dispose() {
    _connectionStatusController.close();
  }
}

/// Connection status enum
enum ConnectionStatus {
  online,
  offline,
  connecting,
}

/// Extension to get display string for connection status
extension ConnectionStatusExtension on ConnectionStatus {
  String get displayName {
    switch (this) {
      case ConnectionStatus.online:
        return 'Online';
      case ConnectionStatus.offline:
        return 'Offline';
      case ConnectionStatus.connecting:
        return 'Connecting...';
    }
  }

  bool get isOnline => this == ConnectionStatus.online;
}
