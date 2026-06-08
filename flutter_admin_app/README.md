# SSmart POS Admin - iOS Dashboard

A professional Flutter iOS admin application for monitoring sales, transactions, and analytics in real-time from the SSmart POS system.

## Quick Start

Get started in under 5 minutes with our automated setup:

```bash
cd flutter_admin_app
./quickstart.sh
```

This interactive script will:
- Check prerequisites (Flutter, Xcode, Git)
- Install dependencies
- Set up your Firebase configuration
- Validate everything is working
- Optionally run the app immediately

### Manual Setup

If you prefer manual setup or the script doesn't work:

1. **Install dependencies:**
   ```bash
   flutter pub get
   ```

2. **Configure Firebase:**

   **Option A: Local Development (Recommended)**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```
   See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions.

   **Option B: CI/CD with GitHub Secrets**
   - For GitHub Actions automated builds
   - More secure, no .env needed
   - See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for setup guide

3. **Validate configuration:**
   ```bash
   dart run scripts/validate_firebase.dart
   ```

4. **Run the app:**
   ```bash
   flutter run
   ```

### Need Help?

- **Environment Setup (Local)**: [ENV_SETUP.md](./ENV_SETUP.md) - Firebase .env file configuration
- **GitHub Secrets (CI/CD)**: [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Secure Firebase setup for GitHub Actions
- **iOS Build Guide**: [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md) - Build and distribution guide
- **Troubleshooting**: See the troubleshooting section below

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
├── setup.sh                         # Automated setup script
├── quickstart.sh                    # Interactive quick start
├── scripts/
│   └── validate_firebase.dart       # Firebase config validator
└── README.md
```

## Firebase Configuration Options

The SSmart POS Admin app supports **two** ways to configure Firebase credentials:

### Option 1: .env File (Local Development) ⭐ Recommended for Local

**Best for:** Local development, testing, quick iteration

**Setup:**
```bash
cd flutter_admin_app
cp .env.example .env
# Edit .env with your Firebase credentials
```

**Pros:**
- ✅ Simple and fast
- ✅ Easy to edit and update
- ✅ No extra configuration needed
- ✅ Works offline

**Cons:**
- ❌ Must not commit to Git
- ❌ Each developer needs their own
- ❌ Not suitable for CI/CD

**Guide:** [ENV_SETUP.md](./ENV_SETUP.md)

### Option 2: GitHub Secrets (CI/CD) ⭐ Recommended for CI/CD

**Best for:** GitHub Actions, automated builds, production deployments

**Setup:**
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add 8 Firebase secrets (see guide for details)
3. Workflow automatically creates .env during build

**Pros:**
- ✅ Secure (encrypted at rest)
- ✅ No .env file needed
- ✅ Easy to update without code changes
- ✅ Standard for production

**Cons:**
- ❌ Only for GitHub Actions
- ❌ Can't use for local development
- ❌ Requires repository access

**Guide:** [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)

### Using Both (Recommended)

The best approach is to use **both**:
- **Local development:** Use .env file (faster iteration)
- **GitHub Actions CI/CD:** Use GitHub Secrets (more secure)
- Keep the same Firebase values in both

## Detailed Setup Instructions

For detailed manual setup instructions, see the sections below. For quick automated setup, use `./quickstart.sh` as shown in the Quick Start section above.

### 1. Clone and Navigate

```bash
cd ssmart-pos/flutter_admin_app
```

### 2. Automated Setup (Recommended)

Use our automated setup script:

```bash
./setup.sh
```

Or use the interactive quick start:

```bash
./quickstart.sh
```

### 3. Manual Setup (Alternative)

If you prefer manual setup:

#### A. Install Dependencies

```bash
flutter pub get
```

#### B. Configure Firebase

1. **Get Firebase Configuration**

   Go to [Firebase Console](https://console.firebase.google.com) → Project Settings → General

   See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions with screenshots.

2. **Create Environment File**

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

3. **Validate Configuration**

   ```bash
   dart run scripts/validate_firebase.dart
   ```

#### C. Firebase Setup

1. **Database Rules**: Ensure proper security rules in Firebase Console → Realtime Database → Rules:

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

2. **Create Admin User**: Firebase Console → Authentication → Users → Add user

#### D. Run the App

```bash
flutter run
```

For iOS Simulator:
```bash
flutter build ios --simulator
```

For physical iOS device:
```bash
flutter devices
flutter run -d <device-id>
```

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

## iOS Builds

This project supports **two types of iOS builds** to fit your needs:

### 1. Development Builds (No Apple Account) ⭐ START HERE

**Perfect for:** Development, testing, learning

**Requirements:** None! Just Flutter and Xcode (if on Mac)

**What you get:**
- ✅ Build for iOS Simulator
- ✅ Test locally on Mac
- ✅ CI/CD with GitHub Actions (no secrets needed)
- ✅ Free Apple ID device testing (7-day expiry)

**Quick start:**

```bash
cd flutter_admin_app

# Build for simulator
flutter build ios --simulator

# Or run directly
flutter run
```

**GitHub Actions (Unsigned):**

1. Go to **Actions** → **Build Flutter iOS Admin App**
2. Click **Run workflow**
3. Select **unsigned** build type
4. Download the .app artifact when complete

**No Apple Developer account or secrets needed!**

### 2. Production Builds (With Apple Account)

**Perfect for:** TestFlight, App Store distribution

**Requirements:** Apple Developer Program ($99/year)

**What you get:**
- ✅ TestFlight distribution
- ✅ App Store publishing
- ✅ Apps that don't expire
- ✅ Full capabilities

**Quick start:**

```bash
# Create and push a release tag (triggers signed build)
git tag flutter-v1.0.0
git push origin flutter-v1.0.0
```

This automatically:
1. Builds signed IPA with code signing
2. Uploads to TestFlight (if configured)
3. Creates a GitHub release

**Manual signed build:**

1. Go to **Actions** → **Build Flutter iOS Admin App**
2. Click **Run workflow**
3. Select **signed** build type
4. Choose whether to deploy to TestFlight
5. Click **Run workflow**

### Complete Setup Guide

For detailed instructions including:
- **Unsigned builds:** Simulator setup, free Apple ID testing
- **Signed builds:** Apple Developer account, Fastlane Match, code signing
- **GitHub Actions:** Both unsigned and signed workflows
- **Troubleshooting:** Common issues and solutions

**See the comprehensive guide:** [IOS_BUILD_SETUP.md](./IOS_BUILD_SETUP.md)

### Local Builds with Fastlane

**Unsigned (Development):**
```bash
cd ios
bundle install
bundle exec fastlane build_unsigned
```

**Signed (Production):**
```bash
cd ios
bundle install
bundle exec fastlane build_only    # Build only
bundle exec fastlane beta          # Upload to TestFlight
```

### Cost Summary

- **Development (Unsigned):** $0 - Get started for free!
- **Production (Signed):** $99/year Apple Developer Program

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
