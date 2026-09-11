import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/services/firebase_service.dart';

class ManualClosingDialog extends StatefulWidget {
  final DateTime? initialDate;
  final double? initialTotal;
  final double? initialCash;
  final double? initialOnline;
  final String? initialNotes;

  const ManualClosingDialog({
    super.key,
    this.initialDate,
    this.initialTotal,
    this.initialCash,
    this.initialOnline,
    this.initialNotes,
  });

  static Future<void> show(
    BuildContext context, {
    DateTime? initialDate,
    double? initialTotal,
    double? initialCash,
    double? initialOnline,
    String? initialNotes,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ManualClosingDialog(
        initialDate: initialDate,
        initialTotal: initialTotal,
        initialCash: initialCash,
        initialOnline: initialOnline,
        initialNotes: initialNotes,
      ),
    );
  }

  @override
  State<ManualClosingDialog> createState() => _ManualClosingDialogState();
}

class _ManualClosingDialogState extends State<ManualClosingDialog> {
  final _formKey = GlobalKey<FormState>();
  late DateTime _selectedDate;
  late final TextEditingController _totalController;
  late final TextEditingController _cashController;
  late final TextEditingController _onlineController;
  late final TextEditingController _notesController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate ?? DateTime.now();
    _totalController = TextEditingController(
      text: widget.initialTotal != null && widget.initialTotal! > 0
          ? widget.initialTotal!.toStringAsFixed(0)
          : '',
    );
    _cashController = TextEditingController(
      text: widget.initialCash != null && widget.initialCash! > 0
          ? widget.initialCash!.toStringAsFixed(0)
          : '',
    );
    _onlineController = TextEditingController(
      text: widget.initialOnline != null && widget.initialOnline! > 0
          ? widget.initialOnline!.toStringAsFixed(0)
          : '',
    );
    _notesController = TextEditingController(text: widget.initialNotes ?? '');
  }

  @override
  void dispose() {
    _totalController.dispose();
    _cashController.dispose();
    _onlineController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppTheme.primaryBlue,
              surface: AppTheme.surfaceDark,
              onSurface: AppTheme.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final total = double.tryParse(_totalController.text.trim()) ?? 0.0;
    if (total <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid total sale amount greater than 0'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
      return;
    }

    final cash = double.tryParse(_cashController.text.trim()) ?? 0.0;
    final online = double.tryParse(_onlineController.text.trim()) ?? 0.0;
    final notes = _notesController.text.trim();

    setState(() => _isLoading = true);

    try {
      final firebaseService = context.read<FirebaseService>();
      await firebaseService.saveManualDailyClosingSale(
        total: total,
        cashAmount: cash,
        onlineAmount: online,
        date: _selectedDate,
        notes: notes.isNotEmpty ? notes : null,
      );

      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ Daily closing of Rs. ${total.toStringAsFixed(2)} added successfully!'),
          backgroundColor: AppTheme.successGreen,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to save closing sale: $e'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final formattedDate =
        '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';

    return Container(
      padding: EdgeInsets.only(
        left: AppTheme.spacingM,
        right: AppTheme.spacingM,
        top: AppTheme.spacingM,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppTheme.spacingM,
      ),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusL)),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: AppTheme.spacingM),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryBlue.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          CupertinoIcons.calendar_badge_plus,
                          color: AppTheme.primaryBlue,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Add Daily Closing Sale',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(CupertinoIcons.xmark_circle, color: AppTheme.textSecondary),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Record the day\'s consolidated register sales directly into the ledger.',
                style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: AppTheme.spacingM),

              // Date Picker Field
              InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(AppTheme.radiusM),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppTheme.cardBackground,
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(CupertinoIcons.calendar, size: 18, color: AppTheme.primaryBlue),
                          const SizedBox(width: 10),
                          Text(
                            'Closing Date: $formattedDate',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const Text(
                        'Change',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.primaryBlue,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppTheme.spacingM),

              // Total Amount
              TextFormField(
                controller: _totalController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                autofocus: true,
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                decoration: InputDecoration(
                  labelText: 'Net Daily Closing Total (Rs.) *',
                  hintText: 'e.g. 85000',
                  prefixIcon: const Icon(CupertinoIcons.money_dollar_circle, color: AppTheme.successGreen),
                  filled: true,
                  fillColor: AppTheme.cardBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                    borderSide: const BorderSide(color: Colors.white12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter total closing amount';
                  }
                  final parsed = double.tryParse(value.trim());
                  if (parsed == null || parsed <= 0) {
                    return 'Enter a valid amount';
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppTheme.spacingM),

              // Breakdown: Cash & Online
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _cashController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Cash in Drawer',
                        hintText: 'Optional',
                        prefixIcon: const Icon(CupertinoIcons.money_dollar, color: AppTheme.warningOrange, size: 18),
                        filled: true,
                        fillColor: AppTheme.cardBackground,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusM),
                          borderSide: const BorderSide(color: Colors.white12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacingS),
                  Expanded(
                    child: TextFormField(
                      controller: _onlineController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Online / Card / Bank',
                        hintText: 'Optional',
                        prefixIcon: const Icon(CupertinoIcons.creditcard, color: AppTheme.primaryBlue, size: 18),
                        filled: true,
                        fillColor: AppTheme.cardBackground,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radiusM),
                          borderSide: const BorderSide(color: Colors.white12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacingM),

              // Notes
              TextFormField(
                controller: _notesController,
                maxLines: 2,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  labelText: 'Remarks / Notes',
                  hintText: 'e.g. End of day register reconciliation',
                  prefixIcon: const Icon(CupertinoIcons.pencil_ellipsis_rectangle, color: AppTheme.textSecondary, size: 18),
                  filled: true,
                  fillColor: AppTheme.cardBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                    borderSide: const BorderSide(color: Colors.white12),
                  ),
                ),
              ),
              const SizedBox(height: AppTheme.spacingL),

              // Save Button
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.successGreen,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radiusM),
                  ),
                ),
                icon: _isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : const Icon(CupertinoIcons.check_mark_circled_solid, size: 20),
                label: Text(
                  _isLoading ? 'Saving Closing...' : 'Save Daily Closing Sale',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
