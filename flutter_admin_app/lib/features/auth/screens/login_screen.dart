import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/glass_card.dart';
import 'package:ssmart_pos_admin/core/widgets/liquid_scaffold.dart';
import 'package:ssmart_pos_admin/services/auth_service.dart';

/// Login screen with email/password and Google (owner master) authentication
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  bool _googleLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Handle login button press
  Future<void> _handleLogin() async {
    // Clear previous error
    setState(() {
      _errorMessage = null;
    });

    // Validate form
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Show loading
    setState(() {
      _isLoading = true;
    });

    try {
      final authService = context.read<AuthService>();
      await authService.signInWithEmailAndPassword(
        email: _emailController.text,
        password: _passwordController.text,
      );

      // Navigation is handled by auth state listener in main.dart
    } on AuthException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'An unexpected error occurred. Please try again.';
        _isLoading = false;
      });
    }
  }

  /// Handle Google sign-in button press (owner / master account).
  Future<void> _handleGoogleSignIn() async {
    if (_isLoading || _googleLoading) return;
    setState(() {
      _errorMessage = null;
      _googleLoading = true;
    });

    try {
      final authService = context.read<AuthService>();
      await authService.signInWithGoogle();

      // Navigation is handled by auth state listener in main.dart
    } on AuthException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _googleLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Google sign-in failed. Please try again.';
        _googleLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return LiquidScaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppTheme.spacingL),
            child: GlassCard(
              material: LiquidMaterial.thick,
              padding: const EdgeInsets.all(AppTheme.spacingL),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo or App Icon
                    Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppTheme.radiusL),
                        child: Image.asset(
                          'assets/images/ss_mart_logo.png',
                          height: 90,
                          width: 90,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              const Icon(
                            CupertinoIcons.chart_bar_square_fill,
                            size: 80,
                            color: AppTheme.primaryBlue,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingL),

                    // Title
                    Text(
                      'SS MART Admin',
                      style: AppTheme.displayLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppTheme.spacingS),

                    // Subtitle
                    Text(
                      'Sales Monitoring Dashboard',
                      style: AppTheme.bodyMedium.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppTheme.spacingXL * 2),

                    // Error message
                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(AppTheme.spacingM),
                        decoration: BoxDecoration(
                          color: AppTheme.errorRed.withValues(alpha: 0.1),
                          borderRadius:
                              BorderRadius.circular(AppTheme.radiusM),
                          border: Border.all(
                            color: AppTheme.errorRed.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              CupertinoIcons.exclamationmark_circle_fill,
                              color: AppTheme.errorRed,
                              size: 20,
                            ),
                            const SizedBox(width: AppTheme.spacingS),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: AppTheme.bodyMedium.copyWith(
                                  color: AppTheme.errorRed,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacingL),
                    ],

                    // Email field
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      enabled: !_isLoading && !_googleLoading,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'admin@example.com',
                        prefixIcon: Icon(CupertinoIcons.mail),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your email';
                        }
                        if (!value.contains('@')) {
                          return 'Please enter a valid email';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppTheme.spacingM),

                    // Password field
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      textInputAction: TextInputAction.done,
                      enabled: !_isLoading && !_googleLoading,
                      onFieldSubmitted: (_) => _handleLogin(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        hintText: 'Enter your password',
                        prefixIcon: const Icon(CupertinoIcons.lock),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? CupertinoIcons.eye
                                : CupertinoIcons.eye_slash,
                          ),
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                        ),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Please enter your password';
                        }
                        if (value.length < 6) {
                          return 'Password must be at least 6 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppTheme.spacingXL),

                    // Frosted Liquid Glass Sign In Button
                    GlassCard(
                      onTap: _isLoading ? null : _handleLogin,
                      material: LiquidMaterial.thin,
                      borderRadius: AppTheme.radiusM,
                      enableGlow: true,
                      glowColor: AppTheme.primaryCyan,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFFFFFFFF),
                          Color(0xFFE2E8F0),
                        ],
                      ),
                      child: Center(
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.black,
                                  ),
                                ),
                              )
                            : const Text(
                                'Sign In',
                                style: TextStyle(
                                  color: Colors.black,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  letterSpacing: 0.3,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingL),

                    // OR divider
                    Row(
                      children: [
                        const Expanded(
                          child: Divider(color: AppTheme.borderColor),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppTheme.spacingM,
                          ),
                          child: Text(
                            'OR',
                            style: AppTheme.labelSmall.copyWith(
                              color: AppTheme.textTertiary,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ),
                        const Expanded(
                          child: Divider(color: AppTheme.borderColor),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppTheme.spacingL),

                    // Google Sign-In (owner master account)
                    GestureDetector(
                      onTap: _googleLoading ? null : _handleGoogleSignIn,
                      child: Container(
                        height: 50,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(AppTheme.radiusM),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Center(
                          child: _googleLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Official Google "G" mark
                                    SizedBox(
                                      width: 20,
                                      height: 20,
                                      child:
                                          CustomPaint(painter: _GoogleGPainter()),
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      'Sign in with Google',
                                      style: AppTheme.labelLarge.copyWith(
                                        color: const Color(0xFF1F1F1F),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppTheme.spacingL),

                    // Additional info
                    Text(
                      'Owner master access · Secure admin sign-in',
                      style: AppTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Paints the official four-colour Google "G" logo.
class _GoogleGPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final stroke = size.width * 0.24;
    final rect = Rect.fromCircle(center: center, radius: size.width / 2);

    final blue = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = const Color(0xFF4285F4)
      ..strokeCap = StrokeCap.butt;
    final green = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = const Color(0xFF34A853)
      ..strokeCap = StrokeCap.butt;
    final yellow = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = const Color(0xFFFBBC05)
      ..strokeCap = StrokeCap.butt;
    final red = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = const Color(0xFFEA4335)
      ..strokeCap = StrokeCap.butt;

    // Blue arc: from ~top (270°) counter-clockwise down to 180° (left).
    canvas.drawArc(rect, math.pi * 0.92, math.pi * 1.08, false, blue);
    // Green arc: 180° → 270° (bottom-left quadrant).
    canvas.drawArc(rect, math.pi, math.pi * 0.5, false, green);
    // Yellow arc: 270° → ~338° (bottom-right, stopping before the bar).
    canvas.drawArc(rect, math.pi * 1.5, math.pi * 0.48, false, yellow);

    // Red arc: 338° → 360°/0° and the horizontal bar to the right of centre.
    final redPath = Path()
      ..addArc(rect, -math.pi * 0.02, math.pi * 0.02)
      ..moveTo(center.dx + stroke / 2, center.dy - stroke / 2)
      ..lineTo(size.width - stroke / 2, center.dy - stroke / 2)
      ..lineTo(size.width - stroke / 2, center.dy + stroke / 2)
      ..lineTo(center.dx + stroke / 2, center.dy + stroke / 2)
      ..close();
    canvas.drawPath(redPath, red);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
