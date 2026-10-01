import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Platform-stable device fingerprint for per-device license activation.
///
/// Resolution order:
///  1. Windows: Machine GUID from the registry (most stable machine identity).
///  2. Android: ANDROID_ID (SSAID) via device_info_plus.
///  3. iOS / macOS: identifierForVendor via device_info_plus.
///  4. Linux / fallback: hashed persistent platform string.
///
/// The raw identifier never leaves the device: the returned fingerprint is a
/// SHA-256 of the source value, so the license database stores nothing that
/// can be reversed into a hardware identifier.
class DeviceFingerprint {
  static String? _cached;
  static String? _cachedPlatform;

  static const MethodChannel _channel =
      MethodChannel('com.ssmart.pos/device_info');

  static Future<String> get() async {
    if (_cached != null) return _cached!;

    String source;
    String platform;

    try {
      if (kIsWeb) {
        source = 'web';
        platform = 'web';
      } else if (Platform.isWindows) {
        final guid = await _channel.invokeMethod<String>('getMachineGuid');
        source = (guid != null && guid.isNotEmpty) ? guid : 'win-fallback';
        platform = 'windows';
      } else if (Platform.isAndroid) {
        final info = await DeviceInfoPlugin().androidInfo;
        source = info.id.isNotEmpty ? info.id : 'android-fallback';
        platform = 'android';
      } else if (Platform.isIOS || Platform.isMacOS) {
        final info = await DeviceInfoPlugin().iosInfo;
        source = info.identifierForVendor ?? 'ios-fallback';
        platform = Platform.isIOS ? 'ios' : 'macos';
      } else if (Platform.isLinux) {
        source = 'linux-${Platform.operatingSystemVersion.hashCode}';
        platform = 'linux';
      } else {
        source = 'unknown';
        platform = 'unknown';
      }
    } catch (_) {
      source = 'fp-error';
      platform = 'unknown';
    }

    final material = '$platform:$source:ssmart-pos-v1';
    _cached = sha256.convert(utf8.encode(material)).toString();
    return _cached!;
  }

  /// Human-readable platform label for the license record.
  static Future<String> platformLabel() async {
    if (_cachedPlatform != null) return _cachedPlatform!;
    try {
      if (!kIsWeb && Platform.isWindows) return _cachedPlatform = 'Windows';
      if (!kIsWeb && Platform.isLinux) return _cachedPlatform = 'Linux';
      if (!kIsWeb && Platform.isMacOS) return _cachedPlatform = 'macOS';
      if (!kIsWeb && Platform.isAndroid) return _cachedPlatform = 'Android';
      if (!kIsWeb && Platform.isIOS) return _cachedPlatform = 'iOS';
    } catch (_) {}
    return _cachedPlatform = 'Unknown';
  }
}
