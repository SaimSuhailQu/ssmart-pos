import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// The signature Noir Graphite hero: today's revenue in big bold serif
/// numerals, counting up on appearance, with a text delta row.
///
/// Refined vs Executive: eyebrow → numeral → delta text → hairline divider →
/// meta row. No filled pills; bold type and hairlines do the talking.
///
/// Gestures:
///   - long-press: copies a plain-text daily summary to clipboard (haptic +
///     snackbar confirmation). The shop owner does this every evening.
class GraphiteHeroCard extends StatefulWidget {
  final double revenue;
  final int orderCount;
  final double averageOrder;
  final double deltaPct; // vs yesterday, e.g. 12.4
  final String dateLabel;
  final VoidCallback onCopySummary;

  const GraphiteHeroCard({
    super.key,
    required this.revenue,
    required this.orderCount,
    required this.averageOrder,
    required this.deltaPct,
    required this.dateLabel,
    required this.onCopySummary,
  });

  @override
  State<GraphiteHeroCard> createState() => _GraphiteHeroCardState();
}

class _GraphiteHeroCardState extends State<GraphiteHeroCard> {
  double _from = 0;
  double _to = 0;

  @override
  void initState() {
    super.initState();
    // Count up shortly after first frame so the entrance feels alive.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _to = widget.revenue);
    });
  }

  @override
  void didUpdateWidget(GraphiteHeroCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.revenue != oldWidget.revenue) {
      setState(() {
        _from = _to;
        _to = widget.revenue;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final deltaPositive = widget.deltaPct >= 0;
    return GestureDetector(
      onLongPress: () async {
        await Haptics.medium();
        widget.onCopySummary();
      },
      child: Container(
        decoration: GraphiteTheme.platinumCardDecoration,
        child: Stack(
          children: [
            // Ambient platinum glow, top-right
            Positioned(
              top: -70,
              right: -70,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      GraphiteTheme.platinum.withValues(alpha: 0.1),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Top hairline highlight
            Positioned(
              top: 0,
              left: 40,
              right: 40,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      GraphiteTheme.platinum.withValues(alpha: 0.5),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('TODAY\'S COLLECTION', style: GraphiteTheme.eyebrow),
                  const SizedBox(height: 10),
                  // Animated counting numeral
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: _from, end: _to),
                    duration: const Duration(milliseconds: 1100),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) {
                      return RichText(
                        text: TextSpan(
                          children: [
                            TextSpan(
                              text: 'RS  ',
                              style: GraphiteTheme.heroCurrency,
                            ),
                            TextSpan(
                              text: _formatCompact(value),
                              style: GraphiteTheme.heroAmount,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  // Delta as bold text — no pill in graphite
                  RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text:
                              '${deltaPositive ? '▲' : '▼'} ${widget.deltaPct.abs().toStringAsFixed(1)}%  ',
                          style: deltaPositive
                              ? GraphiteTheme.deltaUp.copyWith(fontSize: 13)
                              : GraphiteTheme.deltaDown.copyWith(fontSize: 13),
                        ),
                        TextSpan(
                          text: 'vs yesterday',
                          style: GraphiteTheme.deltaDown.copyWith(fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    height: 1,
                    decoration: GraphiteTheme.platinumDivider,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _meta('${widget.orderCount}', 'bills'),
                      _metaDivider(),
                      _meta('avg', 'Rs ${widget.averageOrder.toStringAsFixed(0)}'),
                      _metaDivider(),
                      Expanded(
                        child: Text(
                          widget.dateLabel,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: GraphiteTheme.slate,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(
                        CupertinoIcons.hand_draw,
                        size: 11,
                        color: GraphiteTheme.slateDim,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Long-press to copy closing summary',
                        style: AppTheme.labelSmall.copyWith(
                          fontSize: 10,
                          color: GraphiteTheme.slateDim,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _meta(String bold, String rest) {
    return RichText(
      text: TextSpan(
        children: [
          TextSpan(
            text: '$bold ',
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: GraphiteTheme.ink,
            ),
          ),
          TextSpan(
            text: rest,
            style: const TextStyle(
              fontSize: 11.5,
              color: GraphiteTheme.slate,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaDivider() {
    return Container(
      width: 1,
      height: 12,
      color: GraphiteTheme.platinum.withValues(alpha: 0.14),
      margin: const EdgeInsets.symmetric(horizontal: 12),
    );
  }

  String _formatCompact(double value) {
    final whole = value.round();
    final s = whole.toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}
