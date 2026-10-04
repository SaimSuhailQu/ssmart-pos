import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';

/// Executive Dark theme — the "Option A" premium dashboard identity.
/// Deep navy surfaces, champagne-gold accents, serif display numerals.
/// Lives alongside AppTheme; the rest of the app keeps its cyber-dark look
/// while the dashboard gets the executive treatment.
class ExecutiveTheme {
  // --- Palette ---
  static const Color navyDeep = Color(0xFF0A0E1A); // screen background
  static const Color navyCard = Color(0xFF141B31); // hero gradient start
  static const Color navyCardEnd = Color(0xFF2A2140); // hero gradient end
  static const Color gold = Color(0xFFC9A96A); // champagne gold (primary accent)
  static const Color goldLight = Color(0xFFE8C87A); // bright gold highlights
  static const Color goldDeep = Color(0xFF8A6D3B); // deep gold shadows
  static const Color goldFaint = Color(0x24C9A96A); // 14% gold wash

  static const Color ink = Color(0xFFF5F1E6); // warm off-white text
  static const Color slate = Color(0xFF9AA3B8); // secondary text
  static const Color slateDim = Color(0xFF5B6376); // tertiary text

  static const Color cardSurface = Color(0x0BFFFFFF); // ~4% white cards
  static const Color cardBorder = Color(0x14FFFFFF); // ~8% white borders
  static const Color goldBorder = Color(0x47C9A96A); // 28% gold borders

  static const Color successMint = Color(0xFF7EE2A8);
  static const Color warnAmber = Color(0xFFFBBF24);

  // --- Hero gradient (revenue card) ---
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [navyCard, Color(0xFF1D2542), navyCardEnd],
  );

  // --- Text styles ---
  /// Big serif revenue numeral — the signature executive look.
  static TextStyle get heroAmount => GoogleFonts.playfairDisplay(
        fontSize: 44,
        fontWeight: FontWeight.w700,
        color: ink,
        letterSpacing: -0.5,
      );

  static TextStyle get heroCurrency => GoogleFonts.playfairDisplay(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: gold,
      );

  static TextStyle get eyebrow => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: gold,
        letterSpacing: 2.2,
      );

  static TextStyle get sectionLabel => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: slate,
        letterSpacing: 1.6,
      );

  static TextStyle get metricValue => GoogleFonts.inter(
        fontSize: 21,
        fontWeight: FontWeight.w800,
        color: ink,
        letterSpacing: -0.3,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle get metricLabel => GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        color: slate,
        letterSpacing: 0.8,
      );

  static TextStyle get deltaUp => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: successMint,
      );

  static TextStyle get bodyGold => GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: ink,
      );

  // --- Shared decorations ---
  static BoxDecoration get cardDecoration => BoxDecoration(
        color: cardSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: cardBorder, width: 1),
      );

  static BoxDecoration get goldCardDecoration => BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: heroGradient,
        border: Border.all(color: goldBorder, width: 1),
        boxShadow: [
          BoxShadow(
            color: gold.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      );
}
