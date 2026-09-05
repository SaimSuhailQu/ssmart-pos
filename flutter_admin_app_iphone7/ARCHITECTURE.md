# Architecture Documentation

## Overview

SSmart POS Admin follows a **feature-first architecture** with clear separation of concerns, making the codebase maintainable, testable, and scalable.

## Architecture Principles

### 1. Feature-First Organization
Features are self-contained modules with their own screens, widgets, and business logic.

### 2. Service Layer
Services handle all business logic and external API calls (Firebase).

### 3. Provider for State Management
Using Provider pattern for dependency injection and state management.

### 4. Separation of Concerns
- **Models**: Pure data classes
- **Services**: Business logic and API calls
- **Widgets**: UI components
- **Screens**: Feature entry points

## Directory Structure

```
lib/
├── main.dart                         # App entry point, Firebase init
│
├── core/                             # Core utilities used across features
│   ├── constants/
│   │   └── firebase_constants.dart   # Firebase paths and config keys
│   ├── theme/
│   │   └── app_theme.dart            # Centralized theming
│   └── utils/
│       └── date_utils.dart           # Date/currency formatting
│
├── models/                           # Data models (pure Dart classes)
│   ├── sale.dart                     # Sale, SaleItem, PaymentDetail
│   └── dashboard_metrics.dart        # Aggregated metrics
│
├── services/                         # Business logic services
│   ├── firebase_service.dart         # Firebase Realtime DB operations
│   └── auth_service.dart             # Authentication logic
│
├── features/                         # Feature modules
│   ├── auth/
│   │   └── screens/
│   │       └── login_screen.dart
│   ├── dashboard/
│   │   ├── screens/
│   │   │   └── dashboard_screen.dart
│   │   └── widgets/
│   │       ├── metric_card.dart
│   │       ├── sales_chart.dart
│   │       └── recent_transactions.dart
│   └── transactions/
│       └── screens/
│           └── transactions_screen.dart
│
└── widgets/                          # Shared/reusable widgets
    ├── loading_indicator.dart
    └── error_widget.dart
```

## Data Flow

```
Firebase Realtime Database
           ↓
    FirebaseService (Stream)
           ↓
    StreamBuilder (in Widget)
           ↓
      Model Classes
           ↓
     Widget Tree (UI)
```

### Example Flow for Sales Data

1. **Firebase** stores sales at path `sales/{saleId}`
2. **FirebaseService.getSalesStream()** creates a real-time stream
3. **DashboardScreen** uses StreamBuilder to listen
4. **Sale.fromJson()** parses Firebase data to model
5. **DashboardMetrics** calculates aggregated data
6. **Widgets** display the data

## Key Components

### Services

#### FirebaseService
- **Purpose**: All Firebase Realtime Database operations
- **Key Methods**:
  - `getSalesStream()`: Real-time stream of all sales
  - `getTodaysSalesStream()`: Filtered stream for today
  - `getTransactionCount()`: Count of transactions
  - `testConnection()`: Connection health check
- **Features**:
  - Caching (5-minute duration)
  - Error handling
  - Connection status monitoring

#### AuthService
- **Purpose**: Firebase Authentication operations
- **Key Methods**:
  - `signInWithEmailAndPassword()`: Login
  - `signOut()`: Logout
  - `authStateChanges`: Stream of auth state
- **Features**:
  - User-friendly error messages
  - Session persistence

### Models

#### Sale
- **Purpose**: Represents a single transaction
- **Features**:
  - JSON serialization (`fromJson`, `toJson`)
  - Nested items and payments
  - Type-safe null handling

#### DashboardMetrics
- **Purpose**: Aggregated analytics data
- **Features**:
  - Calculated from list of Sales
  - Daily revenue breakdown
  - Payment method analysis
  - Factory constructors for different date ranges

### Screens

#### DashboardScreen
- **Purpose**: Main admin dashboard
- **Features**:
  - Real-time metrics cards
  - Sales trend chart (7 days)
  - Recent transactions list
  - Pull-to-refresh
  - Connection status indicator
- **State Management**: StreamBuilder with FirebaseService

#### TransactionsScreen
- **Purpose**: Full transaction list with filtering
- **Features**:
  - Search functionality
  - Date range filters
  - Transaction detail modal
  - Empty/error states
- **State Management**: Local state + StreamBuilder

### Widgets

#### Shared Widgets
- **MetricCard**: Reusable metric display
- **SalesChart**: Line chart using fl_chart
- **RecentTransactions**: Transaction list component
- **AppLoadingIndicator**: Loading states
- **AppErrorWidget**: Error handling with retry

## State Management Strategy

### Provider Pattern

We use Provider for:
1. **Dependency Injection**: Services are provided at app root
2. **Reactive Updates**: Widgets rebuild when auth state changes
3. **Clean Architecture**: Services don't depend on UI

```dart
MultiProvider(
  providers: [
    Provider<FirebaseAuth>(...),
    ProxyProvider<FirebaseAuth, AuthService>(...),
    ProxyProvider<FirebaseDatabase, FirebaseService>(...),
  ],
  child: App(),
)
```

### StreamBuilder Pattern

For real-time data:

```dart
StreamBuilder<List<Sale>>(
  stream: firebaseService.getSalesStream(),
  builder: (context, snapshot) {
    // Handle loading, error, and data states
  },
)
```

## Error Handling

### Levels of Error Handling

1. **Service Level**: Catch Firebase exceptions, return user-friendly errors
2. **Widget Level**: Display errors with retry actions
3. **User Level**: Clear error messages with actionable solutions

### Example: AuthService

```dart
try {
  await auth.signIn(...);
} on FirebaseAuthException catch (e) {
  throw _handleAuthException(e); // Convert to AuthException
}
```

## Performance Optimizations

### 1. Caching
- Sales data cached for 5 minutes
- Reduces Firebase read operations
- Improves offline experience

### 2. Const Constructors
- Used throughout for immutable widgets
- Reduces widget rebuilds

### 3. Stream Management
- Streams properly disposed
- No memory leaks

### 4. Lazy Loading
- Dashboard only loads recent 10 transactions
- Full list loaded on demand in TransactionsScreen

## Testing Strategy

### Unit Tests (Recommended)
- Test models: JSON serialization
- Test services: Mock Firebase responses
- Test utilities: Date formatting, calculations

### Widget Tests (Recommended)
- Test screens with mocked services
- Test error states
- Test loading states

### Integration Tests (Recommended)
- Test auth flow
- Test real-time updates
- Test offline handling

## Future Enhancements

### 1. Inventory Module (TODO)
Once Electron POS syncs inventory:

```
lib/features/inventory/
  ├── screens/
  │   └── inventory_screen.dart
  ├── widgets/
  │   ├── inventory_card.dart
  │   └── low_stock_alert.dart
  └── models/
      └── inventory_item.dart
```

### 2. Cashier Sessions (TODO)
```
lib/features/sessions/
  ├── screens/
  │   ├── sessions_screen.dart
  │   └── session_detail_screen.dart
  └── models/
      └── cashier_session.dart
```

### 3. Reports & Analytics (TODO)
```
lib/features/reports/
  ├── screens/
  │   └── reports_screen.dart
  └── widgets/
      ├── revenue_report.dart
      └── sales_comparison.dart
```

## Code Style Guidelines

### Naming Conventions
- **Classes**: PascalCase (`DashboardScreen`)
- **Files**: snake_case (`dashboard_screen.dart`)
- **Variables**: camelCase (`totalRevenue`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_CURRENCY`)

### Import Order
1. Dart/Flutter imports
2. Package imports
3. Project imports

### Documentation
- All public APIs have doc comments
- Complex logic has inline comments
- TODO comments for future enhancements

## Security Considerations

1. **Environment Variables**: Never commit `.env`
2. **Firebase Rules**: Require authentication
3. **Data Validation**: Validate all user inputs
4. **Error Messages**: Don't expose sensitive info

## Deployment

### iOS Build Process
1. Update version in `pubspec.yaml`
2. Run `flutter build ios --release`
3. Open Xcode workspace
4. Configure signing
5. Archive and distribute

### Firebase Configuration
- Use separate Firebase projects for dev/prod
- Update `.env` for each environment
- Test thoroughly before production

---

**Note**: This architecture is designed to scale. As new features are added (inventory, sessions, etc.), follow the same patterns established here.
