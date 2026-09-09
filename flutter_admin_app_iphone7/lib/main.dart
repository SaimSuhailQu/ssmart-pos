import 'package:firebase_core/firebase_core.dart' hide FirebaseService;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/app_error_widget.dart';
import 'package:ssmart_pos_admin/features/auth/screens/login_screen.dart';
import 'package:ssmart_pos_admin/features/dashboard/screens/dashboard_screen.dart';
import 'package:ssmart_pos_admin/services/auth_service.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

void main() async {
  // Ensure Flutter bindings are initialized
  WidgetsFlutterBinding.ensureInitialized();

  // Bulletproof custom ErrorWidget builder so uncaught widget errors never produce a blank grey screen
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return Material(
      color: const Color(0xFF0B0C10),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Color(0xFFEF4444),
                    size: 56,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Application Encountered an Error',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    details.exceptionAsString(),
                    style: const TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 13,
                      fontFamily: 'monospace',
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  };

  try {
    // Load environment variables safely if present
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      print('Notice: .env file not bundled, using project default configuration.');
    }

    // Safely extract keys without throwing if dotenv failed to load
    String? getEnv(String key) {
      if (dotenv.isInitialized) {
        return dotenv.maybeGet(key);
      }
      return null;
    }

    final apiKey = getEnv(FirebaseEnvKeys.apiKey) ?? FirebaseDefaultConfig.apiKey;
    final authDomain = getEnv(FirebaseEnvKeys.authDomain) ?? FirebaseDefaultConfig.authDomain;
    final databaseUrl = getEnv(FirebaseEnvKeys.databaseUrl) ?? FirebaseDefaultConfig.databaseUrl;
    final projectId = getEnv(FirebaseEnvKeys.projectId) ?? FirebaseDefaultConfig.projectId;
    final storageBucket = getEnv(FirebaseEnvKeys.storageBucket) ?? FirebaseDefaultConfig.storageBucket;
    final messagingSenderId = getEnv(FirebaseEnvKeys.messagingSenderId) ?? FirebaseDefaultConfig.messagingSenderId;
    final appId = getEnv(FirebaseEnvKeys.appId) ?? FirebaseDefaultConfig.appId;
    final measurementId = getEnv(FirebaseEnvKeys.measurementId) ?? FirebaseDefaultConfig.measurementId;

    // Initialize Firebase
    // On iOS/macOS with GoogleService-Info.plist in the bundle, Firebase.initializeApp() without options
    // reads directly from the native plist with full bundle ID validation.
    // Otherwise, we supply the options explicitly (with iosBundleId included for iOS fallback).
    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        try {
          await Firebase.initializeApp();
        } catch (iosInitErr) {
          print('Native plist init notice: $iosInitErr. Falling back to explicit options...');
          await Firebase.initializeApp(
            options: FirebaseOptions(
              apiKey: apiKey,
              authDomain: authDomain,
              databaseURL: databaseUrl,
              projectId: projectId,
              storageBucket: storageBucket,
              messagingSenderId: messagingSenderId,
              appId: appId,
              measurementId: measurementId,
              iosBundleId: 'com.ssmart.pos.admin',
            ),
          );
        }
      } else {
        await Firebase.initializeApp(
          options: FirebaseOptions(
            apiKey: apiKey,
            authDomain: authDomain,
            databaseURL: databaseUrl,
            projectId: projectId,
            storageBucket: storageBucket,
            messagingSenderId: messagingSenderId,
            appId: appId,
            measurementId: measurementId,
          ),
        );
      }

      // Enable Offline Disk Persistence (100MB Cache for offline CRUD & browsing)
      try {
        FirebaseDatabase.instance.setPersistenceEnabled(true);
        FirebaseDatabase.instance.setPersistenceCacheSizeBytes(100000000); // 100MB
        print('✓ Firebase offline local disk persistence enabled');
      } catch (e) {
        print('Firebase persistence notice: $e');
      }

      print('✓ Firebase initialized successfully');
      isFirebaseReady = true;
    } catch (e, stack) {
      print('✗ Firebase initialization failed: $e\n$stack');
      initError = e.toString();
    }
  } catch (e) {
    print('✗ Unexpected setup error: $e');
    initError = e.toString();
  }

  runApp(SSMartPOSAdminApp(
    isFirebaseReady: isFirebaseReady,
    initError: initError,
  ),);
}

bool isFirebaseReady = false;
String? initError;

class SSMartPOSAdminApp extends StatelessWidget {
  final bool isFirebaseReady;
  final String? initError;

  const SSMartPOSAdminApp({
    super.key,
    this.isFirebaseReady = true,
    this.initError,
  });

  @override
  Widget build(BuildContext context) {
    // If Firebase failed to initialize, show clean error & retry screen instead of crashing into [core/no app]
    if (!isFirebaseReady) {
      return MaterialApp(
        title: 'SSmart POS Admin',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: Scaffold(
          backgroundColor: const Color(0xFF0B0C10),
          body: AppErrorWidget(
            message: 'Firebase Connection Error',
            error: initError ?? 'Failed to initialize Firebase services. Please check network and configuration.',
            onRetry: () {
              main();
            },
          ),
        ),
      );
    }

    return MultiProvider(
      providers: [
        // Firebase services
        Provider<FirebaseAuth>(
          create: (_) => FirebaseAuth.instance,
        ),
        Provider<FirebaseDatabase>(
          create: (_) => FirebaseDatabase.instance,
        ),

        // Auth service (created once)
        Provider<AuthService>(
          create: (context) => AuthService(context.read<FirebaseAuth>()),
        ),

        // Firebase service (created once, maintains persistent connection & stream listeners)
        Provider<FirebaseService>(
          create: (context) => FirebaseService(context.read<FirebaseDatabase>()),
          dispose: (_, service) => service.dispose(),
        ),
      ],
      child: MaterialApp(
        title: 'SSmart POS Admin',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,

        // Use authentication state to determine initial route
        home: Consumer<AuthService>(
          builder: (context, authService, _) {
            return StreamBuilder<User?>(
              initialData: authService.currentUser,
              stream: authService.authStateChanges,
              builder: (context, snapshot) {
                // If stream encountered an error, fail safely to LoginScreen
                if (snapshot.hasError) {
                  return const LoginScreen();
                }

                // Show loading only when initially waiting and no cached/current user is known
                if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData && authService.currentUser == null) {
                  return const _SplashScreen();
                }

                // Navigate based on auth state
                final user = snapshot.data ?? authService.currentUser;
                if (user != null) {
                  return const DashboardScreen();
                } else {
                  return const LoginScreen();
                }
              },
            );
          },
        ),
      ),
    );
  }
}

/// Splash screen shown while checking authentication state
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo
            ClipRRect(
              borderRadius: BorderRadius.circular(AppTheme.radiusL),
              child: Image.asset(
                'assets/images/ss_mart_logo.png',
                height: 100,
                width: 100,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => const Icon(
                  CupertinoIcons.chart_bar_square_fill,
                  size: 100,
                  color: AppTheme.primaryBlue,
                ),
              ),
            ),
            const SizedBox(height: AppTheme.spacingL),

            // App name
            Text(
              'SSmart POS Admin',
              style: AppTheme.displayLarge,
            ),
            const SizedBox(height: AppTheme.spacingS),

            // Subtitle
            Text(
              'Sales Monitoring Dashboard',
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: AppTheme.spacingXL * 2),

            // Loading indicator
            const SizedBox(
              width: 40,
              height: 40,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryBlue),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
