import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/constants/firebase_constants.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/features/auth/screens/login_screen.dart';
import 'package:ssmart_pos_admin/features/dashboard/screens/dashboard_screen.dart';
import 'package:ssmart_pos_admin/services/auth_service.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

void main() async {
  // Ensure Flutter bindings are initialized
  WidgetsFlutterBinding.ensureInitialized();

  try {
    // Load environment variables
    await dotenv.load(fileName: '.env');

    // Initialize Firebase
    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: dotenv.env[FirebaseEnvKeys.apiKey]!,
        authDomain: dotenv.env[FirebaseEnvKeys.authDomain]!,
        databaseURL: dotenv.env[FirebaseEnvKeys.databaseUrl]!,
        projectId: dotenv.env[FirebaseEnvKeys.projectId]!,
        storageBucket: dotenv.env[FirebaseEnvKeys.storageBucket]!,
        messagingSenderId: dotenv.env[FirebaseEnvKeys.messagingSenderId]!,
        appId: dotenv.env[FirebaseEnvKeys.appId]!,
        measurementId: dotenv.env[FirebaseEnvKeys.measurementId],
      ),
    );

    print('✓ Firebase initialized successfully');
  } catch (e) {
    print('✗ Firebase initialization failed: $e');
    // Continue anyway - the app will show offline state
  }

  runApp(const SSMartPOSAdminApp());
}

class SSMartPOSAdminApp extends StatelessWidget {
  const SSMartPOSAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Firebase services
        Provider<FirebaseAuth>(
          create: (_) => FirebaseAuth.instance,
        ),
        Provider<FirebaseDatabase>(
          create: (_) => FirebaseDatabase.instance,
        ),

        // Auth service
        ProxyProvider<FirebaseAuth, AuthService>(
          update: (_, auth, __) => AuthService(auth),
        ),

        // Firebase service
        ProxyProvider<FirebaseDatabase, FirebaseService>(
          update: (_, database, __) => FirebaseService(database),
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
              stream: authService.authStateChanges,
              builder: (context, snapshot) {
                // Show loading while checking auth state
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const _SplashScreen();
                }

                // Navigate based on auth state
                final user = snapshot.data;
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
            const Icon(
              CupertinoIcons.chart_bar_square_fill,
              size: 100,
              color: AppTheme.primaryBlue,
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
