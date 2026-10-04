import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ssmart_pos_admin/core/theme/app_theme.dart';
import 'package:ssmart_pos_admin/core/theme/executive_theme.dart';
import 'package:ssmart_pos_admin/core/widgets/haptics.dart';

/// The signature Executive Dark hero: today's revenue in big serif numerals,
/// counting up on appearance, with a gold delta pill.
///
/// Gestures:
///   - long-press: copies a plain-text daily summary to clipboard (haptic +
///     snackbar confirmation). The shop owner does this every evening.
class ExecutiveHeroCard extends StatefulWidget {
  final double revenue;
  final int orderCount;
  final double averageOrder;
  final double deltaPct; // vs yesterday, e.g. 12.4
  final String dateLabel;
  final VoidCallback onCopySummary;

  const ExecutiveHeroCard({
    super.key,
    required this.revenue,
    required this.orderCount,
    required this.averageOrder,
    required this.deltaPct,
    required this.dateLabel,
    required this.onCopySummary,
  });

  @override
  State<ExecutiveHeroCard> createState() => _ExecutiveHeroCardState();
}

class _ExecutiveHeroCardState extends State<ExecutiveHeroCard> {
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
  void didUpdateWidget(ExecutiveHeroCard oldWidget) {
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
        decoration: ExecutiveTheme.goldCardDecoration,
        child: Stack(
          children: [
            // Ambient gold glow, top-right
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
                      ExecutiveTheme.gold.withValues(alpha: 0.22),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('TODAY\'S REVENUE', style: ExecutiveTheme.eyebrow),
                      const Spacer(),
                      Icon(
                        CupertinoIcons.sparkles,
                        size: 15,
                        color: ExecutiveTheme.gold.withValues(alpha: 0.7),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
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
                              text: 'PKR ',
                              style: ExecutiveTheme.heroCurrency,
                            ),
                            TextSpan(
                              text: _formatCompact(value),
                              style: ExecutiveTheme.heroAmount,
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  // Delta pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: ExecutiveTheme.gold,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          deltaPositive
                              ? CupertinoIcons.arrow_up_right
                              : CupertinoIcons.arrow_down_right,
                          size: 13,
                          color: ExecutiveTheme.navyDeep,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${deltaPositive ? '' : '−'}${widget.deltaPct.abs().toStringAsFixed(1)}% vs yesterday',
                          style: const TextStyle(
                            color: ExecutiveTheme.navyDeep,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${widget.orderCount} orders   ·   Avg PKR ${widget.averageOrder.toStringAsFixed(0)}   ·   ${widget.dateLabel}',
                    style: ExecutiveTheme.bodyGold.copyWith(
                      color: ExecutiveTheme.slate,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        CupertinoIcons.hand_draw,
                        size: 11,
                        color: ExecutiveTheme.slateDim,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Long-press to copy closing summary',
                        style: AppTheme.labelSmall.copyWith(
                          fontSize: 10,
                          color: ExecutiveTheme.slateDim,
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
