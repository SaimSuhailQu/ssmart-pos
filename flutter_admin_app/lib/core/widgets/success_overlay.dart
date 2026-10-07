import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';

/// Shows a brief full-screen success flourish: a springy checkmark in a
/// graphite card that auto-dismisses. Fires [Haptics.success].
///
/// Use after completed flows — khata entry saved, expense added, bill paid —
/// instead of (or alongside) a snackbar.
///
/// Example:
/// ```dart
/// await FirebaseService.saveEntry(...);
/// if (!context.mounted) return;
/// showSuccessOverlay(context, message: 'Entry saved');
/// ```
Future<void> showSuccessOverlay(BuildContext context, {String message = 'Saved'}) {
  Haptics.success();
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Success',
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 280),
    pageBuilder: (ctx, _, __) => _SuccessOverlay(message: message),
    transitionBuilder: (ctx, animation, __, child) {
      final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutBack);
      return ScaleTransition(
        scale: Tween<double>(begin: 0.7, end: 1.0).animate(curved),
        child: FadeTransition(opacity: animation, child: child),
      );
    },
  );
}

class _SuccessOverlay extends StatefulWidget {
  final String message;

  const _SuccessOverlay({required this.message});

  @override
  State<_SuccessOverlay> createState() => _SuccessOverlayState();
}

class _SuccessOverlayState extends State<_SuccessOverlay> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) Navigator.of(context).maybePop();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 28),
          decoration: BoxDecoration(
            color: AppTheme.surfaceDark,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: GraphiteTheme.cardBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 32,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 450),
                curve: Curves.easeOutBack,
                builder: (context, value, child) {
                  return Transform.scale(
                    scale: value,
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.successGreen.withValues(alpha: 0.15),
                        border: Border.all(
                          color: AppTheme.successGreen,
                          width: 2.5,
                        ),
                      ),
                      child: Icon(
                        CupertinoIcons.check_mark,
                        color: AppTheme.successGreen,
                        size: 32 * value.clamp(0.01, 1.0),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
              Text(
                widget.message,
                style: GraphiteTheme.bodyStrong.copyWith(fontSize: 17),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
