/// Natural-language command parser for Quick Entry.
///
/// Turns shop-floor shorthand into structured actions:
///   "jamshad mamu loan 700"   -> khata LOAN  Rs 700 to Jamshad Mamu
///   "wasool jamshad mamu 700" -> khata PAYMENT Rs 700 from Jamshad Mamu
///   "walls merchant order 7000" -> vendor PO Rs 7,000 (unpaid)
///   "electricity bill kharcha 2500" -> expense Rs 2,500
///
/// Rule-based (not AI): keyword + fuzzy name + trailing amount. English and
/// Roman-Urdu keywords both work. Pure Dart — no Flutter dependency, so it
/// is unit-testable. NEVER executes anything; it only describes intent.
/// The UI must always show [preview] and get explicit confirm before writing.
library;

enum CommandAction {
  khataLoan, // udhaar diya — customer owes more
  khataWasool, // wasool hua — payment received, customer owes less
  vendorOrder, // purchase order to a vendor (unpaid -> payable)
  expense, // shop expense
  unknown,
}

class ParsedCommand {
  final CommandAction action;
  final String? entityName; // best fuzzy match (customer or vendor name)
  final String? entityId; // matched record id/key when available
  final List<String> candidates; // other close matches (disambiguation)
  final double? amount;
  final String preview; // human sentence, e.g. "Add Rs 700 loan to Jamshad Mamu"
  final bool confident; // true only when action + entity + amount all resolved

  const ParsedCommand({
    required this.action,
    this.entityName,
    this.entityId,
    this.candidates = const [],
    this.amount,
    required this.preview,
    required this.confident,
  });

  factory ParsedCommand.unknown(String why) => ParsedCommand(
        action: CommandAction.unknown,
        preview: why,
        confident: false,
      );
}

/// A named record the parser can match against (customer or vendor).
class NameEntry {
  final String id; // record key for writes
  final String name;
  const NameEntry(this.id, this.name);
}

class CommandParser {
  static const loanWords = {
    'loan', 'udhaar', 'udhar', 'qarza', 'qarz', 'diya', 'debit'
  };
  static const wasoolWords = {
    'wasool', 'wasuli', 'vasool', 'received', 'receive', 'collection',
    'jama', 'payment received', 'liya'
  };
  static const orderWords = {'order', 'po', 'purchase', 'maal', 'stock'};
  static const expenseWords = {
    'expense', 'kharcha', 'kharch', 'bill', 'bills', 'rent', 'salary',
    'utilities', 'chaai', 'chai'
  };

  /// Parse [raw] against known [customers] and [vendors].
  ///
  /// If [actionHint] is given (e.g. from a widget button) and the text
  /// contains no action keyword of its own, the hint wins.
  ParsedCommand parse(
    String raw, {
    List<NameEntry> customers = const [],
    List<NameEntry> vendors = const [],
    CommandAction? actionHint,
  }) {
    final text = raw.trim();
    if (text.isEmpty) {
      return ParsedCommand.unknown('Type a command, e.g. "jamshad mamu loan 700"');
    }

    // 1. amount = last number-like token (supports 700 / 7,000 / 7000.50)
    final amountMatch =
        RegExp(r'(\d[\d,]*(\.\d{1,2})?)\s*$').firstMatch(text);
    if (amountMatch == null) {
      return ParsedCommand.unknown('No amount found — end with a number, e.g. "… 700"');
    }
    final amount =
        double.tryParse(amountMatch.group(1)!.replaceAll(',', ''));
    if (amount == null || amount <= 0) {
      return ParsedCommand.unknown('Could not read the amount.');
    }
    var rest = text.substring(0, amountMatch.start).trim().toLowerCase();
    if (rest.isEmpty) {
      return ParsedCommand.unknown('Who is this for? Add a name, e.g. "jamshad mamu loan 700"');
    }

    // 2. action keyword (may appear anywhere); fall back to hint
    var action = _detectAction(rest);
    if (action == CommandAction.unknown && actionHint != null) {
      action = actionHint;
    }
    if (action == CommandAction.unknown) {
      return ParsedCommand.unknown(
          'Unknown action — use loan/udhaar, wasool, order, or kharcha.');
    }
    // strip action words so only the name remains
    rest = _stripKeywords(rest);

    // 3. entity name via fuzzy match (customers for khata, vendors for order)
    final pool = action == CommandAction.vendorOrder ? vendors : customers;
    final namePart = rest.trim();
    if (namePart.isEmpty && action != CommandAction.expense) {
      return ParsedCommand.unknown('Who is this for? Add a name.');
    }
    NameEntry? match;
    List<String> candidates = [];
    if (action != CommandAction.expense && pool.isNotEmpty) {
      final scored = _rankMatches(namePart, pool);
      if (scored.isEmpty) {
        return ParsedCommand.unknown(
            'No match for "$namePart" — check the spelling or add them first.');
      }
      match = scored.first;
      candidates = scored.skip(1).take(2).map((e) => e.name).toList();
    }

    // 4. build preview
    final amt = _fmt(amount);
    switch (action) {
      case CommandAction.khataLoan:
        return ParsedCommand(
          action: action,
          entityName: match?.name,
          entityId: match?.id,
          candidates: candidates,
          amount: amount,
          preview: 'Add Rs $amt loan to ${match!.name}\u2019s khata',
          confident: true,
        );
      case CommandAction.khataWasool:
        return ParsedCommand(
          action: action,
          entityName: match?.name,
          entityId: match?.id,
          candidates: candidates,
          amount: amount,
          preview: 'Record Rs $amt received (wasool) from ${match!.name}',
          confident: true,
        );
      case CommandAction.vendorOrder:
        return ParsedCommand(
          action: action,
          entityName: match?.name,
          entityId: match?.id,
          candidates: candidates,
          amount: amount,
          preview: 'Create Rs $amt purchase order to ${match!.name} (unpaid)',
          confident: true,
        );
      case CommandAction.expense:
        final label = namePart.isEmpty ? 'expense' : namePart;
        return ParsedCommand(
          action: action,
          entityName: label,
          amount: amount,
          preview: 'Record Rs $amt expense ($label)',
          confident: true,
        );
      case CommandAction.unknown:
        return ParsedCommand.unknown('Unknown action.');
    }
  }

  CommandAction _detectAction(String rest) {
    bool has(Set<String> words) =>
        words.any((w) => RegExp(r'\b' + RegExp.escape(w) + r'\b').hasMatch(rest));
    // check multi-word phrases first
    if (rest.contains('payment received')) return CommandAction.khataWasool;
    if (has(loanWords)) return CommandAction.khataLoan;
    if (has(wasoolWords)) return CommandAction.khataWasool;
    if (has(orderWords)) return CommandAction.vendorOrder;
    if (has(expenseWords)) return CommandAction.expense;
    return CommandAction.unknown;
  }

  String _stripKeywords(String rest) {
    var out = ' $rest ';
    for (final w in {...loanWords, ...wasoolWords, ...orderWords, ...expenseWords}) {
      out = out.replaceAll(RegExp(r'\b' + RegExp.escape(w) + r'\b'), ' ');
    }
    return out.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  /// Rank pool by similarity to [query]; returns best-first matches above bar.
  List<NameEntry> _rankMatches(String query, List<NameEntry> pool) {
    final q = _norm(query);
    final scored = <(NameEntry, double)>[];
    for (final e in pool) {
      final n = _norm(e.name);
      double s;
      if (n == q) {
        s = 1.0;
      } else if (n.contains(q) || q.contains(n)) {
        s = 0.85; // substring hit ("jamshad" ~ "Jamshad Mamu")
      } else {
        s = _similarity(q, n);
      }
      if (s >= 0.55) scored.add((e, s));
    }
    scored.sort((a, b) => b.$2.compareTo(a.$2));
    return scored.map((e) => e.$1).toList();
  }

  String _norm(String s) =>
      s.toLowerCase().replaceAll(RegExp(r'[^a-z ]'), '').replaceAll(RegExp(r'\s+'), ' ').trim();

  /// Jaro-Winkler-ish: token overlap + edit distance blend, 0..1.
  double _similarity(String a, String b) {
    if (a.isEmpty || b.isEmpty) return 0;
    final at = a.split(' ').toSet(), bt = b.split(' ').toSet();
    final overlap = at.intersection(bt).length / at.union(bt).length;
    final dist = _lev(a, b);
    final edit = 1.0 - dist / (a.length > b.length ? a.length : b.length);
    return overlap * 0.6 + edit * 0.4;
  }

  int _lev(String a, String b) {
    final m = a.length, n = b.length;
    var prev = List.generate(n + 1, (j) => j);
    for (var i = 1; i <= m; i++) {
      var curr = [i, ...List.filled(n, 0)];
      for (var j = 1; j <= n; j++) {
        curr[j] = a[i - 1] == b[j - 1]
            ? prev[j - 1]
            : 1 + [prev[j], curr[j - 1], prev[j - 1]].reduce((x, y) => x < y ? x : y);
      }
      prev = curr;
    }
    return prev[n];
  }

  String _fmt(double v) =>
      v.toStringAsFixed(v.truncateToDouble() == v ? 0 : 2);
}
