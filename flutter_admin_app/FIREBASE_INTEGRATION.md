# Firebase Integration Guide

## Overview

The SSmart POS Admin app integrates with **Firebase Realtime Database** (not Firestore) to sync data from the Electron POS system. This document explains the integration details.

## Firebase Architecture

```
Firebase Project
├── Authentication
│   └── Email/Password Provider
├── Realtime Database
│   └── sales/
│       ├── sale_12345/
│       ├── sale_12346/
│       └── ...
└── (Future: inventory/, sessions/, customers/)
```

## Realtime Database Structure

### Current Implementation

```json
{
  "sales": {
    "sale_12345": {
      "id": "sale_12345",
      "subtotal": 1000.00,
      "tax": 50.00,
      "discount": 0.00,
      "total": 1050.00,
      "payment_method": "Cash",
      "amount_tendered": 1100.00,
      "change_given": 50.00,
      "timestamp": "2024-12-15T14:30:00.000Z",
      "store_branch": "Main Mall Branch #1",
      "user_id": 1,
      "user_name": "John Doe",
      "items": [
        {
          "product_id": 101,
          "product_name": "Product A",
          "product_barcode": "123456789",
          "product_category": "Electronics",
          "qty": 2,
          "price": 500.00
        }
      ],
      "payments": [
        {
          "method": "Cash",
          "amount": 1050.00
        }
      ]
    }
  }
}
```

### Future Structure (When Implemented in Electron POS)

```json
{
  "sales": { ... },
  "inventory": {
    "product_101": {
      "id": 101,
      "name": "Product A",
      "barcode": "123456789",
      "category": "Electronics",
      "price": 500.00,
      "stock": 50,
      "low_stock_threshold": 10
    }
  },
  "cashier_sessions": {
    "session_abc": {
      "id": "session_abc",
      "user_id": 1,
      "user_name": "John Doe",
      "start_time": "2024-12-15T08:00:00.000Z",
      "end_time": null,
      "starting_cash": 1000.00,
      "total_sales": 5000.00,
      "status": "active"
    }
  },
  "customers": {
    "customer_123": {
      "id": 123,
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+92-300-1234567",
      "total_purchases": 15000.00,
      "last_purchase": "2024-12-15T14:30:00.000Z"
    }
  }
}
```

## Firebase Security Rules

### Current Rules (Production-Ready)

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "sales": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$saleId": {
        ".validate": "newData.hasChildren(['id', 'total', 'timestamp', 'payment_method'])"
      }
    }
  }
}
```

### Enhanced Rules (Recommended for Production)

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "sales": {
      ".read": "auth != null && auth.token.admin === true",
      ".write": "auth != null",
      "$saleId": {
        ".validate": "newData.hasChildren(['id', 'total', 'timestamp', 'payment_method']) && newData.child('total').isNumber() && newData.child('timestamp').isString()"
      }
    },

    "inventory": {
      ".read": "auth != null && auth.token.admin === true",
      ".write": "auth != null && auth.token.admin === true"
    },

    "cashier_sessions": {
      ".read": "auth != null && (auth.token.admin === true || auth.uid === data.child('user_id').val())",
      ".write": "auth != null"
    },

    "customers": {
      ".read": "auth != null && auth.token.admin === true",
      ".write": "auth != null && auth.token.admin === true"
    }
  }
}
```

To enable admin claims:
```javascript
// Firebase Admin SDK (run once for admin user)
admin.auth().setCustomUserClaims(uid, { admin: true });
```

## Data Synchronization

### How Electron POS Syncs Data

From `src/syncEngine.ts`:

```typescript
// Syncs every 15 seconds
setInterval(async () => {
  const unsynced = getUnsyncedSales();
  for (const sale of unsynced) {
    const saleRef = ref(dbInstance, `sales/${sale.id}`);
    await set(saleRef, {
      id: sale.id,
      subtotal: sale.subtotal,
      tax: sale.tax,
      discount: sale.discount,
      total: sale.total,
      payment_method: sale.payment_method,
      amount_tendered: sale.amount_tendered,
      change_given: sale.change_given,
      timestamp: sale.timestamp,
      items: sale.items,
      payments: sale.payments,
      store_branch: "Main Mall Branch #1",
      user_id: sale.user_id,
      user_name: sale.user_name
    });
    markSaleAsSynced(sale.id);
  }
}, 15000);
```

### How Flutter Admin App Listens

From `lib/services/firebase_service.dart`:

```dart
Stream<List<Sale>> getSalesStream() {
  final salesRef = _database.ref(FirebasePaths.sales);

  return salesRef.onValue.map((event) {
    final salesData = event.snapshot.value;
    if (salesData == null) return <Sale>[];

    final salesMap = salesData as Map<dynamic, dynamic>;
    final sales = salesMap.entries
        .map((entry) => Sale.fromJson(
              entry.key.toString(),
              entry.value as Map<dynamic, dynamic>,
            ))
        .toList();

    // Sort by timestamp descending
    sales.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sales;
  });
}
```

## Real-Time Updates

### Event Flow

```
1. Cashier completes sale in Electron POS
2. Sale saved to local SQLite
3. syncEngine marks as unsynced
4. Background worker syncs to Firebase (within 15 seconds)
5. Firebase triggers onValue event
6. Flutter app receives new data
7. StreamBuilder rebuilds UI
8. Admin sees transaction instantly
```

### Connection Status Monitoring

```dart
// Listen to Firebase connection status
final connectedRef = _database.ref('.info/connected');
connectedRef.onValue.listen((event) {
  final isConnected = event.snapshot.value as bool? ?? false;
  // Update UI with online/offline status
});
```

## Firebase Configuration

### Environment Variables

The app uses `flutter_dotenv` to load Firebase config:

```dart
await Firebase.initializeApp(
  options: FirebaseOptions(
    apiKey: dotenv.env['FIREBASE_API_KEY']!,
    authDomain: dotenv.env['FIREBASE_AUTH_DOMAIN']!,
    databaseURL: dotenv.env['FIREBASE_DATABASE_URL']!,
    projectId: dotenv.env['FIREBASE_PROJECT_ID']!,
    storageBucket: dotenv.env['FIREBASE_STORAGE_BUCKET']!,
    messagingSenderId: dotenv.env['FIREBASE_MESSAGING_SENDER_ID']!,
    appId: dotenv.env['FIREBASE_APP_ID']!,
    measurementId: dotenv.env['FIREBASE_MEASUREMENT_ID'],
  ),
);
```

### iOS-Specific Configuration

For iOS, you may also need `GoogleService-Info.plist`:

1. Download from Firebase Console
2. Place in `ios/Runner/`
3. Add to Xcode project

**Note**: The app currently uses environment variables only, but adding the plist file is recommended for production.

## Performance Optimization

### 1. Data Caching

```dart
class FirebaseService {
  List<Sale>? _cachedSales;
  DateTime? _cacheTimestamp;
  static const _cacheDuration = Duration(minutes: 5);

  bool get _isCacheValid {
    if (_cachedSales == null || _cacheTimestamp == null) return false;
    final age = DateTime.now().difference(_cacheTimestamp!);
    return age < _cacheDuration;
  }
}
```

### 2. Query Optimization

```dart
// Instead of loading all data:
final query = _database.ref('sales')
    .orderByChild('timestamp')
    .limitToLast(100); // Only last 100 transactions

// For date range queries:
final query = _database.ref('sales')
    .orderByChild('timestamp')
    .startAt(startDate)
    .endAt(endDate);
```

### 3. Offline Persistence

Enable offline persistence (recommended for production):

```dart
FirebaseDatabase.instance.setPersistenceEnabled(true);
FirebaseDatabase.instance.setPersistenceCacheSizeBytes(10000000); // 10MB
```

## Error Handling

### Network Errors

```dart
try {
  final snapshot = await ref.get();
} catch (e) {
  if (e is FirebaseException) {
    if (e.code == 'network-request-failed') {
      // Handle offline scenario
      return getCachedData();
    }
  }
  rethrow;
}
```

### Permission Errors

```dart
try {
  final snapshot = await ref.get();
} on FirebaseException catch (e) {
  if (e.code == 'permission-denied') {
    throw AuthException('Access denied. Please check your permissions.');
  }
}
```

## Testing Firebase Integration

### Local Emulator (Recommended for Development)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Start emulators
firebase emulators:start --only auth,database
```

Update code for emulator:

```dart
// In development
if (kDebugMode) {
  await FirebaseAuth.instance.useAuthEmulator('localhost', 9099);
  FirebaseDatabase.instance.useDatabaseEmulator('localhost', 9000);
}
```

### Production Testing Checklist

- [ ] Verify Firebase credentials in `.env`
- [ ] Check database rules allow authenticated reads
- [ ] Create test admin user in Firebase Console
- [ ] Test login/logout flow
- [ ] Verify real-time updates work
- [ ] Test offline/online transitions
- [ ] Check error handling
- [ ] Verify connection status indicator

## Monitoring & Analytics

### Firebase Analytics (Optional)

Add to `pubspec.yaml`:
```yaml
firebase_analytics: ^10.7.4
```

Track events:
```dart
final analytics = FirebaseAnalytics.instance;

// Track screen views
analytics.logScreenView(screenName: 'Dashboard');

// Track user actions
analytics.logEvent(
  name: 'view_transaction',
  parameters: {'transaction_id': saleId},
);
```

### Crashlytics (Recommended for Production)

Add to `pubspec.yaml`:
```yaml
firebase_crashlytics: ^3.4.8
```

Setup:
```dart
FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterError;
```

## Best Practices

### 1. Use Indexes for Queries

In Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    "sales": {
      ".indexOn": ["timestamp", "user_id", "payment_method"]
    }
  }
}
```

### 2. Implement Rate Limiting

Prevent excessive reads:

```dart
// Debounce rapid updates
Timer? _debounceTimer;

void onSearchChanged(String query) {
  _debounceTimer?.cancel();
  _debounceTimer = Timer(Duration(milliseconds: 500), () {
    // Perform search
  });
}
```

### 3. Handle Large Datasets

Implement pagination:

```dart
Future<List<Sale>> getNextPage(String? lastKey) async {
  var query = _database.ref('sales')
      .orderByKey()
      .limitToFirst(20);

  if (lastKey != null) {
    query = query.startAfter(lastKey);
  }

  final snapshot = await query.get();
  // Parse and return sales
}
```

## Troubleshooting

### Issue: Data Not Syncing

**Check**:
1. Electron POS is online and syncing
2. Firebase Console shows data at `sales/` path
3. Flutter app shows "Online" status
4. Database rules allow reads

### Issue: Permission Denied

**Check**:
1. User is logged in (check auth state)
2. Database rules allow authenticated reads
3. Admin user has correct permissions

### Issue: Slow Performance

**Solutions**:
1. Enable offline persistence
2. Implement pagination
3. Use indexes for queries
4. Cache frequently accessed data

---

**Important**: The Electron POS app uses **Firebase Realtime Database**, NOT Firestore. Ensure you're using the correct Firebase product throughout.
