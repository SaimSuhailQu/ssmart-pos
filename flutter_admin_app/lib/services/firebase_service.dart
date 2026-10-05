import 'dart:async';
import 'dart:math';
import 'package:firebase_database/firebase_database.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/utils/date_utils.dart';
import 'package:ssmart_pos_admin/models/sale.dart';
import 'package:ssmart_pos_admin/models/product.dart';
import 'package:ssmart_pos_admin/models/expense.dart';
import 'package:ssmart_pos_admin/models/customer.dart';
import 'package:ssmart_pos_admin/models/vendor.dart';
import 'package:ssmart_pos_admin/models/daily_closing.dart';

/// Service class for Firebase Realtime Database operations
/// Handles all interactions with Firebase including real-time streams and data queries
class FirebaseService {
  final FirebaseDatabase _database;

  // Connection status
  ConnectionStatus _currentStatus = ConnectionStatus.connecting;
  final _connectionStatusController = StreamController<ConnectionStatus>.broadcast();

  // In-memory caches to prevent screen blinking and redundant queries
  List<Sale>? _cachedSales;
  DateTime? _cacheTimestamp;
  static const _cacheDuration = Duration(minutes: 5);

  List<Product>? _cachedProducts;
  List<ExpenseModel>? _cachedExpenses;
  List<CustomerModel>? _cachedCustomers;
  List<VendorModel>? _cachedVendors;
  List<PurchaseOrderModel>? _cachedPurchaseOrders;

  // Live Khata balance cache (customer_id -> balance), maintained by ONE listener
  // instead of re-fetching the whole ledger on every customer list event.
  final Map<String, double> _khataBalanceCache = <String, double>{};
  StreamSubscription<DatabaseEvent>? _khataBalanceListener;

  List<Sale>? get cachedSales => _cachedSales;
  List<Product>? get cachedProducts => _cachedProducts;
  List<ExpenseModel>? get cachedExpenses => _cachedExpenses;
  List<CustomerModel>? get cachedCustomers => _cachedCustomers;
  List<VendorModel>? get cachedVendors => _cachedVendors;
  List<PurchaseOrderModel>? get cachedPurchaseOrders => _cachedPurchaseOrders;

  FirebaseService(this._database) {
    _initializeConnectionListener();
    _enableOfflineSyncing();
    _initializeKhataBalanceCache();
  }

  /// Keep an always-fresh in-memory map of customer khata balances.
  /// One persistent listener beats a full ledger read on every UI event.
  void _initializeKhataBalanceCache() {
    try {
      _khataBalanceListener = _database.ref('customer_khata').onValue.listen((event) {
        final data = event.snapshot.value;
        final balances = <String, double>{};
        if (data is Map) {
          data.forEach((cId, entries) {
            double bal = 0.0;
            void processEntry(Map e) {
              final eType = e['type']?.toString().toUpperCase() ?? 'LOAN';
              final double eAmt = (e['amount'] is num)
                  ? (e['amount'] as num).toDouble()
                  : (double.tryParse(e['amount']?.toString() ?? '0') ?? 0.0);
              bal += (eType == 'LOAN' ? eAmt : -eAmt);
            }

            if (entries is Map) {
              entries.forEach((_, e) {
                if (e is Map) processEntry(e);
              });
            } else if (entries is List) {
              for (final e in entries) {
                if (e is Map) processEntry(Map<dynamic, dynamic>.from(e));
              }
            }
            balances[cId.toString()] = bal;
          });
        }
        _khataBalanceCache
          ..clear()
          ..addAll(balances);
      });
    } catch (e) {
      print('Khata balance cache error: $e');
    }
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
      _database.ref(FirebasePaths.dailyClosings).keepSynced(true);
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

  /// Clear all in-memory caches
  void clearCache() {
    _cachedSales = null;
    _cacheTimestamp = null;
    _cachedProducts = null;
    _cachedExpenses = null;
    _cachedCustomers = null;
    _cachedVendors = null;
    _cachedPurchaseOrders = null;
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
        _cachedProducts = [];
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
        _cachedProducts = products;
        return products;
      } catch (e) {
        print('Error parsing products catalog: $e');
        return _cachedProducts ?? <Product>[];
      }
    }).handleError((error) {
      print('Error in products stream: $error');
      return _cachedProducts ?? <Product>[];
    });
  }

  /// Get real-time stream of all expenses
  Stream<List<ExpenseModel>> getExpensesStream() {
    final expensesRef = _database.ref(FirebasePaths.expenses);
    return expensesRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) {
        _cachedExpenses = [];
        return <ExpenseModel>[];
      }
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
      _cachedExpenses = list;
      return list;
    }).handleError((err) {
      print('Error in expenses stream: $err');
      return _cachedExpenses ?? <ExpenseModel>[];
    });
  }

  /// Get real-time stream of all customers with live dynamically-computed Khata balances
  Stream<List<CustomerModel>> getCustomersStream() {
    final custRef = _database.ref(FirebasePaths.customers);

    return custRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) {
        _cachedCustomers = [];
        return <CustomerModel>[];
      }

      // Balances come from the always-fresh in-memory khata cache (zero extra reads)
      final liveBalances = _khataBalanceCache;

      final List<CustomerModel> list = [];
      if (data is Map) {
        data.forEach((k, v) {
          if (v is Map) {
            var model = CustomerModel.fromJson(k.toString(), v);
            final keyStr = k.toString();
            final idStr = model.id;
            if (liveBalances.containsKey(keyStr)) {
              model = model.copyWith(balance: liveBalances[keyStr]!);
            } else if (liveBalances.containsKey(idStr)) {
              model = model.copyWith(balance: liveBalances[idStr]!);
            }
            list.add(model);
          }
        });
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] is Map) {
            var model = CustomerModel.fromJson(i.toString(), data[i]);
            final keyStr = i.toString();
            final idStr = model.id;
            if (liveBalances.containsKey(keyStr)) {
              model = model.copyWith(balance: liveBalances[keyStr]!);
            } else if (liveBalances.containsKey(idStr)) {
              model = model.copyWith(balance: liveBalances[idStr]!);
            }
            list.add(model);
          }
        }
      }
      list.sort((a, b) => b.balance.compareTo(a.balance));
      _cachedCustomers = list;
      return list;
    }).handleError((err) {
      print('Error in customers stream: $err');
      return _cachedCustomers ?? <CustomerModel>[];
    });
  }

  /// Get real-time stream of audit entries for a specific customer's khata
  Stream<List<Map<String, dynamic>>> getCustomerKhataStream(String customerId) {
    final khataRef = _database.ref('customer_khata/$customerId');
    final deletedRef = _database.ref('deleted_khata_entries/$customerId');

    // Combine stream with deleted keys check to prevent resurrection
    return khataRef.onValue.asyncMap((event) async {
      final data = event.snapshot.value;
      if (data == null) return <Map<String, dynamic>>[];

      // Fetch tombstones for this customer
      final Set<String> deletedKeys = {};
      try {
        final delSnap = await deletedRef.get();
        if (delSnap.exists && delSnap.value != null) {
          final delVal = delSnap.value;
          if (delVal is Map) {
            delVal.forEach((k, v) {
              if (v == true || v != null) deletedKeys.add(k.toString());
            });
          }
        }
      } catch (e) {
        print('Error fetching deleted khata entries: $e');
      }

      final Map<String, Map<String, dynamic>> uniqueMap = {};
      void addIfValid(String rawKey, dynamic item) {
        if (item is! Map) return;
        final entry = Map<String, dynamic>.from(item);
        final String rawK = rawKey;
        final String syncId = entry['sync_id']?.toString() ?? '';
        final String id = entry['id']?.toString() ?? '';
        final String entryKey = syncId.isNotEmpty ? syncId : (id.isNotEmpty ? id : rawK);

        // Filter out if marked deleted in tombstone
        if (deletedKeys.contains(rawK) || 
            (syncId.isNotEmpty && deletedKeys.contains(syncId)) ||
            (id.isNotEmpty && deletedKeys.contains(id))) {
          return;
        }

        entry['key'] = entryKey;
        entry['raw_key'] = rawK;
        uniqueMap[entryKey] = entry;
      }

      if (data is Map) {
        data.forEach((k, v) => addIfValid(k.toString(), v));
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          addIfValid(i.toString(), data[i]);
        }
      }
      final list = uniqueMap.values.toList();
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
      if (data == null) {
        _cachedVendors = [];
        return <VendorModel>[];
      }
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
      _cachedVendors = list;
      return list;
    }).handleError((err) {
      print('Error in vendors stream: $err');
      return _cachedVendors ?? <VendorModel>[];
    });
  }

  /// Get real-time stream of all vendors and purchase orders
  Stream<List<PurchaseOrderModel>> getPurchaseOrdersStream() {
    final poRef = _database.ref(FirebasePaths.purchaseOrders);
    return poRef.onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) {
        _cachedPurchaseOrders = [];
        return <PurchaseOrderModel>[];
      }
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
      _cachedPurchaseOrders = list;
      return list;
    }).handleError((err) {
      print('Error in POs stream: $err');
      return _cachedPurchaseOrders ?? <PurchaseOrderModel>[];
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
    final formattedName = name.trim().replaceAllMapped(
      RegExp(r'\b[a-z]'),
      (match) => match.group(0)!.toUpperCase(),
    );
    final String prodId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final productRef = _database.ref('${FirebasePaths.products}/$prodId');
    await productRef.set({
      'id': int.tryParse(prodId) ?? prodId,
      'name': formattedName,
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

    // 2. Decrement inventory for catalog items — atomic transactions prevent
    // lost updates when desktop POS and mobile sell the same item concurrently.
    for (final item in items) {
      try {
        final pid = item.productId;
        if (pid <= 0) continue; // skip custom / daily-closing items
        final prodRef = _database.ref('${FirebasePaths.products}/$pid/stock');
        await prodRef.runTransaction((current) {
          final currentStock = current is int
              ? current
              : (int.tryParse(current?.toString() ?? '0') ?? 0);
          final newStock = (currentStock - item.quantity).clamp(0, 999999);
          return Transaction.success(newStock);
        });
      } catch (e) {
        print('Inventory update warning for product ${item.productId}: $e');
      }
    }

    // 3. If payment is Khata (Udhaar / Credit), record in customer ledger
    if (paymentMethod.toLowerCase().contains('khata') || paymentMethod.toLowerCase().contains('udhaar') || paymentMethod.toLowerCase().contains('loan')) {
      if (customerId != null && customerId.isNotEmpty) {
        try {
          final String entryKey = 'khata_sale_${saleId}_${DateTime.now().millisecondsSinceEpoch}';
          final khataRef = _database.ref('customer_khata/$customerId/$entryKey');
          await khataRef.set({
            'id': entryKey,
            'sync_id': entryKey,
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

  /// Delete a transaction/sale from Firebase Realtime Database
  Future<void> deleteSale(String saleId) async {
    await _database.ref('${FirebasePaths.sales}/$saleId').remove();
    _cachedSales?.removeWhere((s) => s.id == saleId);
  }

  /// Get real-time stream of dedicated Daily Closings
  Stream<List<DailyClosingModel>> getDailyClosingsStream() {
    return _database.ref(FirebasePaths.dailyClosings).onValue.map((event) {
      final data = event.snapshot.value;
      if (data == null) return <DailyClosingModel>[];

      final List<DailyClosingModel> closings = [];

      void addClosing(String key, dynamic val) {
        if (val != null && val is Map) {
          try {
            closings.add(DailyClosingModel.fromJson(key, val));
          } catch (e) {
            print('Error parsing DailyClosing $key: $e');
          }
        }
      }

      if (data is Map) {
        data.forEach((k, v) => addClosing(k.toString(), v));
      } else if (data is List) {
        for (int i = 0; i < data.length; i++) {
          if (data[i] != null) addClosing(i.toString(), data[i]);
        }
      }

      // Sort newest date and timestamp first
      closings.sort((a, b) => b.date.compareTo(a.date));
      return closings;
    });
  }

  /// Save or update a dedicated Daily Closing record
  Future<DailyClosingModel> saveDailyClosing({
    String? id,
    required DateTime date,
    required double total,
    double cashAmount = 0.0,
    double onlineAmount = 0.0,
    String? notes,
    String loggedBy = 'Admin',
  }) async {
    final String closingId = id ?? DateTime.now().millisecondsSinceEpoch.toString();
    final String dateKey = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final String timestamp = date.toIso8601String();

    final model = DailyClosingModel(
      id: closingId,
      date: dateKey,
      total: total,
      cashAmount: cashAmount,
      onlineAmount: onlineAmount,
      notes: notes?.trim() ?? '',
      loggedBy: loggedBy,
      timestamp: timestamp,
    );

    await _database.ref('${FirebasePaths.dailyClosings}/$closingId').set(model.toJson());
    return model;
  }

  /// Delete a Daily Closing record from Firebase Realtime Database
  Future<void> deleteDailyClosing(String closingId) async {
    await _database.ref('${FirebasePaths.dailyClosings}/$closingId').remove();
  }

  /// Manually log a Daily Closing Sale transaction
  Future<Sale> saveManualDailyClosingSale({
    required double total,
    double cashAmount = 0.0,
    double onlineAmount = 0.0,
    DateTime? date,
    String? notes,
    String cashierName = 'Admin (Manual Closing)',
  }) async {
    final String saleId = DateTime.now().millisecondsSinceEpoch.toString();
    final DateTime closingDate = date ?? DateTime.now();
    final String timestamp = closingDate.toIso8601String();

    String paymentMethod = 'Cash';
    final List<PaymentDetail> payments = [];

    if (cashAmount > 0 && onlineAmount > 0) {
      paymentMethod = 'Split';
      payments.add(PaymentDetail(method: 'Cash', amount: cashAmount));
      payments.add(PaymentDetail(method: 'Online / Bank', amount: onlineAmount));
    } else if (onlineAmount > 0) {
      paymentMethod = 'Online / Bank';
      payments.add(PaymentDetail(method: 'Online / Bank', amount: total));
    } else {
      paymentMethod = 'Cash';
      payments.add(PaymentDetail(method: 'Cash', amount: total));
    }

    final closingItem = SaleItem(
      productId: 0,
      productName: notes?.isNotEmpty == true ? 'Daily Closing: $notes' : 'Daily Closing Sales Note',
      productCategory: 'Daily Closing',
      productBarcode: 'MANUAL-CLOSING',
      quantity: 1,
      price: total,
    );

    final sale = Sale(
      id: saleId,
      subtotal: total,
      discount: 0,
      tax: 0,
      total: total,
      paymentMethod: paymentMethod,
      amountTendered: total,
      changeGiven: 0,
      timestamp: timestamp,
      storeBranch: 'Main Store Register',
      userName: cashierName,
      items: [closingItem],
      payments: payments,
    );

    await _database.ref('${FirebasePaths.sales}/$saleId').set(sale.toJson());
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
    // 1. Save khata entry audit record with unique key
    final String entryKey = 'khata_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(9999)}';
    final entryRef = _database.ref('customer_khata/$customerId/$entryKey');
    await entryRef.set({
      'id': entryKey,
      'sync_id': entryKey,
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

  /// Update an existing Customer Khata entry (allowed within 30 minutes of creation)
  Future<void> updateKhataTransaction({
    required String customerId,
    required String entryKey,
    required double newAmount,
    String? notes,
    String? paymentMethod,
  }) async {
    final entryRef = _database.ref('customer_khata/$customerId/$entryKey');
    final snap = await entryRef.get();
    if (!snap.exists || snap.value == null) {
      throw Exception('Khata transaction record not found.');
    }

    final entryData = Map<String, dynamic>.from(snap.value as Map);
    final timestampStr = entryData['timestamp']?.toString();
    final entryTime = AppDateUtils.parseDateTime(timestampStr);

    if (entryTime != null) {
      final diff = DateTime.now().difference(entryTime.isUtc ? entryTime.toLocal() : entryTime);
      if (diff.inMinutes > 30) {
        throw Exception('Khata entries can only be edited within 30 minutes of creation.');
      }
    }

    final Map<String, dynamic> updates = {
      'amount': newAmount,
    };
    if (notes != null) updates['notes'] = notes;
    if (paymentMethod != null) updates['payment_method'] = paymentMethod;

    await entryRef.update(updates);

    // Recalculate customer balance from all entries
    try {
      final khataSnap = await _database.ref('customer_khata/$customerId').get();
      if (khataSnap.exists && khataSnap.value != null) {
        double calcBal = 0.0;
        final data = khataSnap.value;
        void processEntry(Map map) {
          final eType = map['type']?.toString().toUpperCase() ?? 'LOAN';
          final double eAmt = (map['amount'] is num)
              ? (map['amount'] as num).toDouble()
              : (double.tryParse(map['amount']?.toString() ?? '0') ?? 0.0);
          calcBal += (eType == 'LOAN' ? eAmt : -eAmt);
        }

        if (data is Map) {
          data.forEach((_, v) {
            if (v is Map) processEntry(v);
          });
        } else if (data is List) {
          for (final v in data) {
            if (v is Map) processEntry(v);
          }
        }
        await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(calcBal);
      }
    } catch (e) {
      print('Recalculate balance on edit warning: $e');
    }
  }

  /// Delete a Customer Khata entry and recalculate live balance in real time
  Future<void> deleteKhataTransaction({
    required String customerId,
    required String entryKey,
    String? rawKey,
  }) async {
    // 1. Remove from customer_khata
    await _database.ref('customer_khata/$customerId/$entryKey').remove();
    if (rawKey != null && rawKey != entryKey) {
      await _database.ref('customer_khata/$customerId/$rawKey').remove();
    }

    // 2. Mark immutable tombstone so Desktop Sync Engine never re-uploads it
    try {
      await _database.ref('deleted_khata_entries/$customerId/$entryKey').set(true);
      if (rawKey != null && rawKey != entryKey) {
        await _database.ref('deleted_khata_entries/$customerId/$rawKey').set(true);
      }
    } catch (e) {
      print('Warning writing deleted_khata_entries tombstone: $e');
    }

    // Recalculate customer balance from all remaining entries
    try {
      final khataSnap = await _database.ref('customer_khata/$customerId').get();
      final delSnap = await _database.ref('deleted_khata_entries/$customerId').get();
      final Set<String> deletedKeys = {};
      if (delSnap.exists && delSnap.value is Map) {
        (delSnap.value as Map).forEach((k, v) {
          if (v == true || v != null) deletedKeys.add(k.toString());
        });
      }

      double calcBal = 0.0;
      if (khataSnap.exists && khataSnap.value != null) {
        final data = khataSnap.value;
        void processEntry(String k, Map map) {
          final syncId = map['sync_id']?.toString() ?? '';
          final id = map['id']?.toString() ?? '';
          if (deletedKeys.contains(k) || (syncId.isNotEmpty && deletedKeys.contains(syncId)) || (id.isNotEmpty && deletedKeys.contains(id))) {
            return;
          }
          final eType = map['type']?.toString().toUpperCase() ?? 'LOAN';
          final double eAmt = (map['amount'] is num)
              ? (map['amount'] as num).toDouble()
              : (double.tryParse(map['amount']?.toString() ?? '0') ?? 0.0);
          calcBal += (eType == 'LOAN' ? eAmt : -eAmt);
        }

        if (data is Map) {
          data.forEach((k, v) {
            if (v is Map) processEntry(k.toString(), v);
          });
        } else if (data is List) {
          for (int i = 0; i < data.length; i++) {
            if (data[i] is Map) processEntry(i.toString(), data[i]);
          }
        }
      }
      await _database.ref('${FirebasePaths.customers}/$customerId/balance').set(calcBal);
    } catch (e) {
      print('Recalculate balance on delete warning: $e');
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
    String? billUrl,
    List<dynamic>? items,
    List<dynamic>? payments,
    List<dynamic>? orderEntries,
  }) async {
    // If no explicit ID is provided, check if a unified PO already exists for this vendor
    String? targetPoId = id;
    Map<String, dynamic>? existingData;

    if (targetPoId == null) {
      // 1. Check in-memory cached POs
      PurchaseOrderModel? existingModel;
      if (_cachedPurchaseOrders != null && _cachedPurchaseOrders!.isNotEmpty) {
        try {
          existingModel = _cachedPurchaseOrders!.firstWhere(
            (p) => (vendorId != null && vendorId != 0 && p.vendorId == vendorId) ||
                (p.vendorName.trim().toLowerCase() == vendorName.trim().toLowerCase() && vendorName.trim().isNotEmpty),
          );
        } catch (_) {}
      }

      // 2. If not found in cache, check directly in RTDB
      if (existingModel != null) {
        targetPoId = existingModel.key.isNotEmpty ? existingModel.key : existingModel.id.toString();
        existingData = {
          'id': existingModel.id,
          'vendor_id': existingModel.vendorId,
          'vendor_name': existingModel.vendorName,
          'contact_person': existingModel.contactPerson,
          'phone': existingModel.phone,
          'email': existingModel.email,
          'total_cost': existingModel.totalCost,
          'total_amount': existingModel.totalCost,
          'paid_amount': existingModel.paidAmount,
          'payment_status': existingModel.paymentStatus,
          'status': existingModel.status,
          'notes': existingModel.notes,
          'bill_url': existingModel.billUrl,
          'items': existingModel.items,
          'payments': existingModel.payments,
          'order_entries': existingModel.orderEntries,
        };
      } else {
        try {
          final snap = await _database.ref(FirebasePaths.purchaseOrders).get();
          if (snap.exists && snap.value != null) {
            final val = snap.value;
            if (val is Map) {
              for (final entry in val.entries) {
                if (entry.value is Map) {
                  final m = Map<String, dynamic>.from(entry.value as Map);
                  final vName = m['vendor_name']?.toString().trim().toLowerCase() ?? '';
                  final vId = m['vendor_id'] is int ? m['vendor_id'] : int.tryParse(m['vendor_id']?.toString() ?? '');
                  if ((vendorId != null && vendorId != 0 && vId == vendorId) ||
                      (vName.isNotEmpty && vName == vendorName.trim().toLowerCase())) {
                    targetPoId = entry.key.toString();
                    existingData = m;
                    break;
                  }
                }
              }
            } else if (val is List) {
              for (int i = 0; i < val.length; i++) {
                if (val[i] is Map) {
                  final m = Map<String, dynamic>.from(val[i] as Map);
                  final vName = m['vendor_name']?.toString().trim().toLowerCase() ?? '';
                  final vId = m['vendor_id'] is int ? m['vendor_id'] : int.tryParse(m['vendor_id']?.toString() ?? '');
                  if ((vendorId != null && vendorId != 0 && vId == vendorId) ||
                      (vName.isNotEmpty && vName == vendorName.trim().toLowerCase())) {
                    targetPoId = m['id']?.toString() ?? i.toString();
                    existingData = m;
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {
          print('Error querying existing PO for vendor: $e');
        }
      }
    }

    // Determine final PO ID
    final String poId = targetPoId ?? DateTime.now().millisecondsSinceEpoch.toString();
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');

    // Fetch existing node data if targetPoId already existed and existingData not already loaded
    if (targetPoId != null && (existingData == null || existingData['payments'] == null)) {
      final snap = await poRef.get();
      if (snap.exists && snap.value != null) {
        existingData = _safeExtractPO(snap.value, poId: targetPoId, vendorId: vendorId);
      }
    }

    final int finalVendorId = vendorId ??
        (existingData != null && existingData['vendor_id'] is int
            ? existingData['vendor_id'] as int
            : int.tryParse(existingData?['vendor_id']?.toString() ?? '') ?? (int.tryParse(poId) ?? 0));

    // If merging into an existing PO without explicit edit, do it as an atomic
    // transaction so a stale read can never wipe the PO's history.
    if (id == null && existingData != null) {
      final int entryId = DateTime.now().millisecondsSinceEpoch;
      final String nowIso = DateTime.now().toIso8601String();
      final String entryNotes =
          notes?.isNotEmpty == true ? notes! : 'New order delivery / bill';
      final String payNotes = notes?.isNotEmpty == true
          ? 'Payment for $notes'
          : 'Payment against order bill';

      await _transactPurchaseOrder(poId, (poData) {
        final double prevCost =
            _poNum(poData['total_cost'] ?? poData['total_amount']);
        final double prevPaid = _poNum(poData['paid_amount']);

        final double newTotalCost = prevCost + totalAmount;
        final double newPaidAmount = prevPaid + paidAmount;

        final List<dynamic> currentEntries = _poList(poData['order_entries']);
        currentEntries.add({
          'id': entryId,
          'po_id': int.tryParse(poId) ?? poId,
          'vendor_id': poData['vendor_id'] ?? finalVendorId,
          'amount': totalAmount,
          'notes': entryNotes,
          if (billUrl != null && billUrl.isNotEmpty) 'bill_url': billUrl,
          'timestamp': nowIso,
        });

        final List<dynamic> currentPayments = _poList(poData['payments']);
        if (paidAmount > 0) {
          currentPayments.add({
            'id': entryId,
            'amount': paidAmount,
            'payment_method': 'Cash',
            'notes': payNotes,
            'timestamp': nowIso,
          });
        }

        final String prevNotes = poData['notes']?.toString() ?? '';
        final updated = Map<String, dynamic>.from(poData);
        updated['total_cost'] = newTotalCost;
        updated['total_amount'] = newTotalCost;
        updated['paid_amount'] = newPaidAmount;
        updated['payment_status'] =
            _poPaymentStatus(newTotalCost, newPaidAmount);
        updated['notes'] = notes?.isNotEmpty == true
            ? (prevNotes.isNotEmpty ? '$prevNotes | $notes' : notes!)
            : prevNotes;
        updated['order_entries'] = currentEntries;
        updated['payments'] = currentPayments;
        if (billUrl != null && billUrl.isNotEmpty) {
          updated['bill_url'] = billUrl;
        }
        if (phone != null && phone.isNotEmpty) updated['phone'] = phone;
        if (email != null && email.isNotEmpty) updated['email'] = email;
        if (contactPerson != null && contactPerson.isNotEmpty) {
          updated['contact_person'] = contactPerson;
        }
        return updated;
      });

      return;
    }

    // Creating fresh PO or editing explicit PO by ID
    List<dynamic> poPayments = payments ?? [];
    if (poPayments.isEmpty && existingData != null && existingData['payments'] != null) {
      if (existingData['payments'] is List) {
        poPayments = List.from(existingData['payments'] as List);
      } else if (existingData['payments'] is Map) {
        (existingData['payments'] as Map).forEach((_, v) {
          if (v != null) poPayments.add(v);
        });
      }
    }
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

    List<dynamic> poEntries = orderEntries ?? [];
    if (poEntries.isEmpty && totalAmount > 0) {
      poEntries = [
        {
          'id': DateTime.now().millisecondsSinceEpoch,
          'po_id': int.tryParse(poId) ?? poId,
          'vendor_id': finalVendorId,
          'amount': totalAmount,
          'notes': notes?.isNotEmpty == true ? notes : 'Initial order delivery',
          if (billUrl != null && billUrl.isNotEmpty) 'bill_url': billUrl,
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
      'bill_url': billUrl ?? (existingData?['bill_url']?.toString()),
      'items': items ?? [],
      'payments': poPayments,
      'order_entries': poEntries,
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

  /// Parse a Firebase numeric-ish value to double (num or numeric String).
  double _poNum(dynamic v) {
    if (v is num) return v.toDouble();
    if (v != null) return double.tryParse(v.toString()) ?? 0.0;
    return 0.0;
  }

  /// Normalize a Firebase list-or-map node into a growable List.
  List<dynamic> _poList(dynamic v) {
    final out = <dynamic>[];
    if (v is List) {
      out.addAll(v);
    } else if (v is Map) {
      v.forEach((_, item) {
        if (item != null) out.add(item);
      });
    }
    return out;
  }

  /// Standard vendor payment status from billed vs paid totals.
  String _poPaymentStatus(double totalCost, double paidAmount) {
    if (totalCost > 0 && paidAmount >= totalCost) return 'Paid';
    if (paidAmount > 0) return 'Partially Paid';
    return 'Unpaid';
  }

  /// Resolve the real Firebase node key for a PO (the direct key can miss when
  /// the node was written under a different key shape).
  Future<DatabaseReference> _resolvePoRef(String poId, {int? vendorId}) async {
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');
    final snapshot = await poRef.get();
    if (snapshot.exists && snapshot.value != null) return poRef;
    final allSnap = await _database.ref(FirebasePaths.purchaseOrders).get();
    if (allSnap.exists && allSnap.value != null) {
      final extracted =
          _safeExtractPO(allSnap.value, poId: poId, vendorId: vendorId);
      if (extracted != null) {
        final String resolvedKey = extracted['id']?.toString() ?? poId;
        return _database.ref('${FirebasePaths.purchaseOrders}/$resolvedKey');
      }
    }
    return poRef;
  }

  /// Run [mutate] as an atomic Firebase transaction against the live server
  /// state of the PO node. The mutate callback receives the fresh server-side
  /// PO map and must return the full replacement map (or null to abort).
  ///
  /// This replaces the old get-then-update pattern, which could read a stale
  /// snapshot, compute totals from zero, and permanently wipe billing/payment
  /// history from the cloud node (lost update).
  Future<void> _transactPurchaseOrder(
    String poId,
    Map<String, dynamic>? Function(Map<String, dynamic> poData) mutate, {
    int? vendorId,
  }) async {
    final targetRef = await _resolvePoRef(poId, vendorId: vendorId);
    final result = await targetRef.runTransaction((Object? current) {
      // Only transact on a well-formed PO map node; anything else aborts
      // rather than risk reshaping the node.
      if (current == null || current is! Map) return Transaction.abort();
      final poData = _safeExtractPO(current, poId: poId);
      if (poData == null) return Transaction.abort();
      final mutated = mutate(Map<String, dynamic>.from(poData));
      if (mutated == null) return Transaction.abort();
      return Transaction.success(mutated);
    });
    if (!result.committed) {
      throw Exception(
          'Purchase Order #$poId could not be updated (it changed during the write). Please retry.');
    }
  }

  /// Add a new Bill / Delivery entry onto a Vendor's Purchase Order
  Future<void> addVendorOrderEntry({
    required String poId,
    required double amount,
    String? notes,
    String? billUrl,
  }) async {
    // Generated once outside the transaction: the transaction function may run
    // multiple times and must stay pure.
    final int entryId = DateTime.now().millisecondsSinceEpoch;
    final String nowIso = DateTime.now().toIso8601String();
    final String noteText =
        notes?.isNotEmpty == true ? notes! : 'Purchase order delivery / bill';

    await _transactPurchaseOrder(poId, (poData) {
      final double totalCost =
          _poNum(poData['total_cost'] ?? poData['total_amount']);
      final double currentPaid = _poNum(poData['paid_amount']);
      final double newTotalCost = totalCost + amount;

      final List<dynamic> currentEntries = _poList(poData['order_entries']);
      currentEntries.add({
        'id': entryId,
        'po_id': int.tryParse(poId) ?? poId,
        'vendor_id': poData['vendor_id'] ?? (int.tryParse(poId) ?? 0),
        'amount': amount,
        'notes': noteText,
        if (billUrl != null && billUrl.isNotEmpty) 'bill_url': billUrl,
        'timestamp': nowIso,
      });

      final String prevNotes = poData['notes']?.toString() ?? '';
      final updated = Map<String, dynamic>.from(poData);
      updated['total_cost'] = newTotalCost;
      updated['total_amount'] = newTotalCost;
      updated['payment_status'] = _poPaymentStatus(newTotalCost, currentPaid);
      updated['order_entries'] = currentEntries;
      updated['notes'] = notes?.isNotEmpty == true
          ? (prevNotes.isNotEmpty ? '$prevNotes | $noteText' : noteText)
          : prevNotes;
      return updated;
    });
  }

  /// Record Partial or Full Payment on a Purchase Order
  Future<void> recordVendorPayment({
    required String poId,
    required int vendorId,
    required double amount,
    required String paymentMethod,
    String? notes,
    String? receiptUrl,
  }) async {
    final int paymentId = DateTime.now().millisecondsSinceEpoch;
    final String nowIso = DateTime.now().toIso8601String();
    final String noteText =
        notes ?? 'Payment recorded from mobile app';

    await _transactPurchaseOrder(
      poId,
      (poData) {
        final double totalCost =
            _poNum(poData['total_cost'] ?? poData['total_amount']);

        final List<dynamic> currentPayments = _poList(poData['payments']);
        currentPayments.add({
          'id': paymentId,
          'amount': amount,
          'payment_method': paymentMethod,
          'notes': noteText,
        if (receiptUrl != null && receiptUrl.isNotEmpty)
          'receipt_url': receiptUrl,
        'timestamp': nowIso,
      });

      // Re-sum total paid from all payments to ensure consistency
      double verifiedPaid = 0.0;
      for (final p in currentPayments) {
        if (p is Map) {
          verifiedPaid += _poNum((p as Map)['amount']);
        }
      }
      if (verifiedPaid <= 0) {
        verifiedPaid = _poNum(poData['paid_amount']) + amount;
      }

      final updated = Map<String, dynamic>.from(poData);
      updated['paid_amount'] = verifiedPaid;
      updated['payment_status'] = _poPaymentStatus(totalCost, verifiedPaid);
      updated['payments'] = currentPayments;
      return updated;
      },
      vendorId: vendorId,
    );
  }

  /// Delete a recorded vendor payment (Enforces 30-minute grace period unless bypassed)
  Future<void> deleteVendorPayment({
    required String poId,
    required dynamic paymentId,
    bool bypassTimeCheck = false,
  }) async {
    // Pre-read for friendly validation errors (existence + 30-minute window).
    // The transaction below re-validates atomically before mutating.
    final preRef = await _resolvePoRef(poId);
    final preSnap = await preRef.get();
    final preData = _safeExtractPO(preSnap.value, poId: poId);
    if (preData == null) {
      throw Exception('Purchase Order #$poId not found');
    }
    final prePayments = _poList(preData['payments']);
    final preIdx = prePayments.indexWhere(
        (p) => p is Map && p['id']?.toString() == paymentId.toString());
    if (preIdx == -1) {
      throw Exception('Payment record not found on PO #$poId');
    }
    if (!bypassTimeCheck) {
      final Map<String, dynamic> prePay = prePayments[preIdx] is Map
          ? Map<String, dynamic>.from(prePayments[preIdx] as Map)
          : <String, dynamic>{};
      final String timeStr = prePay['timestamp']?.toString() ?? '';
      final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
      if (DateTime.now().difference(parsedTime).inMinutes > 30) {
        throw Exception(
            'This payment was recorded more than 30 minutes ago and is now permanent.');
      }
    }

    await _transactPurchaseOrder(poId, (poData) {
      final List<dynamic> currentPayments = _poList(poData['payments']);
      final payIndex = currentPayments.indexWhere(
          (p) => p is Map && p['id']?.toString() == paymentId.toString());
      if (payIndex == -1) return null; // vanished concurrently -> abort, retry

      final Map<String, dynamic> targetPay = currentPayments[payIndex] is Map
          ? Map<String, dynamic>.from(currentPayments[payIndex] as Map)
          : <String, dynamic>{};
      if (!bypassTimeCheck) {
        final String timeStr = targetPay['timestamp']?.toString() ?? '';
        final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
        if (DateTime.now().difference(parsedTime).inMinutes > 30) {
          return null; // became permanent concurrently -> abort
        }
      }

      currentPayments.removeAt(payIndex);

      final double totalCost =
          _poNum(poData['total_cost'] ?? poData['total_amount']);
      double verifiedPaid = 0.0;
      for (final p in currentPayments) {
        if (p is Map) verifiedPaid += _poNum((p as Map)['amount']);
      }

      final updated = Map<String, dynamic>.from(poData);
      updated['paid_amount'] = verifiedPaid;
      updated['payment_status'] = _poPaymentStatus(totalCost, verifiedPaid);
      updated['payments'] = currentPayments;
      return updated;
    });
  }

  /// Update a recorded vendor payment (Enforces 30-minute grace period)
  Future<void> updateVendorPayment({
    required String poId,
    required dynamic paymentId,
    required double newAmount,
    String? newMethod,
    String? newNotes,
    bool bypassTimeCheck = false,
  }) async {
    // Pre-read for friendly validation errors; the transaction re-validates.
    final preRef = await _resolvePoRef(poId);
    final preSnap = await preRef.get();
    final preData = _safeExtractPO(preSnap.value, poId: poId);
    if (preData == null) {
      throw Exception('Purchase Order #$poId not found');
    }
    final prePayments = _poList(preData['payments']);
    final preIdx = prePayments.indexWhere(
        (p) => p is Map && p['id']?.toString() == paymentId.toString());
    if (preIdx == -1) {
      throw Exception('Payment record not found on PO #$poId');
    }
    if (!bypassTimeCheck) {
      final Map<String, dynamic> prePay = prePayments[preIdx] is Map
          ? Map<String, dynamic>.from(prePayments[preIdx] as Map)
          : <String, dynamic>{};
      final String timeStr = prePay['timestamp']?.toString() ?? '';
      final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
      if (DateTime.now().difference(parsedTime).inMinutes > 30) {
        throw Exception(
            'This payment was recorded more than 30 minutes ago and is now permanent.');
      }
    }

    await _transactPurchaseOrder(poId, (poData) {
      final List<dynamic> currentPayments = _poList(poData['payments']);
      final payIndex = currentPayments.indexWhere(
          (p) => p is Map && p['id']?.toString() == paymentId.toString());
      if (payIndex == -1) return null;

      final Map<String, dynamic> targetPay = currentPayments[payIndex] is Map
          ? Map<String, dynamic>.from(currentPayments[payIndex] as Map)
          : <String, dynamic>{};
      if (!bypassTimeCheck) {
        final String timeStr = targetPay['timestamp']?.toString() ?? '';
        final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
        if (DateTime.now().difference(parsedTime).inMinutes > 30) return null;
      }

      targetPay['amount'] = newAmount;
      if (newMethod != null) targetPay['payment_method'] = newMethod;
      if (newNotes != null) targetPay['notes'] = newNotes;
      currentPayments[payIndex] = targetPay;

      final double totalCost =
          _poNum(poData['total_cost'] ?? poData['total_amount']);
      double verifiedPaid = 0.0;
      for (final p in currentPayments) {
        if (p is Map) verifiedPaid += _poNum((p as Map)['amount']);
      }

      final updated = Map<String, dynamic>.from(poData);
      updated['paid_amount'] = verifiedPaid;
      updated['payment_status'] = _poPaymentStatus(totalCost, verifiedPaid);
      updated['payments'] = currentPayments;
      return updated;
    });
  }

  /// Delete a recorded order entry / invoice delivery (Enforces 30-minute grace period)
  Future<void> deleteVendorOrderEntry({
    required String poId,
    required dynamic entryId,
    bool bypassTimeCheck = false,
  }) async {
    // Pre-read for friendly validation errors; the transaction re-validates.
    final preRef = await _resolvePoRef(poId);
    final preSnap = await preRef.get();
    final preData = _safeExtractPO(preSnap.value, poId: poId);
    if (preData == null) {
      throw Exception('Purchase Order #$poId not found');
    }
    final preEntries = _poList(preData['order_entries']);
    final preIdx = preEntries.indexWhere(
        (e) => e is Map && e['id']?.toString() == entryId.toString());
    if (preIdx == -1) {
      throw Exception('Order entry record not found on PO #$poId');
    }
    if (!bypassTimeCheck) {
      final Map<String, dynamic> preEntry = preEntries[preIdx] is Map
          ? Map<String, dynamic>.from(preEntries[preIdx] as Map)
          : <String, dynamic>{};
      final String timeStr = preEntry['timestamp']?.toString() ?? '';
      final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
      if (DateTime.now().difference(parsedTime).inMinutes > 30) {
        throw Exception(
            'This order entry was recorded more than 30 minutes ago and is now permanent.');
      }
    }

    await _transactPurchaseOrder(poId, (poData) {
      final List<dynamic> currentEntries = _poList(poData['order_entries']);
      final entryIndex = currentEntries.indexWhere(
          (e) => e is Map && e['id']?.toString() == entryId.toString());
      if (entryIndex == -1) return null;

      final Map<String, dynamic> targetEntry = currentEntries[entryIndex] is Map
          ? Map<String, dynamic>.from(currentEntries[entryIndex] as Map)
          : <String, dynamic>{};
      if (!bypassTimeCheck) {
        final String timeStr = targetEntry['timestamp']?.toString() ?? '';
        final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
        if (DateTime.now().difference(parsedTime).inMinutes > 30) return null;
      }

      currentEntries.removeAt(entryIndex);

      // Re-sum billed from the surviving entries so the total can never be
      // corrupted by a stale read; floor at zero.
      double newTotalCost = 0.0;
      for (final e in currentEntries) {
        if (e is Map) newTotalCost += _poNum((e as Map)['amount']);
      }

      final double currentPaid = _poNum(poData['paid_amount']);

      final updated = Map<String, dynamic>.from(poData);
      updated['total_cost'] = newTotalCost;
      updated['total_amount'] = newTotalCost;
      updated['payment_status'] = _poPaymentStatus(newTotalCost, currentPaid);
      updated['order_entries'] = currentEntries;
      return updated;
    });
  }

  /// Update Purchase Order Status (e.g. 'Pending' -> 'Received')
  Future<void> updatePurchaseOrderStatus(String poId, String newStatus) async {
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$poId');
    await poRef.update({
      'status': newStatus,
    });
  }

  Future<void> deleteVendorPurchaseOrder(String id, {bool bypassTimeCheck = false}) async {
    final poRef = _database.ref('${FirebasePaths.purchaseOrders}/$id');
    if (!bypassTimeCheck) {
      final snap = await poRef.get();
      if (snap.exists && snap.value != null) {
        final poData = _safeExtractPO(snap.value, poId: id);
        if (poData != null) {
          final String timeStr = poData['timestamp']?.toString() ?? '';
          final parsedTime = DateTime.tryParse(timeStr) ?? DateTime.now();
          final diffMins = DateTime.now().difference(parsedTime).inMinutes;
          if (diffMins > 30) {
            throw Exception('This Purchase Order was created more than 30 minutes ago and is now permanent.');
          }
        }
      }
    }
    await poRef.remove();
  }

  /// Request printing a receipt from the computer printer connected via USB
  Future<void> requestRemotePrint({required Sale sale}) async {
    final String printReqId = 'print_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(9999)}';
    final printRef = _database.ref('${FirebasePaths.printRequests}/$printReqId');

    final itemsPayload = (sale.items ?? []).map((i) => {
      'name': i.productName,
      'price': i.price,
      'qty': i.quantity,
      'total': i.total,
    },).toList();

    await printRef.set({
      'id': printReqId,
      'sale_id': sale.id,
      'timestamp': DateTime.now().toIso8601String(),
      'status': 'PENDING',
      'items': itemsPayload,
      'payment': {
        'subtotal': sale.subtotal,
        'discount': sale.discount,
        'tax': sale.tax,
        'total': sale.total,
        'change': sale.changeGiven,
        'cashierName': sale.userName ?? 'Mobile Cashier',
        'customerName': sale.customerName ?? '',
        'payments': [
          {
            'method': sale.paymentMethod,
            'amount': sale.amountTendered > 0 ? sale.amountTendered : sale.total,
          }
        ],
      },
    });
  }

  /// Safely extracts a Purchase Order Map whether Firebase RTDB returns a Map, List, or nested structure
  Map<String, dynamic>? _safeExtractPO(dynamic rawValue, {String? poId, int? vendorId}) {
    if (rawValue == null) return null;
    if (rawValue is Map) {
      return Map<String, dynamic>.from(rawValue);
    }
    if (rawValue is List) {
      // 1. Try matching integer index if poId is an integer
      final int? index = poId != null ? int.tryParse(poId) : null;
      if (index != null && index >= 0 && index < rawValue.length && rawValue[index] is Map) {
        return Map<String, dynamic>.from(rawValue[index] as Map);
      }
      // 2. Search items for matching id
      for (final item in rawValue) {
        if (item is Map) {
          final itemId = item['id']?.toString();
          if (poId != null && itemId == poId) {
            return Map<String, dynamic>.from(item);
          }
        }
      }
      // 3. Search items for matching vendorId
      if (vendorId != null && vendorId != 0) {
        for (final item in rawValue) {
          if (item is Map) {
            final vId = item['vendor_id'] is int
                ? item['vendor_id']
                : int.tryParse(item['vendor_id']?.toString() ?? '');
            if (vId == vendorId) {
              return Map<String, dynamic>.from(item);
            }
          }
        }
      }
      // 4. Return first non-null map as fallback
      for (final item in rawValue) {
        if (item is Map) {
          return Map<String, dynamic>.from(item);
        }
      }
    }
    return null;
  }

  /// Dispose resources
  void dispose() {
    _khataBalanceListener?.cancel();
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
