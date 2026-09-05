import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';

/// Fast Manual Barcode & SKU Entry Modal Sheet
/// Tailored for iPhone 7 / iOS 15 legacy devices without camera scanner
class QuickBarcodeEntrySheet extends StatefulWidget {
  const QuickBarcodeEntrySheet({super.key});

  @override
  State<QuickBarcodeEntrySheet> createState() => _QuickBarcodeEntrySheetState();
}

class _QuickBarcodeEntrySheetState extends State<QuickBarcodeEntrySheet> {
  final TextEditingController _codeController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _codeController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submitCode() {
    final code = _codeController.text.trim();
    if (code.isNotEmpty) {
      Navigator.of(context).pop(code);
    }
  }

  void _appendDigit(String digit) {
    setState(() {
      _codeController.text += digit;
      _codeController.selection = TextSelection.fromPosition(
        TextPosition(offset: _codeController.text.length),
      );
    });
  }

  void _backspace() {
    final text = _codeController.text;
    if (text.isNotEmpty) {
      setState(() {
        _codeController.text = text.substring(0, text.length - 1);
        _codeController.selection = TextSelection.fromPosition(
          TextPosition(offset: _codeController.text.length),
        );
      });
    }
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData('text/plain');
    if (data?.text != null && data!.text!.trim().isNotEmpty) {
      setState(() {
        _codeController.text = data.text!.trim();
        _codeController.selection = TextSelection.fromPosition(
          TextPosition(offset: _codeController.text.length),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        top: 16,
        left: 16,
        right: 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(CupertinoIcons.barcode, color: AppTheme.primaryCyan, size: 24),
                    SizedBox(width: 8),
                    Text(
                      'Enter Barcode / SKU',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(CupertinoIcons.xmark_circle_fill, color: Colors.white60, size: 22),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Barcode Input Box with Paste and Clear buttons
            TextField(
              controller: _codeController,
              focusNode: _focusNode,
              autofocus: true,
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submitCode(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                letterSpacing: 1.5,
                fontWeight: FontWeight.bold,
              ),
              decoration: InputDecoration(
                hintText: 'Type or paste barcode...',
                hintStyle: const TextStyle(color: AppTheme.textTertiary, fontSize: 14, letterSpacing: 0),
                prefixIcon: const Icon(CupertinoIcons.viewfinder, color: AppTheme.primaryCyan),
                suffixIcon: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_codeController.text.isNotEmpty)
                      IconButton(
                        icon: const Icon(CupertinoIcons.clear_circled_solid, color: Colors.white54, size: 18),
                        onPressed: () => setState(() => _codeController.clear()),
                      ),
                    IconButton(
                      icon: const Icon(CupertinoIcons.doc_on_clipboard_fill, color: AppTheme.primaryCyan, size: 20),
                      tooltip: 'Paste from clipboard',
                      onPressed: _pasteFromClipboard,
                    ),
                  ],
                ),
                filled: true,
                fillColor: AppTheme.cardBackground,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  borderSide: const BorderSide(color: AppTheme.borderColor),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  borderSide: const BorderSide(color: AppTheme.primaryCyan, width: 2),
                ),
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            // Compact Rapid Keypad for iPhone 7
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.cardBackground,
                borderRadius: BorderRadius.circular(AppTheme.radiusM),
                border: Border.all(color: AppTheme.borderColor),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      _buildKey('1'),
                      _buildKey('2'),
                      _buildKey('3'),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _buildKey('4'),
                      _buildKey('5'),
                      _buildKey('6'),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _buildKey('7'),
                      _buildKey('8'),
                      _buildKey('9'),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _buildActionKey(
                        icon: CupertinoIcons.clear,
                        label: 'CLR',
                        color: Colors.redAccent.withOpacity(0.2),
                        textColor: Colors.redAccent,
                        onTap: () => setState(() => _codeController.clear()),
                      ),
                      _buildKey('0'),
                      _buildActionKey(
                        icon: CupertinoIcons.delete_left,
                        label: '',
                        color: Colors.white10,
                        textColor: Colors.white70,
                        onTap: _backspace,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Submit Button
            SizedBox(
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryCyan,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM)),
                ),
                icon: const Icon(CupertinoIcons.checkmark_alt, size: 20),
                label: const Text(
                  'Lookup / Add Barcode',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                onPressed: _codeController.text.trim().isNotEmpty ? _submitCode : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKey(String label) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: InkWell(
          onTap: () => _appendDigit(label),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionKey({
    required IconData icon,
    required String label,
    required Color color,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 16, color: textColor),
                if (label.isNotEmpty) ...[
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
