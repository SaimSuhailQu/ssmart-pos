import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/commands/command_parser.dart';
import '../../../core/commands/ai_interpreter.dart';
import '../../../core/theme/graphite_theme.dart';
import '../../../core/widgets/pressable.dart';
import '../../../core/widgets/success_overlay.dart';
import '../../../core/widgets/haptics.dart';
import '../../../services/firebase_service.dart';
import 'quick_entry_settings_screen.dart';

/// Quick Entry — type a shop-floor command, see the live interpretation,
/// confirm to execute. Opened from the dashboard or via widget deep link
/// (ssmartpos://quick-entry?action=loan).
///
/// SAFETY: nothing is written until the user taps Confirm on the preview.
/// The parser only describes intent; execution uses the same Firebase write
/// paths as the manual screens.
class QuickEntryScreen extends StatefulWidget {
  /// Pre-selected action from a widget button ('loan'|'wasool'|'order'|'expense').
  final String? initialAction;

  const QuickEntryScreen({super.key, this.initialAction});

  static CommandAction? actionFromString(String? s) {
    switch (s) {
      case 'loan':
        return CommandAction.khataLoan;
      case 'wasool':
        return CommandAction.khataWasool;
      case 'order':
        return CommandAction.vendorOrder;
      case 'expense':
        return CommandAction.expense;
      default:
        return null;
    }
  }

  @override
  State<QuickEntryScreen> createState() => _QuickEntryScreenState();
}

class _QuickEntryScreenState extends State<QuickEntryScreen> {
  final _ctrl = TextEditingController();
  final _parser = CommandParser();
  final _focus = FocusNode();
  Timer? _debounce;

  ParsedCommand? _parsed;
  List<NameEntry> _customers = [];
  List<NameEntry> _vendors = [];
  bool _loadingNames = true;
  bool _executing = false;
  bool _aiThinking = false;
  bool _aiUsed = false;
  String? _aiError;
  String? _chosenCandidate; // disambiguation override

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(_onTextChanged);
    _loadNames();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  Future<void> _loadNames() async {
    try {
      final svc = context.read<FirebaseService>();
      final customers = await svc.getCustomersStream().first;
      final vendors = await svc.getVendorsStream().first;
      if (!mounted) return;
      setState(() {
        _customers = customers
            .map((c) => NameEntry(c.key.isNotEmpty ? c.key : c.id, c.name))
            .toList();
        _vendors = vendors
            .map((v) => NameEntry(v.key.isNotEmpty ? v.key : v.id.toString(), v.name))
            .toList();
        _loadingNames = false;
      });
      _reparse();
    } catch (_) {
      if (mounted) setState(() => _loadingNames = false);
    }
  }

  void _onTextChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _reparse);
  }

  void _reparse() {
    final hint = QuickEntryScreen.actionFromString(widget.initialAction);
    var parsed = _parser.parse(
      _ctrl.text,
      customers: _customers,
      vendors: _vendors,
      actionHint: hint,
    );
    // candidate override from disambiguation tap
    if (_chosenCandidate != null && parsed.candidates.contains(_chosenCandidate)) {
      final pool = parsed.action == CommandAction.vendorOrder ? _vendors : _customers;
      final alt = pool.firstWhere((e) => e.name == _chosenCandidate,
          orElse: () => NameEntry('', ''));
      if (alt.id.isNotEmpty) {
        parsed = ParsedCommand(
          action: parsed.action,
          entityName: alt.name,
          entityId: alt.id,
          amount: parsed.amount,
          preview: parsed.preview.replaceFirst(
              parsed.entityName ?? '', alt.name),
          confident: true,
        );
      }
    } else if (_chosenCandidate != null) {
      _chosenCandidate = null; // text changed, reset
    }
    if (mounted) {
      setState(() {
        _parsed = parsed;
        // any new keystroke invalidates a previous AI result
        if (_aiUsed) {
          _aiUsed = false;
          _aiError = null;
        }
      });
    }
  }

  /// AI fallback: only when rules aren't confident. Manual tap to avoid
  /// spamming the API on every keystroke.
  Future<void> _tryAi() async {
    if (_aiThinking) return;
    setState(() { _aiThinking = true; _aiError = null; });
    try {
      final hint = QuickEntryScreen.actionFromString(widget.initialAction);
      final ai = await AiCommandInterpreter.interpret(
        _ctrl.text,
        customers: _customers,
        vendors: _vendors,
      );
      if (!mounted) return;
      if (ai == null) {
        setState(() => _aiError = 'AI could not understand that. Try rephrasing.');
        return;
      }
      // Run the AI's raw name through the SAME fuzzy matcher + safety rules.
      var parsed = _parser.parse(
        '${ai.rawName} ${ai.action == CommandAction.khataLoan ? 'loan' : ai.action == CommandAction.khataWasool ? 'wasool' : ai.action == CommandAction.vendorOrder ? 'order' : 'kharcha'} ${ai.amount}',
        customers: _customers,
        vendors: _vendors,
        actionHint: hint ?? ai.action,
      );
      if (!parsed.confident && ai.action == CommandAction.expense) {
        parsed = ParsedCommand(
          action: CommandAction.expense,
          entityName: ai.rawName.isEmpty ? 'expense' : ai.rawName,
          amount: ai.amount,
          preview: 'Record Rs ${ai.amount} expense (${ai.rawName})',
          confident: true,
        );
      }
      setState(() {
        _parsed = parsed;
        _aiUsed = parsed.confident;
        if (!parsed.confident) _aiError = 'AI understood it, but I can\'t match the name. ${parsed.preview}';
      });
    } on AiAuthException {
      if (mounted) setState(() => _aiError = 'Gemini key rejected — check it in Settings.');
    } catch (_) {
      if (mounted) setState(() => _aiError = 'AI request failed (offline?).');
    } finally {
      if (mounted) setState(() => _aiThinking = false);
    }
  }

  Future<void> _execute() async {
    final p = _parsed;
    if (p == null || !p.confident || _executing) return;
    setState(() => _executing = true);
    try {
      final svc = context.read<FirebaseService>();
      switch (p.action) {
        case CommandAction.khataLoan:
        case CommandAction.khataWasool:
          // look up current balance for the authoritative write
          final customers = await svc.getCustomersStream().first;
          final cust = customers.firstWhere(
            (c) => (c.key.isNotEmpty ? c.key : c.id) == p.entityId,
            orElse: () => customers.firstWhere((c) => c.name == p.entityName),
          );
          await svc.recordKhataTransaction(
            customerId: cust.key.isNotEmpty ? cust.key : cust.id,
            customerName: cust.name,
            currentBalance: cust.balance,
            amount: p.amount!,
            type: p.action == CommandAction.khataLoan ? 'LOAN' : 'PAYMENT',
            paymentMethod: 'Cash',
            notes: 'Quick entry: ${_ctrl.text.trim()}',
          );
          break;
        case CommandAction.vendorOrder:
          await svc.saveVendorPurchaseOrder(
            vendorName: p.entityName!,
            totalAmount: p.amount!,
            paidAmount: 0,
            paymentStatus: 'unpaid',
            status: 'pending',
            notes: 'Quick entry: ${_ctrl.text.trim()}',
          );
          break;
        case CommandAction.expense:
          await svc.addExpense(
            amount: p.amount!,
            description: p.entityName ?? _ctrl.text.trim(),
            category: 'Quick entry',
          );
          break;
        case CommandAction.unknown:
          return;
      }
      if (!mounted) return;
      Haptics.success();
      await showSuccessOverlay(context, message: p.preview);
      _ctrl.clear();
      setState(() {
        _parsed = null;
        _chosenCandidate = null;
      });
    } catch (e) {
      if (!mounted) return;
      Haptics.error();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _executing = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = _parsed;
    return Scaffold(
      backgroundColor: GraphiteTheme.graphiteDeep,
      appBar: AppBar(
        backgroundColor: GraphiteTheme.graphiteDeep,
        title: const Text('Quick Entry'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white54),
            tooltip: 'Quick Entry settings',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const QuickEntrySettingsScreen()),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _ctrl,
              focusNode: _focus,
              style: const TextStyle(color: Colors.white, fontSize: 17),
              decoration: InputDecoration(
                hintText: 'e.g. jamshad mamu loan 700',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.35)),
                filled: true,
                fillColor: GraphiteTheme.graphiteCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                prefixIcon:
                    const Icon(Icons.bolt, color: Color(0xFFD4AF37)),
                suffixIcon: _ctrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.white54),
                        onPressed: () {
                          _ctrl.clear();
                          setState(() {
                            _parsed = null;
                            _chosenCandidate = null;
                          });
                        },
                      )
                    : null,
              ),
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _execute(),
            ),
            const SizedBox(height: 12),
            if (_loadingNames)
              const Center(
                  child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ))
            else if (p != null && _ctrl.text.trim().isNotEmpty)
              _buildPreview(p),
            const Spacer(),
            if (p != null && p.confident)
              Pressable(
                onTap: _execute,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD4AF37),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: _executing
                      ? const Center(
                          child: SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                  color: Colors.black, strokeWidth: 2)))
                      : const Text(
                          'Confirm & Save',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: Colors.black,
                              fontSize: 16,
                              fontWeight: FontWeight.bold),
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreview(ParsedCommand p) {
    final ok = p.confident;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GraphiteTheme.graphiteCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: ok
              ? const Color(0xFF34D399).withOpacity(0.4)
              : const Color(0xFFFBBF24).withOpacity(0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                ok ? Icons.check_circle : Icons.help_outline,
                size: 18,
                color: ok ? const Color(0xFF34D399) : const Color(0xFFFBBF24),
              ),
              const SizedBox(width: 8),
              const Text('Live preview',
                  style: TextStyle(color: Colors.white54, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            ok ? '→ ${p.preview}' : p.preview,
            style: const TextStyle(color: Colors.white, fontSize: 15),
          ),
          if (_aiUsed)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('✨ understood with AI — review before confirming',
                  style: TextStyle(color: Color(0xFFD4AF37), fontSize: 12)),
            ),
          if (!ok && !_aiThinking) ...[
            const SizedBox(height: 10),
            FutureBuilder<bool>(
              future: AiCommandInterpreter.isEnabled,
              builder: (context, snap) {
                if (snap.data != true) {
                  return Pressable(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) =>
                              const QuickEntrySettingsScreen()),
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: Colors.white.withOpacity(0.2)),
                      ),
                      child: const Text(
                          '✨ Add Gemini API key to enable AI help',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 13)),
                    ),
                  );
                }
                return Pressable(
                  onTap: _tryAi,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: const Color(0xFFD4AF37).withOpacity(0.5)),
                    ),
                    child: const Text('✨ Try AI interpretation',
                        style: TextStyle(
                            color: Color(0xFFD4AF37),
                            fontWeight: FontWeight.w600)),
                  ),
                );
              },
            ),
          ],
          if (_aiThinking)
            const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 8),
                  Text('Asking AI…',
                      style: TextStyle(color: Colors.white54, fontSize: 12)),
                ],
              ),
            ),
          if (_aiError != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_aiError!,
                  style:
                      const TextStyle(color: Color(0xFFFBBF24), fontSize: 12)),
            ),
          if (p.candidates.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text('Did you mean?',
                style: TextStyle(color: Colors.white54, fontSize: 12)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: p.candidates
                  .map((c) => ChoiceChip(
                        label: Text(c),
                        selected: _chosenCandidate == c,
                        onSelected: (_) {
                          setState(() => _chosenCandidate = c);
                          _reparse();
                        },
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}
