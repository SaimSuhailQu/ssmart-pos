import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Sleek Monochrome Dark Theme for the POS Admin App
/// Matches the Electron POS application's modern visual system
class AppTheme {
  // Color Palette — Noir Graphite & Platinum system
  static const Color primaryCyan = Color(0xFFEDEDEA); // Platinum (matches GraphiteTheme.platinum)
  static const Color secondaryPurple = Color(0xFF8E8E93); // Slate Deep
  static const Color primaryTeal = Color(0xFFEDEDEA); // Platinum
  static const Color accentNeon = Color(0xFFFFFFFF);

  // Backward compatibility mappings for older theme references
  static const Color primaryBlue = Color(0xFFEDEDEA);
  static const Color secondaryBlue = Color(0xFF8E8E93);
  static const Color darkBlue = Color(0xFF17171A);

  static const Color successGreen = Color(0xFF10B981); // Emerald accent for cash/paid
  static const Color warningOrange = Color(0xFFF59E0B); // Amber for warnings/due
  static const Color errorRed = Color(0xFFF87171); // Functional red (matches GraphiteTheme.errorRed)

  static const Color backgroundLight = Color(0xFF070708); // Noir Screen Base
  static const Color cardBackground = Color(0xFF121215); // Noir Card Surface
  static const Color glassSurface = Color(0x08FFFFFF); // ~3% White glass
  static const Color glassSurfaceLight = Color(0x14EDEDEA); // ~8% Platinum wash
  static const Color surfaceDark = Color(0xFF151518); // Modal & Dialog Surface
  static const Color borderColor = Color(0x14FFFFFF); // ~8% White border
  static const Color borderHighlight = Color(0x21EDEDEA); // Hairline Platinum
  static const Color glassBorder = Color(0x14FFFFFF); // Frosted border

  static const Color textPrimary = Color(0xFFF5F5F4); // Crisp Platinum/Ink
  static const Color textSecondary = Color(0xFF8E8E93); // Balanced Slate
  static const Color textTertiary = Color(0xFF6E6E72); // Tertiary Slate Dim

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
    fontWeight: FontWeight.w700,
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
        onSecondary: Colors.black,
        onSurface: textPrimary,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: backgroundLight,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: titleLarge,
        iconTheme: const IconThemeData(color: primaryCyan),
      ),

      tabBarTheme: TabBarThemeData(
        indicatorColor: primaryCyan,
        labelColor: primaryCyan,
        unselectedLabelColor: textSecondary,
        dividerColor: borderColor,
        labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13),
        unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w500, fontSize: 13),
      ),

      cardTheme: CardThemeData(
        color: cardBackground,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderColor, width: 1),
        ),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: surfaceDark,
        contentTextStyle: bodyMedium.copyWith(color: textPrimary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: borderColor),
        ),
        elevation: 6,
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: surfaceDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        titleTextStyle: titleLarge,
        contentTextStyle: bodyMedium,
      ),

      dividerTheme: const DividerThemeData(
        color: borderColor,
        thickness: 0.5,
        space: 1,
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: primaryCyan,
        linearTrackColor: borderColor,
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
          borderRadius: BorderRadius.circular(20),
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
