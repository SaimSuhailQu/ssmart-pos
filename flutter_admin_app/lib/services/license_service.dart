import 'dart:convert';
import 'dart:io';

import 'package:firebase_database/firebase_database.dart';
import 'package:path_provider/path_provider.dart';
import 'package:ssmart_pos_admin/core/utils/device_fingerprint.dart';

/// License states — mirrors the desktop `LicenseState`.
enum LicenseStatus { licensed, trial, expired }

/// Immutable license state snapshot.
class LicenseState {
  final LicenseStatus status;
  final String fingerprint;
  final String platform;
  final String checkedAt;
  final String? licensedTo;
  final String? licenseKey;
  final String? expiresAt;
  final int? daysRemaining;
  final String? tenantId;
  final String? role; // 'master' | 'tenant'
  final bool isMaster;
  final String? error;

  const LicenseState({
    required this.status,
    required this.fingerprint,
    required this.platform,
    required this.checkedAt,
    this.licensedTo,
    this.licenseKey,
    this.expiresAt,
    this.daysRemaining,
    this.tenantId,
    this.role,
    this.isMaster = false,
    this.error,
  });

  factory LicenseState.fromJson(Map<String, dynamic> json) {
    return LicenseState(
      status: LicenseStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => LicenseStatus.expired,
      ),
      fingerprint: json['fingerprint'] ?? '',
      platform: json['platform'] ?? 'unknown',
      checkedAt: json['checkedAt'] ?? DateTime.now().toIso8601String(),
      licensedTo: json['licensedTo'],
      licenseKey: json['licenseKey'],
      expiresAt: json['expiresAt'],
      daysRemaining: json['daysRemaining'],
      tenantId: json['tenantId'],
      role: json['role'],
      isMaster: json['isMaster'] == true,
      error: json['error'],
    );
  }

  Map<String, dynamic> toJson() => {
        'status': status.name,
        'fingerprint': fingerprint,
        'platform': platform,
        'checkedAt': checkedAt,
        'licensedTo': licensedTo,
        'licenseKey': licenseKey,
        'expiresAt': expiresAt,
        'daysRemaining': daysRemaining,
        'tenantId': tenantId,
        'role': role,
        'isMaster': isMaster,
        'error': error,
        'version': 1,
      };

  bool get isActive => status == LicenseStatus.licensed || status == LicenseStatus.trial;
}

/// Device-locked licensing service for the mobile admin app.
///
/// Mirrors the desktop `licensing.ts` 1:1:
///  - SHA-256 fingerprint from [DeviceFingerprint]
///  - Remote lookup at `licenses/<fingerprint>` in Firebase RTDB
///  - 14-day trial (configurable via `config/trial_days`)
///  - Local cache for offline grace
///  - Subscription expiry and remote revocation support
class LicenseService {
  static const int _defaultTrialDays = 14;

  final FirebaseDatabase _db;
  LicenseState? _current;

  LicenseService(this._db);

  LicenseState? get current => _current;

  /// Check (or re-check) the license for this device.
  Future<LicenseState> checkLicense() async {
    final fingerprint = await DeviceFingerprint.get();
    final platform = await DeviceFingerprint.platformLabel();
    final now = DateTime.now().toIso8601String();

    try {
      // Fetch the remote license record
      final snap = await _db.ref('licenses/$fingerprint').get();

      if (snap.exists && snap.value != null) {
        final remote = Map<String, dynamic>.from(snap.value as Map);

        final active = remote['active'] ?? true;
        final revoked = remote['revoked'] == true;
        final deactivated = remote['deactivated'] == true;

        if (!revoked && !deactivated && active != false) {
          // Check subscription expiry
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
                error: 'subscription_expired',
              );
              _current = state;
              await _writeCache(state);
              return state;
            }
          }

          // Active license
          final state = LicenseState(
            status: LicenseStatus.licensed,
            fingerprint: fingerprint,
            platform: platform,
            checkedAt: now,
            licensedTo: remote['customerName'] ?? remote['customerEmail'],
            licenseKey: remote['licenseKey'],
            role: remote['role'],
            isMaster: remote['role'] == 'master',
          );
          _current = state;
          await _writeCache(state);
          return state;
        }

        // Revoked or deactivated — fall through to trial/expired evaluation
        return _evaluateTrial(fingerprint, platform, now,
            wasRevoked: revoked || deactivated);
      }

      // No record — trial evaluation
      return _evaluateTrial(fingerprint, platform, now);
    } catch (e) {
      // Network error — use cached state
      final cached = await _readCache();
      if (cached != null && cached.fingerprint == fingerprint) {
        _current = cached;
        return cached;
      }

      // First-run with no network
      return _startTrial(fingerprint, platform, now);
    }
  }

  Future<LicenseState> _evaluateTrial(
    String fingerprint,
    String platform,
    String now, {
    bool wasRevoked = false,
  }) async {
    final cached = await _readCache();

    if (cached != null &&
        cached.fingerprint == fingerprint &&
        cached.status == LicenseStatus.trial &&
        cached.expiresAt != null) {
      final exp = DateTime.tryParse(cached.expiresAt!);
      if (exp != null && exp.isAfter(DateTime.now())) {
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

      // Trial expired
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
    await _writeCache(state);
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

  // ---- Local cache for offline grace ---- //

  Future<File> get _cacheFile async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/ssmart_license_cache.json');
  }

  Future<LicenseState?> _readCache() async {
    try {
      final file = await _cacheFile;
      if (!file.existsSync()) return null;
      final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      if (json['version'] != 1) return null;
      return LicenseState.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeCache(LicenseState state) async {
    try {
      final file = await _cacheFile;
      file.writeAsStringSync(jsonEncode(state.toJson()));
    } catch (_) {
      // Non-fatal
    }
  }
}
