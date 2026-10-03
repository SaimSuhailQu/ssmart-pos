import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/licensing/license_state.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/features/licensing/screens/license_manager_screen.dart';
import 'package:ssmart_pos_admin/widgets/license_gate.dart';

/// In-flow license banner for the dashboard.
///
/// Renders at the top of the scroll content (never as a floating overlay),
/// so it can never collide with the FAB or cover dashboard cards.
///  - **trial** → amber banner with days remaining; tap opens the license manager.
///  - **grace** → red banner urging activation before lockout.
///  - **licensed / checking** → renders nothing; the dashboard stays clean.
class LicenseBanner extends StatelessWidget {
  const LicenseBanner({super.key});

  String _tierLabel(LicenseTier tier) {
    switch (tier) {
      case LicenseTier.standard:
        return 'Standard';
      case LicenseTier.enterprise:
        return 'Enterprise';
      case LicenseTier.trial:
        return 'Trial';
    }
  }

  @override
  Widget build(BuildContext context) {
    final license = MobileLicenseGate.of(context);
    if (license == null || license.status == LicenseStatus.licensed) {
      return const SizedBox.shrink();
    }

    final inGrace = license.inGrace;
    final accent = inGrace ? AppTheme.errorRed : AppTheme.warningOrange;
    final days = license.daysRemaining ?? 0;
    final dayWord = days == 1 ? 'day' : 'days';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppTheme.spacingM,
        AppTheme.spacingS,
        AppTheme.spacingM,
        0,
      ),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            CupertinoPageRoute(
              builder: (_) => const LicenseManagerScreen(),
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(AppTheme.radiusM),
            border: Border.all(color: accent.withValues(alpha: 0.35)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  inGrace
                      ? CupertinoIcons.exclamationmark_triangle_fill
                      : CupertinoIcons.lock_shield_fill,
                  size: 15,
                  color: accent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      inGrace ? 'Trial expired' : 'Free Trial',
                      style: AppTheme.labelLarge.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      inGrace
                          ? 'Activate within $days $dayWord to avoid lockout'
                          : '$days $dayWord remaining · ${_tierLabel(license.tier)} · Tap to activate',
                      style: AppTheme.labelSmall.copyWith(
                        color: AppTheme.textSecondary,
                        fontSize: 11,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Icon(
                CupertinoIcons.chevron_right,
                size: 14,
                color: accent.withValues(alpha: 0.8),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
