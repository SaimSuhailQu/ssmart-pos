import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:flutter/services.dart';

/// A USB device attached to the Android phone, as reported by
/// Android's `UsbManager`. Only [vendorId]/[productId] identify the
/// printer for a print job; [deviceName] is the Android device path
/// and is used as a tie-breaker when two identical printers are
/// plugged in.
class UsbPrinterDevice {
  final String name;
  final String deviceName;
  final int vendorId;
  final int productId;
  final String? manufacturerName;
  final String? productName;

  const UsbPrinterDevice({
    required this.name,
    required this.deviceName,
    required this.vendorId,
    required this.productId,
    this.manufacturerName,
    this.productName,
  });

  factory UsbPrinterDevice.fromMap(Map<dynamic, dynamic> map) {
    return UsbPrinterDevice(
      name: (map['name'] as String?) ?? 'USB Printer',
      deviceName: (map['deviceName'] as String?) ?? '',
      vendorId: (map['vendorId'] as num?)?.toInt() ?? 0,
      productId: (map['productId'] as num?)?.toInt() ?? 0,
      manufacturerName: map['manufacturerName'] as String?,
      productName: map['productName'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'deviceName': deviceName,
        'vendorId': vendorId,
        'productId': productId,
        if (manufacturerName != null) 'manufacturerName': manufacturerName,
        if (productName != null) 'productName': productName,
      };

  factory UsbPrinterDevice.fromJson(Map<String, dynamic> json) {
    return UsbPrinterDevice(
      name: (json['name'] as String?) ?? 'USB Printer',
      deviceName: (json['deviceName'] as String?) ?? '',
      vendorId: (json['vendorId'] as num?)?.toInt() ?? 0,
      productId: (json['productId'] as num?)?.toInt() ?? 0,
      manufacturerName: json['manufacturerName'] as String?,
      productName: json['productName'] as String?,
    );
  }

  /// Short `VID:PID` label for the settings screen, e.g. `0x0416:0x5011`.
  String get vidPid =>
      '0x${vendorId.toRadixString(16).padLeft(4, '0')}:'
      '0x${productId.toRadixString(16).padLeft(4, '0')}';
}

/// A failed USB print, already translated into words the cashier can
/// act on. [code] is the raw native error code, kept for logs.
class UsbPrinterException implements Exception {
  final String code;
  final String message;

  const UsbPrinterException(this.code, this.message);

  @override
  String toString() => 'UsbPrinterException($code): $message';
}

/// Dart side of the `com.ssmartpos/usb_printer` MethodChannel.
///
/// Android only: the native side lives in
/// `android/app/src/main/kotlin/com/ssmartpos/UsbPrinterPlugin.kt`
/// and talks to the printer exactly the way PrintShare does —
/// `UsbManager` enumeration, the system USB-permission dialog, then
/// raw bytes over the bulk OUT endpoint. No driver, no vendor SDK.
///
/// On iOS (and anywhere the native side is absent) listing returns
/// an empty list and printing throws, so callers must gate the UI on
/// `UsbPrinterChannel.isSupported` / `Platform.isAndroid`.
class UsbPrinterChannel {
  static const MethodChannel _channel =
      MethodChannel('com.ssmartpos/usb_printer');

  /// True only on Android, where USB host mode exists.
  static bool get isSupported => Platform.isAndroid;

  /// All USB devices currently attached, printer-class devices first.
  /// Listing needs no permission — the permission dialog only appears
  /// when a print is attempted.
  Future<List<UsbPrinterDevice>> listDevices() async {
    if (!isSupported) return const [];
    try {
      final result = await _channel.invokeMethod<List<dynamic>>('listDevices');
      if (result == null) return const [];
      return result
          .whereType<Map>()
          .map((m) => UsbPrinterDevice.fromMap(m))
          .toList();
    } on MissingPluginException {
      // App built before the native plugin existed (stale install).
      return const [];
    }
  }

  /// Send raw ESC/POS [bytes] to [device].
  ///
  /// The native side requests the Android USB permission first when
  /// needed and waits for the user's answer, so this call can take a
  /// while on first use. Throws [UsbPrinterException] with an
  /// actionable message on every failure mode.
  Future<void> printBytes({
    required UsbPrinterDevice device,
    required List<int> bytes,
  }) async {
    if (!isSupported) {
      throw const UsbPrinterException(
        'unsupported',
        'USB printing works on Android only. On iPhone, use Print POS (laptop printer) or WhatsApp.',
      );
    }
    try {
      await _channel.invokeMethod<void>('printBytes', {
        'vendorId': device.vendorId,
        'productId': device.productId,
        'deviceName': device.deviceName,
        'bytes': Uint8List.fromList(bytes),
      });
    } on PlatformException catch (e) {
      throw UsbPrinterException(e.code, _messageForCode(e.code, e.message));
    } on MissingPluginException {
      throw const UsbPrinterException(
        'missing_plugin',
        'USB printing is not in this build. Update the app and try again.',
      );
    }
  }

  static String _messageForCode(String code, String? detail) {
    switch (code) {
      case 'permission_denied':
        return 'USB permission denied. Tap the printer again and choose Allow in the Android dialog.';
      case 'permission_timeout':
        return 'No answer to the Android USB permission dialog. Tap the printer again and answer Allow/Deny.';
      case 'no_device':
        return 'Printer not found. Check the OTG cable and that the printer is switched on, then scan again.';
      case 'no_interface':
        return 'This USB device has no printer interface. It may not be a receipt printer.';
      case 'no_endpoint':
        return 'This printer has no usable USB endpoint. Try another cable or port.';
      case 'open_failed':
        return 'Could not open the printer. Unplug it, plug it back in, and try again.';
      case 'write_failed':
        return 'The printer stopped taking data (paper, cover, or power?). Fix it and reprint from the receipt.';
      case 'busy':
        return 'A print is already in progress. Wait for it to finish.';
      default:
        return detail?.isNotEmpty == true
            ? detail!
            : 'USB print failed ($code). Try again.';
    }
  }
}
