import 'dart:async';
import 'package:firebase_database/firebase_database.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
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

      try {
        final List<Sale> sales = [];
        if (salesData is Map) {
          salesData.forEach((key, value) {
            if (value != null && value is Map) {
              sales.add(
                Sale.fromJson(
                  key.toString(),
                  value,
                ),
              );
            }
          });
        } else if (salesData is List) {
          for (int i = 0; i < salesData.length; i++) {
            final value = salesData[i];
            if (value != null && value is Map) {
              sales.add(
                Sale.fromJson(
                  i.toString(),
                  value,
                ),
              );
            }
          }
        }

        // Sort by timestamp descending (newest first)
        sales.sort((a, b) {
          try {
            final dateA = DateTime.parse(a.timestamp);
            final dateB = DateTime.parse(b.timestamp);
            return dateB.compareTo(dateA);
          } catch (e) {
            return 0;
          }
        });

        // Update cache
        _cachedSales = sales;
        _cacheTimestamp = DateTime.now();

        return sales;
      } catch (e) {
        print('Error parsing sales data: $e');
        return _cachedSales ?? <Sale>[];
      }
    }).handleError((error) {
      print('Error in sales stream: $error');
      return <Sale>[];
    });
  }

  /// Get sales for today only
  Stream<List<Sale>> getTodaysSalesStream() {
    return getSalesStream().map((sales) {
      final now = DateTime.now();
      final todayStart = DateTime(now.year, now.month, now.day);

      return sales.where((sale) {
        try {
          final saleDate = DateTime.parse(sale.timestamp);
          return saleDate.isAfter(todayStart);
        } catch (e) {
          return false;
        }
      }).toList();
    });
  }

  /// Get sales for a specific date range
  Stream<List<Sale>> getSalesInRangeStream(DateTime start, DateTime end) {
    return getSalesStream().map((sales) {
      return sales.where((sale) {
        try {
          final saleDate = DateTime.parse(sale.timestamp);
          return saleDate.isAfter(start) && saleDate.isBefore(end);
        } catch (e) {
          return false;
        }
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
    final double newBalance = type == 'LOAN'
        ? currentBalance + amount
        : currentBalance - amount;

    // Update customer balance
    await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(newBalance);

    // Push khata entry audit record
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

  /// Vendor & Restock Purchase Orders CRUD
  Future<void> saveVendorPurchaseOrder({
    String? id,
    required String vendorName,
    required String contactPerson,
    required String phone,
    required String email,
    required double totalAmount,
    required double paidAmount,
    required String paymentStatus,
    String? notes,
  }) async {
    final String poId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');
    await poRef.set({
      'id': int.tryParse(poId) ?? poId,
      'vendor_name': vendorName,
      'contact_person': contactPerson,
      'phone': phone,
      'email': email,
      'total_amount': totalAmount,
      'paid_amount': paidAmount,
      'payment_status': paymentStatus,
      'notes': notes ?? '',
      'timestamp': DateTime.now().toIso8601String(),
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
