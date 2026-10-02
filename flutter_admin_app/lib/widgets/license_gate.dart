import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/services/license_service.dart';

/// Mobile license gate — mirrors the desktop `LicenseGate.tsx`.
///
/// Wraps the authenticated app:
///  - **licensed** → shows the child with a subtle green badge.
///  - **trial** → shows the child with an amber trial-remaining banner.
///  - **expired/revoked** → blocks the app with device code + recheck button.
class MobileLicenseGate extends StatefulWidget {
  final Widget child;
  final LicenseService licenseService;

  const MobileLicenseGate({
    super.key,
    required this.child,
    required this.licenseService,
  });

  @override
  State<MobileLicenseGate> createState() => _MobileLicenseGateState();
}

class _MobileLicenseGateState extends State<MobileLicenseGate> {
  LicenseState? _license;
  bool _checking = true;
  bool _copied = false;

  @override
  void initState() {
    super.initState();
    _checkLicense();
  }

  Future<void> _checkLicense() async {
    setState(() => _checking = true);
    try {
      final state = await widget.licenseService.checkLicense();
      if (mounted) {
        setState(() {
          _license = state;
          _checking = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _copyFingerprint() async {
    final fp = _license?.fingerprint ?? '';
    if (fp.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: fp));
    setState(() => _copied = true);
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    // ---- Loading ---- //
    if (_checking && _license == null) {
      return Scaffold(
        backgroundColor: AppTheme.backgroundLight,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CupertinoActivityIndicator(radius: 16),
              const SizedBox(height: 16),
              Text(
                'VERIFYING LICENSE…',
                style: AppTheme.labelSmall.copyWith(
                  letterSpacing: 2,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final license = _license;

    // ---- Expired / Revoked — block the app ---- //
    if (license == null || license.status == LicenseStatus.expired) {
      final reason = license?.error == 'license_revoked'
          ? 'This license has been deactivated by the vendor.'
          : license?.error == 'subscription_expired'
              ? 'The subscription period for this license has ended.'
              : 'Your free trial period has ended.';
      final fp = license?.fingerprint ?? '';

      return Scaffold(
        backgroundColor: AppTheme.backgroundLight,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Icon
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppTheme.errorRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppTheme.errorRed.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Icon(
                      CupertinoIcons.shield_slash,
                      color: AppTheme.errorRed,
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Title
                  Text(
                    'Activation Required',
                    style: AppTheme.titleLarge.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    reason,
                    style: AppTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),

                  // Device code box
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.cardBackground,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppTheme.borderColor),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'YOUR DEVICE CODE',
                          style: AppTheme.labelSmall.copyWith(
                            letterSpacing: 1.5,
                            fontSize: 10,
                            color: AppTheme.textTertiary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: SelectableText(
                                fp.isNotEmpty ? fp : 'Computing…',
                                style: AppTheme.bodySmall.copyWith(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  color: AppTheme.primaryCyan,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: _copyFingerprint,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryCyan
                                      .withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: AppTheme.primaryCyan
                                        .withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      _copied
                                          ? CupertinoIcons.checkmark
                                          : CupertinoIcons.doc_on_doc,
                                      size: 12,
                                      color: AppTheme.primaryCyan,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      _copied ? 'Copied!' : 'Copy',
                                      style: AppTheme.labelSmall.copyWith(
                                        color: AppTheme.primaryCyan,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Instructions
                  Text(
                    'Contact SS MART POS Sales with the device code above. Activation is locked to this device only.',
                    style: AppTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),

                  // Recheck button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _checkLicense,
                      icon: _checking
                          ? const CupertinoActivityIndicator(radius: 8)
                          : const Icon(
                              CupertinoIcons.arrow_clockwise,
                              size: 14,
                            ),
                      label: Text(
                        _checking
                            ? 'Checking…'
                            : 'Recheck Activation',
                        style: AppTheme.labelLarge
                            .copyWith(color: Colors.black),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryCyan,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // ---- Trial banner ---- //
    if (license.status == LicenseStatus.trial) {
      return Stack(
        children: [
          widget.child,
          Positioned(
            bottom: 12,
            left: 16,
            right: 16,
            child: SafeArea(
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.warningOrange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: AppTheme.warningOrange.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        CupertinoIcons.shield,
                        size: 13,
                        color: AppTheme.warningOrange,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Free Trial — ${license.daysRemaining ?? 0} day${(license.daysRemaining ?? 0) == 1 ? '' : 's'} remaining',
                        style: AppTheme.labelSmall.copyWith(
                          color: AppTheme.warningOrange,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }

    // ---- Licensed — subtle badge ---- //
    return Stack(
      children: [
        widget.child,
        Positioned(
          bottom: 12,
          left: 16,
          right: 16,
          child: SafeArea(
            child: Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppTheme.successGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: AppTheme.successGreen.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      CupertinoIcons.checkmark_shield,
                      size: 13,
                      color: AppTheme.successGreen,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      license.isMaster
                          ? 'Master Access'
                          : 'Licensed${license.licensedTo != null ? ' — ${license.licensedTo}' : ''}',
                      style: AppTheme.labelSmall.copyWith(
                        color: AppTheme.successGreen,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
