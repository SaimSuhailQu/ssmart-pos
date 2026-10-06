import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Noir Graphite theme — the "Option K (refined)" premium dashboard identity.
/// Pure monochrome: platinum on true black. No color at all — restraint as
/// the ultimate statement. Bold type does the talking: heavy serif numerals,
/// wide-tracked eyebrows, hairline rules.
///
/// Supersedes ExecutiveTheme (champagne gold on navy), removed 2026-10-05.
class GraphiteTheme {
  // --- Palette: true monochrome ---
  static const Color graphiteDeep = Color(0xFF0A0A0B); // screen background
  static const Color graphiteCard = Color(0xFF17171A); // hero gradient start
  static const Color graphiteCardEnd = Color(0xFF101012); // hero gradient end
  static const Color platinum = Color(0xFFEDEDEA); // primary accent
  static const Color platinumLight = Color(0xFFFFFFFF); // bright highlights
  static const Color platinumDeep = Color(0xFF8E8E93); // deep platinum shadows
  static const Color platinumFaint = Color(0x14EDEDEA); // ~8% platinum wash

  static const Color ink = Color(0xFFF5F5F4); // near-white text
  static const Color slate = Color(0xFF8E8E93); // secondary text
  static const Color slateDim = Color(0xFF6E6E72); // tertiary text

  static const Color cardSurface = Color(0x08FFFFFF); // ~3% white cards
  static const Color cardBorder = Color(0x14FFFFFF); // ~8% white borders
  static const Color cardBorderHi = Color(0x28FFFFFF); // ~16% white borders (highlight)
  static const Color platinumBorder = Color(0x21EDEDEA); // ~13% platinum border

  /// Functional-only colors. The theme itself is colorless; these exist solely
  /// for destructive/negative semantics (never decoration).
  static const Color errorRed = Color(0xFFF87171);

  // --- Hero gradient (revenue card) ---
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [graphiteCard, graphiteCardEnd],
  );

  // --- Text styles: bold is the brand ---
  /// Big bold serif revenue numeral — the signature graphite look.
  /// Explicit line height so Playfair's tall ascenders are never clipped by
  /// the line box on any device.
  static TextStyle get heroAmount => GoogleFonts.playfairDisplay(
        fontSize: 48,
        fontWeight: FontWeight.w800,
        color: platinumLight,
        letterSpacing: -1.0,
        height: 1.15,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle get heroCurrency => GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: slate,
        letterSpacing: 2.0,
      );

  /// Wide-tracked eyebrow over the hero numeral.
  static TextStyle get eyebrow => GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: slate,
        letterSpacing: 3.2,
      );

  /// Section label, always paired with a hairline rule (see sectionHeader).
  static TextStyle get sectionLabel => GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: slate,
        letterSpacing: 2.8,
      );

  static TextStyle get metricValue => GoogleFonts.inter(
        fontSize: 24,
        fontWeight: FontWeight.w800,
        color: ink,
        letterSpacing: -0.5,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle get metricLabel => GoogleFonts.inter(
        fontSize: 9,
        fontWeight: FontWeight.w700,
        color: slate,
        letterSpacing: 2.2,
      );

  static TextStyle get deltaUp => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: platinum,
      );

  static TextStyle get deltaDown => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: slateDim,
      );

  static TextStyle get bodyStrong => GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: ink,
        letterSpacing: 0.2,
      );

  static TextStyle get body => GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: ink,
      );

  static TextStyle get screenTitle => GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: ink,
        letterSpacing: -0.4,
      );

  static TextStyle get caption => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: slate,
      );

  static TextStyle get captionPlatinum => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: platinum,
        letterSpacing: 0.4,
      );

  static TextStyle get overlinePlatinum => GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: platinum,
        letterSpacing: 1.8,
      );

  static TextStyle get monoText => GoogleFonts.jetBrainsMono(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: slate,
      );

  // --- Screen ambience ---
  /// True-black screen base for graphite surfaces.
  static const Color screenBase = Color(0xFF070708);

  /// Ambient platinum aura stops for background meshes (top glow).
  static List<Color> get auraTop => [
        platinum.withValues(alpha: 0.07),
        platinumDeep.withValues(alpha: 0.04),
        Colors.transparent,
      ];

  /// Ambient platinum aura stops for background meshes (bottom glow).
  static List<Color> get auraBottom => [
        platinumDeep.withValues(alpha: 0.05),
        Colors.transparent,
      ];

  // --- Components ---
  /// Hairline platinum divider (gradient fading at both ends).
  static BoxDecoration get platinumDivider => BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.transparent,
            platinum.withValues(alpha: 0.35),
            Colors.transparent,
          ],
        ),
      );

  /// Section header: bold tracked label with a hairline rule running off it.
  static Widget sectionHeader(String label, {Widget? trailing}) {
    return Row(
      children: [
        Text(label.toUpperCase(), style: GraphiteTheme.sectionLabel),
        const SizedBox(width: 12),
        Expanded(
          child: Container(height: 1, color: platinum.withValues(alpha: 0.1)),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 12),
          trailing,
        ],
      ],
    );
  }

  /// Outlined platinum pill (chips, filters, payment badges).
  static BoxDecoration pillDecoration({bool filled = false}) =>
      BoxDecoration(
        color: filled ? platinum : platinumFaint,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: platinum.withValues(alpha: filled ? 0.0 : 0.45),
        ),
      );

  static TextStyle pillText({bool filled = false}) =>
      GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: filled ? graphiteDeep : platinumLight,
        letterSpacing: 0.3,
      );

  /// Platinum glow shadow for primary buttons / FAB.
  static List<BoxShadow> get platinumGlow => [
        BoxShadow(
          color: platinum.withValues(alpha: 0.22),
          blurRadius: 20,
          offset: const Offset(0, 6),
        ),
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.5),
          blurRadius: 14,
          offset: const Offset(0, 4),
        ),
      ];

  /// Shimmer sweep gradient for loading states.
  static LinearGradient get shimmerGradient => LinearGradient(
        colors: [
          cardSurface,
          platinum.withValues(alpha: 0.1),
          cardSurface,
        ],
        stops: const [0.35, 0.5, 0.65],
      );

  // --- Shared decorations ---
  static BoxDecoration get cardDecoration => BoxDecoration(
        color: cardSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: cardBorder, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: platinum.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 1),
          ),
        ],
      );

  /// Signature hero card: dark gradient, platinum hairline, top highlight.
  static BoxDecoration get platinumCardDecoration => BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: heroGradient,
        border: Border.all(color: platinumBorder, width: 1),
        boxShadow: [
          BoxShadow(
            color: platinum.withValues(alpha: 0.08),
            blurRadius: 28,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      );

  /// Elevated card with directional specular sheen highlight on the top edge.
  static BoxDecoration specularCardDecoration({double borderRadius = 18}) => BoxDecoration(
        color: cardSurface,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: cardBorder, width: 1),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF1E2129),
            Color(0xFF13151A),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 18,
            offset: const Offset(0, 5),
          ),
          BoxShadow(
            color: platinum.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 1),
          ),
        ],
      );

  /// Top hairline highlight widget to overlay inside cards for specular bevel look.
  static Widget get cardSpecularHighlight => Container(
        height: 1,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Colors.transparent,
              platinum.withValues(alpha: 0.35),
              Colors.transparent,
            ],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
      );

  /// Primary action button: platinum gradient, black text.
  static BoxDecoration get primaryButtonDecoration => BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [platinumLight, Color(0xFFD9D9DC)],
        ),
        boxShadow: platinumGlow,
      );

  static TextStyle get primaryButtonText => GoogleFonts.inter(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        color: graphiteDeep,
        letterSpacing: 0.3,
      );
}
