import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'command_parser.dart';

/// AI fallback for Quick Entry commands the rule parser can't handle.
///
/// Hybrid design: [CommandParser] runs first (instant, offline, free). Only
/// when it is NOT confident AND the user has saved a Gemini API key does this
/// run. Uses the Gemini free tier via REST — no SDK, no extra cost to try.
///
/// Privacy: the command text plus your customer/vendor NAME lists are sent to
/// Google's Gemini API for interpretation. Amounts and names only — no other
/// shop data. Disable by clearing the key in settings.
///
/// SAFETY: output always goes through the same fuzzy name-matcher and the
/// same Confirm screen as rule-based parses. The AI never writes anything.
class AiCommandInterpreter {
  static const _storageKey = 'gemini_api_key';
  static const _storage = FlutterSecureStorage();
  static const _model = 'gemini-2.0-flash';
  static const _timeout = Duration(seconds: 12);

  /// The saved API key, or null if the user hasn't set one.
  static Future<String?> getApiKey() => _storage.read(key: _storageKey);

  static Future<void> saveApiKey(String key) =>
      _storage.write(key: _storageKey, value: key.trim());

  static Future<void> clearApiKey() => _storage.delete(key: _storageKey);

  static Future<bool> get isEnabled async {
    final k = await getApiKey();
    return k != null && k.isNotEmpty;
  }

  /// Ask Gemini to interpret [text]. Returns the extracted action/name/amount,
  /// or null when AI is unavailable, fails, or can't make sense of it.
  static Future<AiInterpretation?> interpret(
    String text, {
    List<NameEntry> customers = const [],
    List<NameEntry> vendors = const [],
  }) async {
    final apiKey = await getApiKey();
    if (apiKey == null || apiKey.isEmpty) return null;

    final prompt = _buildPrompt(text, customers, vendors);
    try {
      final res = await http
          .post(
            Uri.parse(
                'https://generativelanguage.googleapis.com/v1beta/models/$_model:generateContent?key=$apiKey'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'contents': [
                {
                  'parts': [
                    {'text': prompt}
                  ]
                }
              ],
              'generationConfig': {
                'temperature': 0.1,
                'maxOutputTokens': 200,
              },
            }),
          )
          .timeout(_timeout);

      if (res.statusCode == 401 || res.statusCode == 403) {
        throw AiAuthException();
      }
      if (res.statusCode != 200) return null;

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final parts = (body['candidates'] as List?)?.firstOrNull
          ?['content']?['parts'] as List?;
      final raw = (parts?.firstOrNull?['text'] as String?) ?? '';
      return _parseResponse(raw);
    } on AiAuthException {
      rethrow;
    } catch (_) {
      return null; // offline, timeout, bad JSON — caller falls back to rules
    }
  }

  static String _buildPrompt(
      String text, List<NameEntry> customers, List<NameEntry> vendors) {
    final custNames = customers.map((e) => e.name).take(80).join(', ');
    final vendNames = vendors.map((e) => e.name).take(80).join(', ');
    return '''
You interpret short shop-accounting commands (English / Roman Urdu mix).
Return JSON ONLY, no other text, no markdown, exactly this shape:
{"action":"loan|wasool|order|expense","name":"<person or vendor or expense label>","amount":123.45}

Actions:
- "loan": udhaar diya — customer takes goods on credit (they owe MORE). Keywords: loan, udhaar, udhar, qarza.
- "wasool": payment RECEIVED from customer (they owe LESS). Keywords: wasool, received, jama.
- "order": purchase order TO a vendor (shop owes vendor). Keywords: order, maal.
- "expense": shop kharcha (rent, bills, salary, chai).

Rules:
- amount is a number, no commas, no currency words.
- name: use the exact spelling from the known lists below when it matches someone; otherwise copy what the user wrote.
- If the command is nonsense, return {"action":"unknown","name":"","amount":0}.

Known customers: $custNames
Known vendors: $vendNames

Command: "$text"''';
  }

  static AiInterpretation? _parseResponse(String raw) {
    final m = RegExp(r'\{[^}]*\}').firstMatch(raw);
    if (m == null) return null;
    try {
      final j = jsonDecode(m.group(0)!) as Map<String, dynamic>;
      final action = switch ((j['action'] as String?)?.toLowerCase()) {
        'loan' => CommandAction.khataLoan,
        'wasool' => CommandAction.khataWasool,
        'order' => CommandAction.vendorOrder,
        'expense' => CommandAction.expense,
        _ => CommandAction.unknown,
      };
      if (action == CommandAction.unknown) return null;
      final amount = (j['amount'] as num?)?.toDouble();
      if (amount == null || amount <= 0) return null;
      return AiInterpretation(
        action: action,
        rawName: (j['name'] as String? ?? '').trim(),
        amount: amount,
      );
    } catch (_) {
      return null;
    }
  }
}

class AiInterpretation {
  final CommandAction action;
  final String rawName;
  final double amount;
  const AiInterpretation(
      {required this.action, required this.rawName, required this.amount});
}

class AiAuthException implements Exception {}
