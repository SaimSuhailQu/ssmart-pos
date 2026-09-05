import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/widgets/quick_barcode_entry_sheet.dart';

/// Legacy Barcode Scanner Sheet fallback for iPhone 7
/// Redirects to QuickBarcodeEntrySheet without mobile_scanner
class BarcodeScannerSheet extends StatelessWidget {
  const BarcodeScannerSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return const QuickBarcodeEntrySheet();
  }
}
