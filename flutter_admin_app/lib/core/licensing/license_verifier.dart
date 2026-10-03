/// Offline product-key verification for the Flutter POS / admin apps.
///
/// Mirrors `src/main/licensing/licenseKeys.ts` exactly: same `SSM1-` prefix,
/// same base32(payload || signature) body, same 49-byte payload layout, same
/// Ed25519 verification. A key issued by `scripts/issue-license.mjs` verifies
/// identically on desktop and mobile.
///
/// The public key is compiled in via `--dart-define=SSPOS_LICENSE_PUBLIC_KEY=<base64>`
/// (see [LicenseService.resolvePublicKey]).

import 'dart:convert';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';

class LicensePayload {
  final int version;
  final int tier; // 0=trial, 1=standard, 2=enterprise
  final DateTime issuedAt;
  final DateTime? expiresAt; // null = perpetual
  final int maxTerminals;
  final String? deviceBind; // 64-hex fingerprint, or null = any device

  const LicensePayload({
    required this.version,
    required this.tier,
    required this.issuedAt,
    required this.expiresAt,
    required this.maxTerminals,
    required this.deviceBind,
  });

  bool get isExpired =>
      expiresAt != null && !expiresAt!.isAfter(DateTime.now());

  String get tierName =>
      ['trial', 'standard', 'enterprise'][tier.clamp(0, 2)];
}

class LicenseVerificationError implements Exception {
  final String message;
  const LicenseVerificationError(this.message);
  @override
  String toString() => 'LicenseVerificationError: $message';
}

const _base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

Uint8List _base32Decode(String input) {
  final clean = input.toUpperCase().replaceAll(RegExp(r'[^A-Z2-7]'), '');
  var bits = 0, value = 0;
  final out = <int>[];
  for (final ch in clean.split('')) {
    value = (value << 5) | _base32Alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.add((value >> (bits - 8)) & 0xFF);
      bits -= 8;
    }
  }
  return Uint8List.fromList(out);
}

/// Verify a product key offline. Throws [LicenseVerificationError] on failure.
Future<LicensePayload> verifyLicenseKey(
  String key, {
  required String publicKeyB64,
}) async {
  final normalized = key.trim().toUpperCase();
  if (!normalized.startsWith('SSM1-')) {
    throw const LicenseVerificationError('Not a SSmart POS product key.');
  }
  final raw = _base32Decode(normalized.substring(5));
  const payloadLen = 49, sigLen = 64;
  if (raw.length != payloadLen + sigLen) {
    throw const LicenseVerificationError(
        'Product key has an invalid length — check for typos.');
  }

  final body = raw.sublist(0, payloadLen);
  final signature = raw.sublist(payloadLen);

  final publicKey = SimplePublicKey(
    base64Decode(publicKeyB64),
    type: KeyPairType.ed25519,
  );
  final ok = await Ed25519().verify(
    body,
    signature: Signature(signature, publicKey: publicKey),
  );
  if (!ok) {
    throw const LicenseVerificationError(
        'Signature invalid — this key was not issued by SSmart POS.');
  }

  final data = ByteData.sublistView(body);
  if (data.getUint8(0) != 1) {
    throw const LicenseVerificationError('Unsupported key version.');
  }
  final expiresRaw = data.getUint32(6);
  final bind = body.sublist(12, 44);
  final isUnbound = bind.every((b) => b == 0);

  return LicensePayload(
    version: 1,
    tier: data.getUint8(1),
    issuedAt: DateTime.fromMillisecondsSinceEpoch(data.getUint32(2) * 1000),
    expiresAt: expiresRaw == 0
        ? null
        : DateTime.fromMillisecondsSinceEpoch(expiresRaw * 1000),
    maxTerminals: data.getUint16(10),
    deviceBind: isUnbound
        ? null
        : bind.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
  );
}

/// Convenience: verify + check device binding + expiry in one call.
Future<LicensePayload> verifyLicenseKeyForDevice(
  String key, {
  required String publicKeyB64,
  required String deviceFingerprintHex,
}) async {
  final payload =
      await verifyLicenseKey(key, publicKeyB64: publicKeyB64);
  if (payload.isExpired) {
    throw const LicenseVerificationError('This product key has expired.');
  }
  if (payload.deviceBind != null &&
      payload.deviceBind!.toLowerCase() !=
          deviceFingerprintHex.toLowerCase()) {
    throw const LicenseVerificationError(
        'This key is bound to a different device.');
  }
  return payload;
}
