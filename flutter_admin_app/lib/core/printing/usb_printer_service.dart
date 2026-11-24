import 'package:ssmart_pos_admin/core/printing/printer_settings_store.dart';
import 'package:ssmart_pos_admin/core/printing/usb_printer_channel.dart';
import 'package:ssmart_pos_admin/core/printing/usb_receipt_builder.dart';
import 'package:ssmart_pos_admin/models/sale.dart';

/// Outcome of one print attempt, in words the cashier can act on.
class UsbPrintResult {
  final bool ok;
  final String message;

  const UsbPrintResult._(this.ok, this.message);

  factory UsbPrintResult.success() =>
      const UsbPrintResult._(true, 'Printed via USB printer.');

  factory UsbPrintResult.failure(String message) =>
      UsbPrintResult._(false, message);
}

/// Orchestrates USB OTG bill printing: settings + receipt bytes +
/// transport, with one print at a time.
///
/// The native side serialises too, but the Dart-side guard keeps two
/// taps (auto-print plus the receipt sheet's Print USB button) from
/// racing into two permission dialogs.
class UsbPrinterService {
  final UsbPrinterChannel _channel;
  final PrinterSettingsStore _store;
  bool _busy = false;

  UsbPrinterService({
    UsbPrinterChannel? channel,
    PrinterSettingsStore? store,
  })  : _channel = channel ?? UsbPrinterChannel(),
        _store = store ?? PrinterSettingsStore();

  Future<PrinterSettings> loadSettings() => _store.read();

  Future<void> saveSettings(PrinterSettings settings) =>
      _store.write(settings);

  Future<void> forgetPrinter() async {
    final current = await _store.read();
    await _store.write(current.copyWith(clearDevice: true));
  }

  Future<List<UsbPrinterDevice>> scanDevices() => _channel.listDevices();

  /// Print [sale] on the saved USB printer.
  Future<UsbPrintResult> printSale(Sale sale) async {
    final settings = await _store.read();
    final device = settings.device;
    if (device == null) {
      return UsbPrintResult.failure(
        'No USB printer selected. Open USB Printer settings and tap your printer first.',
      );
    }
    final bytes = UsbReceiptBuilder.buildSaleReceipt(
      sale,
      paperSize: settings.paperSize,
    );
    return _send(device, bytes);
  }

  /// Print the short test receipt on the saved USB printer.
  Future<UsbPrintResult> testPrint() async {
    final settings = await _store.read();
    final device = settings.device;
    if (device == null) {
      return UsbPrintResult.failure(
        'No USB printer selected yet. Tap a printer in the list first.',
      );
    }
    final bytes = UsbReceiptBuilder.buildTestPrint(
      paperSize: settings.paperSize,
    );
    return _send(device, bytes);
  }

  Future<UsbPrintResult> _send(UsbPrinterDevice device, List<int> bytes) async {
    if (_busy) {
      return UsbPrintResult.failure(
        'A print is already in progress. Wait for it to finish.',
      );
    }
    _busy = true;
    try {
      await _channel.printBytes(device: device, bytes: bytes);
      return UsbPrintResult.success();
    } on UsbPrinterException catch (e) {
      return UsbPrintResult.failure(e.message);
    } catch (e) {
      return UsbPrintResult.failure('USB print failed: $e');
    } finally {
      _busy = false;
    }
  }
}
