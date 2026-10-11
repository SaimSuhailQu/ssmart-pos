import 'package:flutter/material.dart';

import '../../../core/commands/ai_interpreter.dart';
import '../../../core/theme/graphite_theme.dart';
import '../../../core/widgets/pressable.dart';

/// Quick Entry settings: Gemini API key for the AI fallback.
///
/// The key is stored in the iOS keychain / Android keystore via
/// flutter_secure_storage — never in plain prefs, never in the repo.
/// Get a free key at https://aistudio.google.com/apikey
class QuickEntrySettingsScreen extends StatefulWidget {
  const QuickEntrySettingsScreen({super.key});

  @override
  State<QuickEntrySettingsScreen> createState() =>
      _QuickEntrySettingsScreenState();
}

class _QuickEntrySettingsScreenState extends State<QuickEntrySettingsScreen> {
  final _ctrl = TextEditingController();
  bool _hasKey = false;
  bool _saving = false;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    AiCommandInterpreter.getApiKey().then((k) {
      if (!mounted) return;
      setState(() {
        _hasKey = k != null && k.isNotEmpty;
        if (_hasKey) _ctrl.text = k!;
      });
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    await AiCommandInterpreter.saveApiKey(_ctrl.text);
    if (!mounted) return;
    setState(() {
      _saving = false;
      _hasKey = _ctrl.text.trim().isNotEmpty;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Gemini key saved in secure storage')),
    );
  }

  Future<void> _clear() async {
    await AiCommandInterpreter.clearApiKey();
    if (!mounted) return;
    setState(() {
      _hasKey = false;
      _ctrl.clear();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GraphiteTheme.graphiteDeep,
      appBar: AppBar(
        backgroundColor: GraphiteTheme.graphiteDeep,
        title: const Text('Quick Entry Settings'),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Gemini API key',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            const Text(
              'Powers the "Try AI" fallback when the built-in parser can\'t '
              'understand a command. Free tier is plenty for shop use.\n'
              'Get one at aistudio.google.com/apikey\n\n'
              'Privacy: only the command text and your customer/vendor names '
              'are sent to Gemini, and only when you tap "Try AI". Stored in '
              'the phone\'s secure keychain, never in the app\'s files.',
              style: TextStyle(color: Colors.white54, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _ctrl,
              obscureText: _obscure,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'AIza…',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                filled: true,
                fillColor: GraphiteTheme.graphiteCard,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none),
                suffixIcon: IconButton(
                  icon: Icon(
                      _obscure ? Icons.visibility : Icons.visibility_off,
                      color: Colors.white54),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Pressable(
                    onTap: _save,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD4AF37),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.black, strokeWidth: 2))
                            : Text(_hasKey ? 'Update key' : 'Save key',
                                style: const TextStyle(
                                    color: Colors.black,
                                    fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ),
                ),
                if (_hasKey) ...[
                  const SizedBox(width: 10),
                  Pressable(
                    onTap: _clear,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 18),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: const Color(0xFFEF4444).withOpacity(0.5)),
                      ),
                      child: const Text('Remove',
                          style: TextStyle(color: Color(0xFFEF4444))),
                    ),
                  ),
                ],
              ],
            ),
            if (_hasKey)
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Row(
                  children: [
                    Icon(Icons.check_circle,
                        size: 16, color: Color(0xFF34D399)),
                    SizedBox(width: 6),
                    Text('AI fallback is active',
                        style: TextStyle(
                            color: Color(0xFF34D399), fontSize: 13)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
