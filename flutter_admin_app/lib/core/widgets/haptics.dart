import 'package:flutter/services.dart';

/// Central haptic vocabulary for the app. Every touchable surface should
/// speak through these so feedback feels consistent and intentional.
///
///  - tap      : light tick for ordinary taps (cards, rows, chips)
///  - medium   : primary actions (New Bill, Copy Note, confirmations)
///  - heavy    : destructive / kill-switch moments
///  - select   : chart scrubbing, segmented controls, toggles
///  - success  : completed flows (copied, saved, synced)
class Haptics {
  Haptics._();

  static Future<void> tap() => HapticFeedback.lightImpact();
  static Future<void> medium() => HapticFeedback.mediumImpact();
  static Future<void> heavy() => HapticFeedback.heavyImpact();
  static Future<void> select() => HapticFeedback.selectionClick();

  /// A tiny "done" flourish: medium knock followed by a light tick.
  static Future<void> success() async {
    await HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(milliseconds: 60));
    await HapticFeedback.lightImpact();
  }
}
