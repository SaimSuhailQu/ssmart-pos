/// Firebase Realtime Database path constants
/// These paths must match the Electron POS app's sync structure
class FirebasePaths {
  // Sales data path - synced from Electron POS
  static const String sales = 'sales';

  // Connection status path
  static const String connectionInfo = '.info/connected';

  // Products/Catalog data path
  static const String products = 'products';

  // Active sync paths matching POS
  static const String expenses = 'expenses';
  static const String customers = 'customers';
  static const String vendors = 'vendors';
  static const String purchaseOrders = 'purchase_orders';
  static const String cashierSessions = 'cashier_sessions';
  static const String users = 'users';

  /// Get sales path by ID
  static String saleById(String saleId) => '$sales/$saleId';
}

/// Firebase configuration keys from environment
class FirebaseEnvKeys {
  static const String apiKey = 'FIREBASE_API_KEY';
  static const String authDomain = 'FIREBASE_AUTH_DOMAIN';
  static const String databaseUrl = 'FIREBASE_DATABASE_URL';
  static const String projectId = 'FIREBASE_PROJECT_ID';
  static const String storageBucket = 'FIREBASE_STORAGE_BUCKET';
  static const String messagingSenderId = 'FIREBASE_MESSAGING_SENDER_ID';
  static const String appId = 'FIREBASE_APP_ID';
  static const String measurementId = 'FIREBASE_MEASUREMENT_ID';
}

/// Fallback Firebase configuration when .env is absent or partially configured
class FirebaseDefaultConfig {
  static const String apiKey = 'AIzaSyBBXuvZ1GCj9v-ZfgIFdmxT7fqBck1GJ6c';
  static const String authDomain = 'ssmart-c6e43.firebaseapp.com';
  static const String databaseUrl = 'https://ssmart-c6e43-default-rtdb.firebaseio.com';
  static const String projectId = 'ssmart-c6e43';
  static const String storageBucket = 'ssmart-c6e43.firebasestorage.app';
  static const String messagingSenderId = '3113728357';
  static const String appId = '1:3113728357:web:9f26cd9bf162ab9f60c98c';
  static const String measurementId = 'G-9LVJLM3R6H';
}

/// App-wide constants
class AppConstants {
  // Pagination
  static const int transactionsPerPage = 20;
  static const int recentTransactionsLimit = 10;

  // Refresh intervals
  static const Duration metricsRefreshInterval = Duration(minutes: 1);

  // Chart configuration
  static const int chartDaysHistory = 7;

  // Currency
  static const String currencySymbol = 'PKR';
  static const String currencyLocale = 'en_PK';
}
