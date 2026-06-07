# Quick Reference Card

## 🚀 Essential Commands

```bash
# Setup
flutter pub get                    # Install dependencies
cp .env.example .env              # Create environment file
flutter doctor                     # Check Flutter setup

# Run
flutter run                        # Run in debug mode
flutter run --release             # Run in release mode
flutter run -d <device>           # Run on specific device

# Build
flutter build ios --release       # Build for iOS release
flutter clean                      # Clean build artifacts

# Development
flutter format lib/               # Format code
flutter analyze                    # Analyze code
flutter test                       # Run tests

# Devices
flutter devices                    # List available devices
flutter emulators                  # List available emulators
```

## 📁 Key File Locations

### Configuration
- Firebase config: `.env`
- Dependencies: `pubspec.yaml`
- Linter rules: `analysis_options.yaml`

### Entry Point
- App start: `lib/main.dart`

### Core Services
- Firebase DB: `lib/services/firebase_service.dart`
- Authentication: `lib/services/auth_service.dart`

### Main Screens
- Login: `lib/features/auth/screens/login_screen.dart`
- Dashboard: `lib/features/dashboard/screens/dashboard_screen.dart`
- Transactions: `lib/features/transactions/screens/transactions_screen.dart`

### Models
- Sales: `lib/models/sale.dart`
- Metrics: `lib/models/dashboard_metrics.dart`

### Theme
- Styling: `lib/core/theme/app_theme.dart`

## 🔥 Firebase Paths

```
Database Structure:
sales/
  └── {saleId}/
      ├── id
      ├── total
      ├── timestamp
      ├── payment_method
      └── items[]
```

## 🎨 Customization Quick Edit

### Change Colors
File: `lib/core/theme/app_theme.dart`
```dart
static const Color primaryBlue = Color(0xFF007AFF);  // Change this
```

### Change Currency
File: `lib/core/constants/firebase_constants.dart`
```dart
static const String currencySymbol = 'PKR';  // Change this
```

### Change App Name
File: `lib/main.dart`
```dart
title: 'SSmart POS Admin',  // Change this
```

## 🐛 Troubleshooting Quick Fixes

### Firebase Error
```bash
# 1. Check .env file exists
ls -la .env

# 2. Verify credentials
cat .env

# 3. Reinstall
flutter clean
flutter pub get
```

### Build Error
```bash
flutter clean
rm -rf ios/Pods
rm ios/Podfile.lock
cd ios && pod install --repo-update
cd .. && flutter run
```

### Login Fails
1. Check Firebase Console → Authentication
2. Verify user exists
3. Check database rules allow reads

## 📊 Data Flow Diagram

```
Electron POS → Firebase Realtime DB → Flutter Admin App
     ↓               ↓                      ↓
  SQLite        sales/{id}            StreamBuilder
     ↓               ↓                      ↓
sync every 15s   Real-time            UI Updates
```

## 🔐 Security Checklist

- [ ] `.env` file created (not committed)
- [ ] Firebase rules require auth
- [ ] Admin user created in Firebase
- [ ] Strong password used
- [ ] Database rules tested

## 📱 Test Checklist

- [ ] App launches without errors
- [ ] Login works with correct credentials
- [ ] Dashboard shows metrics
- [ ] Real-time updates work
- [ ] Transactions searchable
- [ ] Charts display correctly
- [ ] Offline mode shows cached data
- [ ] Logout works properly

## 🎯 Feature Status

| Feature | Status | Location |
|---------|--------|----------|
| Authentication | ✅ Complete | `features/auth/` |
| Dashboard | ✅ Complete | `features/dashboard/` |
| Transactions | ✅ Complete | `features/transactions/` |
| Real-time Sync | ✅ Complete | `services/firebase_service.dart` |
| Charts | ✅ Complete | `widgets/sales_chart.dart` |
| Search/Filter | ✅ Complete | `transactions_screen.dart` |
| Inventory | ⏳ Future | TODO in code |
| Sessions | ⏳ Future | TODO in code |

## 🔗 Important Links

- [Flutter Docs](https://flutter.dev/docs)
- [Firebase Console](https://console.firebase.google.com)
- [Provider Docs](https://pub.dev/packages/provider)
- [fl_chart Examples](https://pub.dev/packages/fl_chart)

## 💾 Environment Variables

Required in `.env`:
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_DATABASE_URL
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

## 📈 Performance Tips

1. **Caching**: Data cached for 5 minutes
2. **Pagination**: Implemented in service (not UI yet)
3. **Const Widgets**: Used throughout
4. **Lazy Loading**: Only recent transactions loaded

## 🚨 Common Errors & Solutions

| Error | Solution |
|-------|----------|
| "No such file: .env" | Run `cp .env.example .env` |
| "Firebase init failed" | Check .env credentials |
| "Permission denied" | Check Firebase rules |
| "No data showing" | Verify POS is syncing |
| "Build failed" | Run `flutter clean` |

## 📞 Quick Support Flow

1. **Check**: Error message carefully
2. **Verify**: Firebase Console has data
3. **Review**: Relevant documentation file
4. **Test**: Connection with `flutter doctor`
5. **Clean**: Run `flutter clean` if needed

## 🎓 Learning Path

1. Read: `README.md` (overview)
2. Follow: `SETUP_GUIDE.md` (setup)
3. Study: `ARCHITECTURE.md` (structure)
4. Deep Dive: `FIREBASE_INTEGRATION.md` (Firebase)
5. Reference: This file (quick help)

---

**Keep this file handy for quick reference!**
