# SSmart POS Admin - iOS Dashboard

A professional Flutter iOS admin application for monitoring sales, transactions, and analytics in real-time from the SSmart POS system.

## Features

### ✅ Currently Implemented

- **Real-Time Sales Monitoring**: Live data sync from Firebase Realtime Database
- **Dashboard Analytics**:
  - Today's revenue and transaction count
  - Average transaction value
  - Popular payment methods
  - 7-day sales trend chart
- **Transaction Management**:
  - View all transactions with filtering
  - Search by ID, amount, cashier, or payment method
  - Detailed transaction breakdown with items
- **Secure Authentication**: Firebase Auth with email/password
- **Connection Status**: Real-time online/offline indicator
- **Professional iOS Design**: Cupertino-style UI with smooth animations

### 🚧 Future Enhancements

The following features require the Electron POS app to sync additional data to Firebase:

- **Inventory Management**: Monitor stock levels and low-stock alerts
- **Cashier Sessions**: Track active sessions and session reports
- **Customer Analytics**: View customer purchase history and insights

These are marked with `TODO` comments in the codebase.

## Prerequisites

- **Flutter SDK**: 3.0.0 or higher ([Install Flutter](https://flutter.dev/docs/get-started/install))
- **iOS Development**:
  - macOS with Xcode 14+
  - iOS Simulator or physical iOS device
- **Firebase Project**: With Realtime Database and Authentication enabled
- **SSmart POS Electron App**: Running and syncing to Firebase

## Project Structure

```
flutter_admin_app/
├── lib/
│   ├── main.dart                    # App entry point
│   ├── core/                        # Core utilities
│   │   ├── constants/               # App constants
│   │   ├── theme/                   # Theme and styling
│   │   └── utils/                   # Helper utilities
│   ├── models/                      # Data models
│   │   ├── sale.dart
│   │   └── dashboard_metrics.dart
│   ├── services/                    # Business logic services
│   │   ├── firebase_service.dart
│   │   └── auth_service.dart
│   ├── features/                    # Feature modules
│   │   ├── auth/
│   │   │   └── screens/
│   │   ├── dashboard/
│   │   │   ├── screens/
│   │   │   └── widgets/
│   │   └── transactions/
│   │       ├── screens/
│   │       └── widgets/
│   └── widgets/                     # Shared widgets
├── pubspec.yaml
├── .env                             # Environment variables (create this)
├── .env.example                     # Environment template
└── README.md
```

## Setup Instructions

### 1. Clone and Navigate

```bash
cd ssmart-pos/flutter_admin_app
```

### 2. Install Dependencies

```bash
flutter pub get
```

### 3. Configure Firebase

#### A. Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (same one used by Electron POS)
3. Click the **gear icon** → **Project settings**
4. Scroll to "Your apps" and click **iOS** (or add iOS app if not exists)
5. Copy the configuration values

#### B. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and fill in your Firebase credentials:

```env
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:ios:abcdef123456
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Important**: The `.env` file is in `.gitignore` to protect your credentials.

### 4. Firebase Realtime Database Rules

Ensure your Firebase Realtime Database has proper security rules:

```json
{
  "rules": {
    "sales": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 5. Create Firebase Admin User

Since the app uses email/password authentication, create an admin user:

1. Go to Firebase Console → **Authentication** → **Users**
2. Click **Add user**
3. Enter admin email and password
4. Use these credentials to log into the app

### 6. Run the App

#### iOS Simulator

```bash
flutter run
```

#### Physical iOS Device

```bash
# List available devices
flutter devices

# Run on specific device
flutter run -d <device-id>
```

### 7. Build for Release

See the **[Automated iOS Builds](#automated-ios-builds)** section below for production builds using GitHub Actions and TestFlight.

## Usage

### Login

1. Launch the app
2. Enter your Firebase admin credentials
3. Tap **Sign In**

### Dashboard

The dashboard displays:
- **Today's Performance Metrics**: Revenue, transactions, average sale
- **Sales Trend Chart**: Visual representation of last 7 days
- **Recent Transactions**: Latest 10 transactions
- **Connection Status**: Online/offline indicator in the app bar

### Viewing Transactions

1. Tap **View All** on the Recent Transactions card
2. Use the search bar to find specific transactions
3. Apply filters: All, Today, This Week, This Month
4. Tap any transaction to see detailed breakdown

### Logout

1. Tap the **user icon** in the top right
2. Select **Sign Out**

## Data Synchronization

### How It Works

1. **Electron POS App** creates sales and syncs to Firebase at path: `sales/{saleId}`
2. **Flutter Admin App** listens to Firebase Realtime Database using streams
3. UI updates **instantly** when new sales are created
4. Works **offline** with cached data

### Data Structure

The app expects sales data in this format:

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
      "items": [...],
      "payments": [...]
    }
  }
}
```

## Troubleshooting

### Firebase Connection Issues

**Problem**: App shows "Offline" status

**Solutions**:
1. Check internet connectivity
2. Verify Firebase credentials in `.env`
3. Ensure Firebase Realtime Database is enabled in console
4. Check database rules allow authenticated reads

### Authentication Errors

**Problem**: Login fails with error

**Solutions**:
1. Verify email/password in Firebase Console → Authentication
2. Ensure Firebase Auth is enabled
3. Check error message for specific issue (wrong password, user not found, etc.)

### No Sales Data

**Problem**: Dashboard shows "No Sales Data Yet"

**Solutions**:
1. Verify Electron POS app is running and syncing
2. Check Firebase Console → Realtime Database → `sales/` path
3. Ensure you have network connectivity
4. Try pull-to-refresh on the dashboard

### Build Errors

**Problem**: Flutter build fails

**Solutions**:
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter run
```

## Automated iOS Builds

This project includes automated iOS build and deployment using GitHub Actions, Fastlane, and TestFlight.

### Quick Start

**Trigger a build by creating a tag:**

```bash
# Create and push a release tag
git tag flutter-v1.0.0
git push origin flutter-v1.0.0
```

This automatically:
1. Builds the IPA file
2. Uploads to TestFlight (if configured)
3. Creates a GitHub release with the IPA

### Manual Build Trigger

1. Go to **Actions** tab in GitHub
2. Select **Build Flutter iOS Admin App**
3. Click **Run workflow**
4. Choose whether to deploy to TestFlight
5. Click **Run workflow**

### Complete Setup Guide

For detailed instructions on setting up automated builds, including:
- Apple Developer account configuration
- Fastlane Match setup for code signing
- GitHub Secrets configuration
- TestFlight distribution
- Troubleshooting common issues

**See the comprehensive guide:** [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md)

### Local Builds with Fastlane

If you have a Mac and want to build locally:

```bash
cd ios

# Install dependencies
bundle install

# Build IPA (no upload)
bundle exec fastlane build_only

# Build and upload to TestFlight
bundle exec fastlane beta
```

### Cost Summary

- **Apple Developer Program:** $99/year (required)
- **GitHub Actions:** Free tier sufficient for most projects
- **Total:** ~$99/year

## Development

### Running Tests

```bash
flutter test
```

### Code Quality

```bash
# Analyze code
flutter analyze

# Format code
flutter format lib/
```

### Adding New Features

1. Follow the existing feature-first architecture
2. Create new features in `lib/features/`
3. Add models in `lib/models/`
4. Update services in `lib/services/` if needed
5. Keep widgets reusable in `lib/widgets/`

## Dependencies

Key packages used:

- `firebase_core` - Firebase initialization
- `firebase_database` - Realtime Database integration
- `firebase_auth` - User authentication
- `provider` - State management
- `fl_chart` - Beautiful charts
- `google_fonts` - Professional typography
- `intl` - Date/number formatting
- `flutter_dotenv` - Environment variables

## Performance Tips

1. **Caching**: The app caches sales data for 5 minutes to reduce Firebase reads
2. **Pagination**: Transaction list supports pagination (not yet in UI)
3. **Stream Management**: Streams are properly disposed to prevent memory leaks
4. **Optimizations**:
   - Const constructors used throughout
   - Lazy loading where appropriate
   - Efficient data filtering

## Security Notes

- Never commit `.env` file to version control
- Use Firebase security rules to restrict access
- Admin credentials should be strong passwords
- Consider implementing role-based access control
- Enable Firebase App Check for production

## Support

For issues related to:
- **Flutter App**: Check this README and Flutter documentation
- **Firebase Setup**: See [Firebase Documentation](https://firebase.google.com/docs)
- **Electron POS Integration**: Check the main ssmart-pos repository

## License

Part of the SSmart POS system.

## Version History

### v1.0.0 (Current)
- Initial release
- Real-time sales monitoring
- Dashboard analytics
- Transaction management
- Firebase authentication
- iOS-optimized UI

---

Built with ❤️ using Flutter
