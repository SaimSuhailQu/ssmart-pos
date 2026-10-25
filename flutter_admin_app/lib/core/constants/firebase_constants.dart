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
  static const String printRequests = 'print_requests';
  static const String dailyClosings = 'daily_closings';
  static const String itemsToBring = 'items_to_bring';

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
  static const String serverClientId = 'GOOGLE_SERVER_CLIENT_ID';
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
  // Web OAuth client ID for Google sign-in on Android (google_sign_in v7
  // requires serverClientId when google-services.json is not bundled).
  // Find it in: Google Cloud Console > APIs & Services > Credentials >
  // OAuth 2.0 Client IDs > "Web client" for this Firebase project.
  static const String serverClientId =
      '3113728357-6oa94bop9p3i4do6cirels6hj431rffr.apps.googleusercontent.com';
}

/// Owner / master account allowlist for the mobile admin app.
///
/// Only these accounts may sign in: anyone else is rejected at login and any
/// other signed-in session is signed out on app start. This is what makes the
/// admin app the OWNER app instead of "any Gmail can be admin" (with the
/// Google provider enabled, Firebase would otherwise accept every account).
/// Add more emails here only if you genuinely want co-owners.
class OwnerConfig {
  static const String ownerEmail = 'saim.suhail.5@gmail.com';

  static const List<String> masterEmails = <String>[ownerEmail];

  static bool isMasterEmail(String? email) {
    if (email == null) return false;
    final e = email.trim().toLowerCase();
    return masterEmails.contains(e);
  }
}

/// Gate for every `ts`-based sales query in the app (scoped date views
/// and the recent-window offline cache). See sales_ts_range.dart for the
/// full rule. DO NOT flip this to true on backfill alone: it also
/// requires every shop device to run v2.6.3+, so new writes carry `ts`.
/// While false, date views filter full history client-side and the sales
/// offline cache syncs the whole node — slower, but nothing is dropped.
class SalesTsConfig {
  static const bool backfillComplete = false;

  /// Offline-cache window in days, used for the sales keepSynced query
  /// once [backfillComplete] is true.
  static const int recentWindowDays = 30;
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
