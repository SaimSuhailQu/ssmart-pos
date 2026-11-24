import 'dart:io' show Platform;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../core/printing/printer_settings_store.dart';
import '../../../core/printing/usb_printer_channel.dart';
import '../../../core/printing/usb_printer_service.dart';
import '../../../core/printing/usb_receipt_builder.dart';
import '../../../core/theme/graphite_theme.dart';
import '../../../core/widgets/pressable.dart';

/// USB OTG thermal-printer settings (Android only).
///
/// The shop flow, PrintShare-style: plug the 58/80mm thermal printer
/// into the phone with an OTG cable, scan, tap the printer, answer
/// Allow in Android's USB dialog once, then test-print. The chosen
/// printer is remembered, so checkout can print straight to it.
///
/// iOS has no USB host mode for printers, so on iPhone this screen
/// only explains that — printing there stays on Print POS (laptop)
/// and WhatsApp.
class PrinterSettingsScreen extends StatefulWidget {
  const PrinterSettingsScreen({super.key});

  @override
  State<PrinterSettingsScreen> createState() => _PrinterSettingsScreenState();
}

class _PrinterSettingsScreenState extends State<PrinterSettingsScreen> {
  final _service = UsbPrinterService();

  PrinterSettings? _settings;
  List<UsbPrinterDevice> _devices = const [];
  bool _scanning = false;
  bool _printing = false;
  String? _status;
  bool _statusOk = true;

  bool get _isAndroid => Platform.isAndroid;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = await _service.loadSettings();
    if (!mounted) return;
    setState(() => _settings = settings);
    if (_isAndroid) _scan(silent: true);
  }

  Future<void> _scan({bool silent = false}) async {
    if (!_isAndroid) return;
    setState(() {
      _scanning = true;
      if (!silent) _status = null;
    });
    final devices = await _service.scanDevices();
    if (!mounted) return;
    setState(() {
      _devices = devices;
      _scanning = false;
      if (!silent) {
        _status = devices.isEmpty
            ? 'No USB device found. Check the OTG cable, switch the printer on, and scan again.'
            : 'Found ${devices.length} USB device(s). Tap your printer to save it.';
        _statusOk = devices.isNotEmpty;
      }
    });
  }

  Future<void> _select(UsbPrinterDevice device) async {
    final current = _settings ?? const PrinterSettings();
    final next = current.copyWith(device: device);
    await _service.saveSettings(next);
    if (!mounted) return;
    setState(() {
      _settings = next;
      _status =
          'Saved "${device.name}". Tap Test Print — Android will ask for USB permission once.';
      _statusOk = true;
    });
  }

  Future<void> _testPrint() async {
    setState(() {
      _printing = true;
      _status = null;
    });
    final result = await _service.testPrint();
    if (!mounted) return;
    setState(() {
      _printing = false;
      _status = result.message;
      _statusOk = result.ok;
    });
  }

  Future<void> _setPaper(UsbPaperSize size) async {
    final current = _settings ?? const PrinterSettings();
    final next = current.copyWith(paperSize: size);
    await _service.saveSettings(next);
    if (!mounted) return;
    setState(() => _settings = next);
  }

  Future<void> _setAutoPrint(bool value) async {
    final current = _settings ?? const PrinterSettings();
    final next = current.copyWith(autoPrint: value);
    await _service.saveSettings(next);
    if (!mounted) return;
    setState(() => _settings = next);
  }

  Future<void> _forget() async {
    await _service.forgetPrinter();
    if (!mounted) return;
    setState(() {
      _settings = (_settings ?? const PrinterSettings())
          .copyWith(clearDevice: true);
      _status = 'Printer forgotten. Scan and tap a printer to set one up again.';
      _statusOk = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final settings = _settings ?? const PrinterSettings();
    final saved = settings.device;

    return Scaffold(
      backgroundColor: GraphiteTheme.graphiteDeep,
      appBar: AppBar(
        backgroundColor: GraphiteTheme.graphiteDeep,
        title: const Text('USB Printer (OTG)'),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Print bills on a USB thermal printer',
            style: TextStyle(
                color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          const Text(
            'Plug the printer into the phone with an OTG cable, scan, '
            'tap the printer, and choose Allow when Android asks. The '
            'printer is remembered, so the bill can print straight '
            'from Mobile POS.\n\n'
            'Works with most 58mm / 80mm ESC/POS receipt printers '
            '(XPrinter and similar) — no driver app needed, no '
            'PrintShare needed. Names in Urdu script print as ? on '
            'thermal printers, same as the laptop bills.',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
          if (!_isAndroid) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GraphiteTheme.graphiteCard,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'USB printing is Android-only — iPhones cannot use USB '
                'printers. On this phone, use Print POS (laptop printer) '
                'or WhatsApp from the receipt.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
          ],
          const SizedBox(height: 16),

          // Saved printer card
          if (saved != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GraphiteTheme.graphiteCard,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFF34D399).withOpacity(0.4)),
              ),
              child: Row(
                children: [
                  const Icon(CupertinoIcons.printer_fill,
                      color: Color(0xFF34D399), size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(saved.name,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14)),
                        Text(saved.vidPid,
                            style: const TextStyle(
                                color: Colors.white54, fontSize: 12)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: _forget,
                    child: const Text('Forget',
                        style: TextStyle(color: Color(0xFFEF4444))),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Scan button
          Pressable(
            onTap: _isAndroid && !_scanning ? () => _scan() : null,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: _isAndroid
                    ? const Color(0xFFD4AF37)
                    : Colors.white12,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: _scanning
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.black, strokeWidth: 2))
                    : const Text('Scan for USB printers',
                        style: TextStyle(
                            color: Colors.black, fontWeight: FontWeight.bold)),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Device list
          if (_devices.isNotEmpty)
            ..._devices.map((device) {
              final isSaved = saved != null &&
                  saved.vendorId == device.vendorId &&
                  saved.productId == device.productId &&
                  (saved.deviceName.isEmpty ||
                      saved.deviceName == device.deviceName);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Pressable(
                  onTap: () => _select(device),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: GraphiteTheme.graphiteCard,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSaved
                            ? const Color(0xFF34D399)
                            : Colors.white12,
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(CupertinoIcons.printer,
                            color: Colors.white70, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(device.name,
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14)),
                              Text(
                                '${device.vidPid}'
                                '${device.manufacturerName != null ? ' • ${device.manufacturerName}' : ''}',
                                style: const TextStyle(
                                    color: Colors.white54, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        if (isSaved)
                          const Icon(Icons.check_circle,
                              size: 18, color: Color(0xFF34D399)),
                      ],
                    ),
                  ),
                ),
              );
            }),
          if (_isAndroid && _devices.isEmpty && !_scanning)
            const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Text(
                'No printer found yet. Plug the printer in with the OTG '
                'cable, switch it on, and tap Scan.',
                style: TextStyle(color: Colors.white54, fontSize: 13),
              ),
            ),
          const SizedBox(height: 8),

          // Paper size
          const Text('Paper width',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                  child: _paperChip('58mm (32 cols)', UsbPaperSize.mm58,
                      settings.paperSize)),
              const SizedBox(width: 10),
              Expanded(
                  child: _paperChip('80mm (48 cols)', UsbPaperSize.mm80,
                      settings.paperSize)),
            ],
          ),
          const SizedBox(height: 16),

          // Auto-print toggle
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: GraphiteTheme.graphiteCard,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Print automatically after each sale',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 14)),
                      Text(
                        'Off by default. When on, the bill prints on the '
                        'saved printer as soon as a sale completes.',
                        style:
                            TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: settings.autoPrint,
                  activeColor: const Color(0xFFD4AF37),
                  onChanged: _isAndroid ? _setAutoPrint : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Test print
          Pressable(
            onTap: _isAndroid && saved != null && !_printing
                ? _testPrint
                : null,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: _isAndroid && saved != null
                    ? Colors.white
                    : Colors.white12,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: _printing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.black, strokeWidth: 2))
                    : const Text('Test print',
                        style: TextStyle(
                            color: Colors.black, fontWeight: FontWeight.bold)),
              ),
            ),
          ),
          if (_status != null) ...[
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  _statusOk ? Icons.check_circle : Icons.error_outline,
                  size: 16,
                  color: _statusOk
                      ? const Color(0xFF34D399)
                      : const Color(0xFFEF4444),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(_status!,
                      style: TextStyle(
                        color: _statusOk
                            ? const Color(0xFF34D399)
                            : const Color(0xFFEF4444),
                        fontSize: 13,
                      )),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _paperChip(
      String label, UsbPaperSize size, UsbPaperSize selected) {
    final isSelected = size == selected;
    return Pressable(
      onTap: () => _setPaper(size),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFD4AF37).withOpacity(0.25)
              : GraphiteTheme.graphiteCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? const Color(0xFFD4AF37)
                : Colors.white12,
          ),
        ),
        child: Center(
          child: Text(label,
              style: TextStyle(
                color: isSelected ? const Color(0xFFD4AF37) : Colors.white70,
                fontWeight:
                    isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 13,
              )),
        ),
      ),
    );
  }
}
