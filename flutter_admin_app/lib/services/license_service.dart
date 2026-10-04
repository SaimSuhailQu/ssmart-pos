import 'dart:io';

import 'package:firebase_database/firebase_database.dart';
import 'package:path_provider/path_provider.dart';
import 'package:ssmart_pos_admin/core/licensing/license_state.dart';
import 'package:ssmart_pos_admin/core/licensing/license_verifier.dart';
import 'package:ssmart_pos_admin/core/licensing/secure_license_store.dart';
import 'package:ssmart_pos_admin/core/utils/device_fingerprint.dart';

/// Device-locked licensing service for the mobile admin / POS app.
///
/// Evaluation order (first decisive win):
///  1. Offline product key (Ed25519) — activated via "Enter Product Key",
///     cached in encrypted storage. Works with zero connectivity.
///  2. Firebase remote license — device-code activation, remote kill switch.
///  3. Trial — 14 days, then a 3-day grace window before the hard lockout.
///
/// The license cache is encrypted at rest via [SecureLicenseStore]
/// (Android keystore / iOS keychain). The legacy plaintext
/// `ssmart_license_cache.json` is imported once and deleted.
class LicenseService {
  static const int _defaultTrialDays = 14;
  static const int _trialGraceDays = 3;

  /// Compile-time public key: `--dart-define=SSPOS_LICENSE_PUBLIC_KEY=<base64>`.
  /// Embedded fallback ensures offline product key verification works out of the box.
  static const String _publicKey = String.fromEnvironment(
    'SSPOS_LICENSE_PUBLIC_KEY',
    defaultValue: 'MCowBQYDK2VwAyEAi5Xepc/uZULn5HPaBvAR3PRNDGDlSTfPO3oWBiBRpg0=',
  );

  final FirebaseDatabase _db;
  final SecureLicenseStore _store;
  LicenseState? _current;

  LicenseService(this._db, {SecureLicenseStore? store})
      : _store = store ?? SecureLicenseStore();

  LicenseState? get current => _current;

  /// Activate an Ed25519 product key on this device. Fully offline.
  /// Throws [LicenseVerificationError] with a user-facing message on failure.
  Future<LicenseState> activateProductKey(String key) async {
    if (_publicKey.isEmpty) {
      throw const LicenseVerificationError(
        'Product-key activation is not configured in this build. Contact support.',
      );
    }
    final fingerprint = await DeviceFingerprint.get();
    final payload = await verifyLicenseKey(key, publicKeyB64: _publicKey);

    if (payload.isExpired) {
      throw const LicenseVerificationError('This product key has expired.');
    }
    if (payload.deviceBind != null &&
        payload.deviceBind!.toLowerCase() != fingerprint.toLowerCase()) {
      throw const LicenseVerificationError(
        'This key is bound to a different device.',
      );
    }
    if (payload.tier == 0) {
      throw const LicenseVerificationError(
        'This key is a trial key — trials activate automatically.',
      );
    }

    await _store.writeProductKey(key);
    final tier = payload.tier == 2 ? LicenseTier.enterprise : LicenseTier.standard;
    final state = LicenseState(
      status: LicenseStatus.licensed,
      fingerprint: fingerprint,
      platform: await DeviceFingerprint.platformLabel(),
      checkedAt: DateTime.now().toIso8601String(),
      licensedTo: 'Licensed terminal',
      licenseKey: '${key.trim().toUpperCase().substring(0, 12)}…',
      expiresAt: payload.expiresAt?.toIso8601String(),
      daysRemaining: payload.expiresAt
          ?.difference(DateTime.now())
          .inDays
          .clamp(0, 9999),
      tier: tier,
      maxTerminals: payload.maxTerminals,
      isMaster: tier == LicenseTier.enterprise,
      role: tier == LicenseTier.enterprise ? 'master' : 'tenant',
    );
    _current = state;
    await _store.writeState(state);
    return state;
  }

  /// Remove the locally activated product key (support / transfer flow).
  Future<void> deactivateProductKey() => _store.clearProductKey();

  /// Check (or re-check) the license for this device.
  Future<LicenseState> checkLicense() async {
    final fingerprint = await DeviceFingerprint.get();
    final platform = await DeviceFingerprint.platformLabel();
    final now = DateTime.now().toIso8601String();

    await _migrateLegacyCacheOnce();

    // 1. Offline product key — highest priority, works without network.
    try {
      final keyed = await _evaluateActivatedKey(fingerprint, platform);
      if (keyed != null) {
        _current = keyed;
        return keyed;
      }
    } catch (_) {
      // Fall through to the Firebase flow.
    }

    // 2. Firebase remote flow (device-code activation, kill switch).
    try {
      final snap = await _db.ref('licenses/$fingerprint').get();

      if (snap.exists && snap.value != null) {
        final remote = Map<String, dynamic>.from(snap.value as Map);

        final active = remote['active'] ?? true;
        final revoked = remote['revoked'] == true;
        final deactivated = remote['deactivated'] == true;

        if (!revoked && !deactivated && active != false) {
          if (remote['expiresAt'] != null) {
            final exp = DateTime.tryParse(remote['expiresAt'].toString());
            if (exp != null && exp.isBefore(DateTime.now())) {
              final state = LicenseState(
                status: LicenseStatus.expired,
                fingerprint: fingerprint,
                platform: platform,
                checkedAt: now,
                licensedTo: remote['customerName'],
                licenseKey: remote['licenseKey'],
                role: remote['role'],
                isMaster: remote['role'] == 'master',
                tier: remote['role'] == 'master'
                    ? LicenseTier.enterprise
                    : LicenseTier.standard,
                error: 'subscription_expired',
              );
              _current = state;
              await _store.writeState(state);
              return state;
            }
          }

          final isMaster = remote['role'] == 'master';
          final state = LicenseState(
            status: LicenseStatus.licensed,
            fingerprint: fingerprint,
            platform: platform,
            checkedAt: now,
            licensedTo: remote['customerName'] ?? remote['customerEmail'],
            licenseKey: remote['licenseKey'],
            role: remote['role'],
            isMaster: isMaster,
            tier: isMaster ? LicenseTier.enterprise : LicenseTier.standard,
          );
          _current = state;
          await _store.writeState(state);
          return state;
        }

        // Revoked or deactivated — fall through to trial/expired evaluation
        return await _evaluateTrial(
          fingerprint,
          platform,
          now,
          wasRevoked: revoked || deactivated,
        );
      }

      // No record — trial evaluation
      return await _evaluateTrial(fingerprint, platform, now);
    } catch (e) {
      // Network error — use cached state
      final cached = await _store.readState();
      if (cached != null && cached.fingerprint == fingerprint) {
        _current = cached;
        return cached;
      }

      // First-run with no network
      return _startTrial(fingerprint, platform, now);
    }
  }

  /// Re-verify the locally activated product key (signature + expiry + binding).
  Future<LicenseState?> _evaluateActivatedKey(
    String fingerprint,
    String platform,
  ) async {
    if (_publicKey.isEmpty) return null;
    final key = await _store.readProductKey();
    if (key == null || key.length < 16) return null;
    final payload = await verifyLicenseKey(key, publicKeyB64: _publicKey);
    if (payload.isExpired) {
      await _store.clearProductKey();
      return null;
    }
    if (payload.deviceBind != null &&
        payload.deviceBind!.toLowerCase() != fingerprint.toLowerCase()) {
      return null;
    }
    final tier =
        payload.tier == 2 ? LicenseTier.enterprise : LicenseTier.standard;
    return LicenseState(
      status: LicenseStatus.licensed,
      fingerprint: fingerprint,
      platform: platform,
      checkedAt: DateTime.now().toIso8601String(),
      licensedTo: 'Licensed terminal',
      licenseKey: '${key.substring(0, 12)}…',
      expiresAt: payload.expiresAt?.toIso8601String(),
      daysRemaining: payload.expiresAt
          ?.difference(DateTime.now())
          .inDays
          .clamp(0, 9999),
      tier: tier,
      maxTerminals: payload.maxTerminals,
      isMaster: tier == LicenseTier.enterprise,
      role: tier == LicenseTier.enterprise ? 'master' : 'tenant',
    );
  }

  Future<LicenseState> _evaluateTrial(
    String fingerprint,
    String platform,
    String now, {
    bool wasRevoked = false,
  }) async {
    final cached = await _store.readState();

    if (cached != null &&
        cached.fingerprint == fingerprint &&
        cached.status == LicenseStatus.trial &&
        cached.expiresAt != null) {
      final exp = DateTime.tryParse(cached.expiresAt!);
      if (exp != null) {
        final graceUntil =
            exp.add(const Duration(days: _trialGraceDays));
        final inGrace =
            DateTime.now().isAfter(exp) && DateTime.now().isBefore(graceUntil);

        if (exp.isAfter(DateTime.now())) {
          final state = LicenseState(
            status: LicenseStatus.trial,
            fingerprint: fingerprint,
            platform: platform,
            checkedAt: now,
            expiresAt: cached.expiresAt,
            daysRemaining:
                exp.difference(DateTime.now()).inDays.clamp(0, 999),
            error: wasRevoked ? 'license_revoked' : null,
          );
          _current = state;
          return state;
        }

        if (inGrace) {
          // Grace window: full function with a warning banner.
          final state = LicenseState(
            status: LicenseStatus.trial,
            fingerprint: fingerprint,
            platform: platform,
            checkedAt: now,
            expiresAt: cached.expiresAt,
            daysRemaining: 0,
            inGrace: true,
            graceUntil: graceUntil.toIso8601String(),
            error: wasRevoked ? 'license_revoked' : null,
          );
          _current = state;
          return state;
        }
      }

      // Trial (and grace) expired
      final state = LicenseState(
        status: LicenseStatus.expired,
        fingerprint: fingerprint,
        platform: platform,
        checkedAt: now,
        expiresAt: cached.expiresAt,
        daysRemaining: 0,
        error: wasRevoked ? 'license_revoked' : 'trial_expired',
      );
      _current = state;
      return state;
    }

    return _startTrial(fingerprint, platform, now);
  }

  Future<LicenseState> _startTrial(
    String fingerprint,
    String platform,
    String now,
  ) async {
    final trialDays = await _fetchTrialDays();
    final expires =
        DateTime.now().add(Duration(days: trialDays)).toIso8601String();
    final state = LicenseState(
      status: LicenseStatus.trial,
      fingerprint: fingerprint,
      platform: platform,
      checkedAt: now,
      expiresAt: expires,
      daysRemaining: trialDays,
    );
    _current = state;
    await _store.writeState(state);
    return state;
  }

  Future<int> _fetchTrialDays() async {
    try {
      final snap = await _db.ref('config/trial_days').get();
      if (snap.exists) {
        final val = int.tryParse(snap.value.toString());
        if (val != null && val > 0) return val;
      }
    } catch (_) {}
    return _defaultTrialDays;
  }

  bool _migratedLegacy = false;

  /// Import the old plaintext cache exactly once, then delete it.
  Future<void> _migrateLegacyCacheOnce() async {
    if (_migratedLegacy) return;
    _migratedLegacy = true;
    try {
      final dir = await getApplicationDocumentsDirectory();
      final legacy = File('${dir.path}/ssmart_license_cache.json');
      await _store.migrateLegacyCache(
        () async => legacy.existsSync() ? legacy.readAsStringSync() : null,
        () async {
          if (legacy.existsSync()) legacy.deleteSync();
        },
      );
    } catch (_) {
      // Non-fatal.
    }
  }
}
