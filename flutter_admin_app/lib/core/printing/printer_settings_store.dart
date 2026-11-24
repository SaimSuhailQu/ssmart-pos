import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ssmart_pos_admin/core/printing/usb_printer_channel.dart';
import 'package:ssmart_pos_admin/core/printing/usb_receipt_builder.dart';

/// Persisted USB printer settings: which printer, which paper width,
/// and whether bills print automatically after a sale.
///
/// Stored in `flutter_secure_storage` (same store the license code
/// uses) so no new dependency is needed. These are not secrets — the
/// secure store is used because it is already in the app and already
/// works on both platforms. A corrupt or foreign value reads back as
/// defaults, never as a crash.
class PrinterSettings {
  final UsbPrinterDevice? device;
  final UsbPaperSize paperSize;
  final bool autoPrint;

  const PrinterSettings({
    this.device,
    this.paperSize = UsbPaperSize.mm58,
    this.autoPrint = false,
  });

  PrinterSettings copyWith({
    UsbPrinterDevice? device,
    bool clearDevice = false,
    UsbPaperSize? paperSize,
    bool? autoPrint,
  }) {
    return PrinterSettings(
      device: clearDevice ? null : (device ?? this.device),
      paperSize: paperSize ?? this.paperSize,
      autoPrint: autoPrint ?? this.autoPrint,
    );
  }

  Map<String, dynamic> toJson() => {
        'version': 1,
        if (device != null) 'device': device!.toJson(),
        'paperSize': paperSize.name,
        'autoPrint': autoPrint,
      };

  factory PrinterSettings.fromJson(Map<String, dynamic> json) {
    UsbPrinterDevice? device;
    final rawDevice = json['device'];
    if (rawDevice is Map<String, dynamic>) {
      device = UsbPrinterDevice.fromJson(rawDevice);
    } else if (rawDevice is Map) {
      device = UsbPrinterDevice.fromJson(
          rawDevice.map((k, v) => MapEntry(k.toString(), v)));
    }
    final paper = switch (json['paperSize']) {
      'mm80' => UsbPaperSize.mm80,
      _ => UsbPaperSize.mm58,
    };
    return PrinterSettings(
      device: device,
      paperSize: paper,
      autoPrint: json['autoPrint'] == true,
    );
  }
}

/// Storage for [PrinterSettings].
///
/// The read/write/delete functions are injectable so the settings
/// logic stays unit-testable without platform channels; by default
/// they use `FlutterSecureStorage`, matching `SecureLicenseStore`.
class PrinterSettingsStore {
  static const _key = 'ssmart_usb_printer_settings_v1';

  final Future<String?> Function(String key) _read;
  final Future<void> Function(String key, String value) _write;
  final Future<void> Function(String key) _delete;

  PrinterSettingsStore({
    Future<String?> Function(String key)? read,
    Future<void> Function(String key, String value)? write,
    Future<void> Function(String key)? delete,
    FlutterSecureStorage? storage,
  })  : _read = read ?? ((String key) => _readDefault(storage, key)),
        _write = write ??
            ((String key, String value) =>
                _writeDefault(storage, key, value)),
        _delete = delete ?? ((String key) => _deleteDefault(storage, key));

  static Future<String?> _readDefault(FlutterSecureStorage? storage, String key) =>
      (storage ?? const FlutterSecureStorage()).read(key: key);

  static Future<void> _writeDefault(
          FlutterSecureStorage? storage, String key, String value) =>
      (storage ?? const FlutterSecureStorage())
          .write(key: key, value: value);

  static Future<void> _deleteDefault(FlutterSecureStorage? storage, String key) =>
      (storage ?? const FlutterSecureStorage()).delete(key: key);

  Future<PrinterSettings> read() async {
    try {
      final raw = await _read(_key);
      if (raw == null || raw.isEmpty) return const PrinterSettings();
      final json = jsonDecode(raw);
      if (json is! Map<String, dynamic>) return const PrinterSettings();
      if (json['version'] != 1) return const PrinterSettings();
      return PrinterSettings.fromJson(json);
    } catch (_) {
      return const PrinterSettings();
    }
  }

  Future<void> write(PrinterSettings settings) async {
    await _write(_key, jsonEncode(settings.toJson()));
  }

  Future<void> clear() async {
    await _delete(_key);
  }
}
