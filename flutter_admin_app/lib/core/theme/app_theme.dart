import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Sleek Monochrome Dark Theme for the POS Admin App
/// Matches the Electron POS application's modern visual system
class AppTheme {
  // Color Palette - Matches POS Desktop App
  static const Color primaryCyan = Color(0xFFE5E5E5); // Sleek Silver/White
  static const Color secondaryPurple = Color(0xFFA3A3A3); // Medium Slate Grey
  static const Color primaryTeal = Color(0xFF737373); // Muted Slate
  static const Color accentNeon = Color(0xFFFFFFFF);

  // Backward compatibility mappings for older theme references
  static const Color primaryBlue = Color(0xFFE5E5E5);
  static const Color secondaryBlue = Color(0xFFA3A3A3);
  static const Color darkBlue = Color(0xFF1C1C1E);

  static const Color successGreen = Color(0xFF34D399); // Emerald Green
  static const Color warningOrange = Color(0xFFF59E0B);
  static const Color errorRed = Color(0xFFEF4444);

  static const Color backgroundLight = Color(0xFF0A0A0A); // Deep #0A0A0A Dark Background
  static const Color cardBackground = Color(0xFF121212); // Dark Glassmorphism Panel
  static const Color surfaceDark = Color(0xFF1E1E1E); // Dark Modal & Dialog Surface
  static const Color borderColor = Color(0x1FFFFFFF); // 12% White Border

  static const Color textPrimary = Color(0xFFF5F5F5); // Off-White
  static const Color textSecondary = Color(0xFFA3A3A3); // Slate Gray
  static const Color textTertiary = Color(0x66FFFFFF); // 40% White

  // Text Styles using Google Fonts
  static TextStyle get displayLarge => GoogleFonts.inter(
    fontSize: 34,
    fontWeight: FontWeight.bold,
    color: textPrimary,
    letterSpacing: 0.4,
  );

  static TextStyle get headlineLarge => GoogleFonts.inter(
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: textPrimary,
  );

  static TextStyle get headlineMedium => GoogleFonts.inter(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static TextStyle get titleLarge => GoogleFonts.inter(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static TextStyle get titleMedium => GoogleFonts.inter(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static TextStyle get bodyLarge => GoogleFonts.inter(
    fontSize: 17,
    fontWeight: FontWeight.w400,
    color: textPrimary,
  );

  static TextStyle get bodyMedium => GoogleFonts.inter(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: textPrimary,
  );

  static TextStyle get bodySmall => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: textSecondary,
  );

  static TextStyle get labelLarge => GoogleFonts.inter(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static TextStyle get labelMedium => GoogleFonts.inter(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: textSecondary,
  );

  static TextStyle get labelSmall => GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: textTertiary,
  );

  // Return cyberDarkTheme for backward compatibility
  static ThemeData get lightTheme => cyberDarkTheme;

  // Main Cyber-Dark Neon Theme
  static ThemeData get cyberDarkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      primaryColor: primaryCyan,
      scaffoldBackgroundColor: backgroundLight,

      colorScheme: const ColorScheme.dark(
        primary: primaryCyan,
        secondary: secondaryPurple,
        error: errorRed,
        surface: cardBackground,
        onPrimary: Colors.black,
        onSecondary: Colors.white,
        onSurface: textPrimary,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: cardBackground,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: titleLarge,
        iconTheme: const IconThemeData(color: primaryCyan),
      ),

      cardTheme: CardThemeData(
        color: cardBackground,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: borderColor, width: 0.5),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),

      textTheme: TextTheme(
        displayLarge: displayLarge,
        headlineLarge: headlineLarge,
        headlineMedium: headlineMedium,
        titleLarge: titleLarge,
        titleMedium: titleMedium,
        bodyLarge: bodyLarge,
        bodyMedium: bodyMedium,
        bodySmall: bodySmall,
        labelLarge: labelLarge,
        labelMedium: labelMedium,
        labelSmall: labelSmall,
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryCyan,
          foregroundColor: Colors.black,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: labelLarge.copyWith(color: Colors.black),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cardBackground,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: primaryCyan, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: errorRed),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: bodyMedium.copyWith(color: textSecondary),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: backgroundLight,
        selectedColor: primaryCyan.withValues(alpha: 0.2),
        secondarySelectedColor: secondaryPurple.withValues(alpha: 0.2),
        labelStyle: bodyMedium.copyWith(color: textPrimary),
        secondaryLabelStyle: bodyMedium.copyWith(color: textPrimary),
        brightness: Brightness.dark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: borderColor, width: 0.5),
        ),
      ),
    );
  }

  // iOS Cupertino Theme
  static CupertinoThemeData get cupertinoTheme {
    return CupertinoThemeData(
      brightness: Brightness.dark,
      primaryColor: primaryCyan,
      scaffoldBackgroundColor: backgroundLight,
      barBackgroundColor: cardBackground,
      textTheme: CupertinoTextThemeData(
        primaryColor: textPrimary,
        textStyle: bodyMedium.copyWith(color: textPrimary),
        actionTextStyle: bodyMedium.copyWith(color: primaryCyan),
        navTitleTextStyle: titleLarge.copyWith(color: textPrimary),
        navLargeTitleTextStyle: displayLarge.copyWith(color: textPrimary),
      ),
    );
  }

  // Spacing constants
  static const double spacingXS = 4.0;
  static const double spacingS = 8.0;
  static const double spacingM = 16.0;
  static const double spacingL = 24.0;
  static const double spacingXL = 32.0;

  // Border radius
  static const double radiusS = 8.0;
  static const double radiusM = 12.0;
  static const double radiusL = 16.0;
}
