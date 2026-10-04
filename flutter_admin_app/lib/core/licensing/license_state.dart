/// License state model — shared by [LicenseService], [SecureLicenseStore]
/// and [MobileLicenseGate]. Kept in its own module to avoid import cycles.
library;

/// License states — mirrors the desktop `LicenseState`.
enum LicenseStatus { licensed, trial, expired }

/// Product tiers — mirrors the desktop `LicenseTier`.
enum LicenseTier { trial, standard, enterprise }

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
  final LicenseTier tier;
  final bool inGrace;
  final String? graceUntil;
  final int? maxTerminals;

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
    this.tier = LicenseTier.trial,
    this.inGrace = false,
    this.graceUntil,
    this.maxTerminals,
  });

  factory LicenseState.fromJson(Map<String, dynamic> json) {
    LicenseTier tierFrom(String? name) => LicenseTier.values.firstWhere(
          (e) => e.name == name,
          orElse: () => LicenseTier.trial,
        );
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
      tier: tierFrom(json['tier'] as String?),
      inGrace: json['inGrace'] == true,
      graceUntil: json['graceUntil'],
      maxTerminals: json['maxTerminals'],
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
        'tier': tier.name,
        'inGrace': inGrace,
        'graceUntil': graceUntil,
        'maxTerminals': maxTerminals,
        'version': 1,
      };

  bool get isActive =>
      status == LicenseStatus.licensed || status == LicenseStatus.trial;
}
