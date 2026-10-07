import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// The signature Noir Graphite hero: today's collection in big bold red serif
/// numerals, counting up on appearance, over a deep crimson-lit gradient.
///
/// Structure: eyebrow + copy chip → numeral → delta row → hairline →
/// metric trio (bills / avg / date) → long-press hint. The card is fully
/// tappable for the copy action (haptic + snackbar on long-press).
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

class _GraphiteHeroCardState extends State<GraphiteHeroCard>
    with SingleTickerProviderStateMixin {
  double _from = 0;
  double _to = 0;
  late final AnimationController _shimmer;

  @override
  void initState() {
    super.initState();
    // Count up shortly after first frame so the entrance feels alive.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _to = widget.revenue);
    });
    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3200),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmer.dispose();
    super.dispose();
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
        decoration: GraphiteTheme.platinumCardDecoration.copyWith(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF241014), // deep crimson-tinted graphite
              GraphiteTheme.graphiteCard,
              GraphiteTheme.graphiteCardEnd,
            ],
            stops: [0.0, 0.45, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Ambient crimson glow, top-right
            Positioned(
              top: -80,
              right: -60,
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      GraphiteTheme.redAccent.withValues(alpha: 0.16),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Faint counter-glow, bottom-left (depth)
            Positioned(
              bottom: -90,
              left: -70,
              child: Container(
                width: 190,
                height: 190,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      GraphiteTheme.platinum.withValues(alpha: 0.05),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Animated sheen sweeping across the numeral zone
            Positioned.fill(
              child: AnimatedBuilder(
                animation: _shimmer,
                builder: (context, _) {
                  final t = _shimmer.value;
                  return Align(
                    alignment: Alignment(-2.2 + t * 4.4, -0.6),
                    child: Transform.rotate(
                      angle: 0.35,
                      child: Container(
                        width: 90,
                        height: 300,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              GraphiteTheme.redBright.withValues(alpha: 0.05),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
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
                      GraphiteTheme.redAccent.withValues(alpha: 0.55),
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'TODAY\'S COLLECTION',
                          style: GraphiteTheme.eyebrow,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(
                        CupertinoIcons.lock_shield_fill,
                        size: 13,
                        color: GraphiteTheme.redAccent,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Animated counting numeral. FittedBox guards the card
                  // against horizontal overflow on very large amounts.
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: _from, end: _to),
                    duration: const Duration(milliseconds: 1100),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) {
                      return FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: RichText(
                          text: TextSpan(
                            style: GraphiteTheme.heroAmount,
                            children: [
                              TextSpan(
                                text: 'PKR  ',
                                style: GraphiteTheme.heroCurrency,
                              ),
                              TextSpan(
                                text: _formatCompact(value),
                                style: GraphiteTheme.heroAmount.copyWith(
                                  shadows: [
                                    Shadow(
                                      color:
                                          GraphiteTheme.redAccent.withValues(alpha: 0.45),
                                      blurRadius: 26,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
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
                            color: GraphiteTheme.redSoft,
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
              color: GraphiteTheme.redSoft,
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
      color: GraphiteTheme.redAccent.withValues(alpha: 0.2),
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
