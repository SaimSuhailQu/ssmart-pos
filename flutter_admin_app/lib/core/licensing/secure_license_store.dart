import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ssmart_pos_admin/core/licensing/license_state.dart';

/// Encrypted license persistence for the mobile app.
///
/// Replaces the old plaintext `ssmart_license_cache.json` (which any app
/// with storage access could read and copy). Backed by
/// `flutter_secure_storage`:
///  - Android: EncryptedSharedPreferences (AES-256, keystore-backed key)
///  - iOS: Keychain (kSecClassGenericPassword)
///
/// Values are additionally JSON-encoded; the activated product key record
/// is stored under a separate key so it can be revoked independently.
class SecureLicenseStore {
  static const _stateKey = 'ssmart_license_state_v1';
  static const _productKey = 'ssmart_license_product_key_v1';

  final FlutterSecureStorage _storage;

  SecureLicenseStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  Future<void> writeState(LicenseState state) async {
    await _storage.write(key: _stateKey, value: jsonEncode(state.toJson()));
  }

  Future<LicenseState?> readState() async {
    try {
      final raw = await _storage.read(key: _stateKey);
      if (raw == null || raw.isEmpty) return null;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      if (json['version'] != 1) return null;
      return LicenseState.fromJson(json);
    } catch (_) {
      // Tampered / unreadable — treated as absent.
      return null;
    }
  }

  Future<void> writeProductKey(String key) async {
    await _storage.write(key: _productKey, value: key.trim().toUpperCase());
  }

  Future<String?> readProductKey() => _storage.read(key: _productKey);

  Future<void> clearProductKey() => _storage.delete(key: _productKey);

  /// One-time migration: import the legacy plaintext cache file if present,
  /// then delete it so no readable copy survives on disk.
  Future<LicenseState?> migrateLegacyCache(
    Future<String?> Function() readLegacyFile,
    Future<void> Function() deleteLegacyFile,
  ) async {
    try {
      final existing = await readState();
      if (existing != null) return existing;
      final raw = await readLegacyFile();
      if (raw == null || raw.isEmpty) return null;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      if (json['version'] != 1) return null;
      final state = LicenseState.fromJson(json);
      await writeState(state);
      await deleteLegacyFile();
      return state;
    } catch (_) {
      return null;
    }
  }
}
