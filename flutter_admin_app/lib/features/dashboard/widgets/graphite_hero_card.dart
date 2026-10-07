import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/graphite_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';
import 'package:ssmart_pos_admin/core/widgets/pressable.dart';
import 'package:ssmart_pos_admin/core/widgets/sparkline.dart';

/// The signature Noir Graphite hero: today's collection in big bold
/// grotesque-sans (Inter ExtraBold — the professional Arial-style numeral),
/// counting up on appearance, with a delta pill and an intraday sparkline.
///
/// Structure: eyebrow badge → numeral → delta pill → sparkline →
/// metric trio (bills / avg / date) → long-press hint. Long-press copies
/// the closing summary (haptic + callback).
class GraphiteHeroCard extends StatefulWidget {
  final double revenue;
  final int orderCount;
  final double averageOrder;
  final double deltaPct; // vs yesterday, e.g. 12.4
  final String dateLabel;
  final List<double> hourlyRevenue; // intraday buckets for the sparkline
  final VoidCallback onCopySummary;

  const GraphiteHeroCard({
    super.key,
    required this.revenue,
    required this.orderCount,
    required this.averageOrder,
    required this.deltaPct,
    required this.dateLabel,
    this.hourlyRevenue = const [],
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
    final d = widget.deltaPct;
    final DeltaDirection dir = d > 0
        ? DeltaDirection.up
        : d < 0
            ? DeltaDirection.down
            : DeltaDirection.flat;
    final sparkColor =
        widget.revenue > 0 ? GraphiteTheme.success : GraphiteTheme.slateDim;
    return Pressable(
      haptic: false,
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
              top: -80,
              right: -60,
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      GraphiteTheme.platinum.withValues(alpha: 0.10),
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
                              GraphiteTheme.platinum.withValues(alpha: 0.05),
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
                      GraphiteTheme.platinum.withValues(alpha: 0.45),
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
                  // Eyebrow badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: GraphiteTheme.platinumFaint,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: GraphiteTheme.cardBorder),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          CupertinoIcons.lock_shield_fill,
                          size: 12,
                          color: GraphiteTheme.slate,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'TODAY\'S COLLECTION',
                          style: GraphiteTheme.eyebrow.copyWith(
                            letterSpacing: 2.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Animated counting numeral — bold grotesque sans.
                  // FittedBox guards against overflow on large amounts.
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
                                style: GraphiteTheme.heroCurrency.copyWith(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              TextSpan(
                                text: _formatCompact(value),
                                // Revenue in = good → green; zero stays platinum.
                                style: GraphiteTheme.heroAmount.copyWith(
                                  color: widget.revenue > 0
                                      ? GraphiteTheme.success
                                      : GraphiteTheme.platinumLight,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  // Delta pill — green up, red down, gray flat.
                  _deltaPill(dir),
                  const SizedBox(height: 12),
                  // Intraday sparkline.
                  Sparkline(
                    values: widget.hourlyRevenue,
                    lineColor: sparkColor,
                    height: 52,
                  ),
                  const SizedBox(height: 12),
                  Container(
                    height: 1,
                    decoration: GraphiteTheme.platinumDivider,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _meta('${widget.orderCount}', 'bills'),
                      _metaDivider(),
                      _meta('avg', 'PKR ${widget.averageOrder.toStringAsFixed(0)}'),
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

  Widget _deltaPill(DeltaDirection dir) {
    final Color color = switch (dir) {
      DeltaDirection.up => GraphiteTheme.success,
      DeltaDirection.down => GraphiteTheme.danger,
      DeltaDirection.flat || DeltaDirection.none => GraphiteTheme.slateDim,
    };
    final String glyph = switch (dir) {
      DeltaDirection.up => '▲',
      DeltaDirection.down => '▼',
      DeltaDirection.flat || DeltaDirection.none => '•',
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            glyph,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '${widget.deltaPct.abs().toStringAsFixed(1)}% vs yesterday',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
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
