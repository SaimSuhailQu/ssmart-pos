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

  // Connection status stream controller
  final _connectionStatusController = StreamController<ConnectionStatus>.broadcast();

  // Cache for sales data to reduce redundant queries
  List<Sale>? _cachedSales;
  DateTime? _cacheTimestamp;
  static const _cacheDuration = Duration(minutes: 5);

  FirebaseService(this._database) {
    _initializeConnectionListener();
  }

  /// Initialize connection status listener
  void _initializeConnectionListener() {
    final connectedRef = _database.ref(FirebasePaths.connectionInfo);
    connectedRef.onValue.listen((event) {
      final isConnected = event.snapshot.value as bool? ?? false;
      _connectionStatusController.add(
        isConnected ? ConnectionStatus.online : ConnectionStatus.offline,
      );
    });
  }

  /// Get connection status stream
  Stream<ConnectionStatus> get connectionStatusStream =>
      _connectionStatusController.stream;

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
