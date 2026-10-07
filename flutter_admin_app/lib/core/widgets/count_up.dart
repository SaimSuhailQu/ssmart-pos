import 'package:flutter/material.dart';

/// Animated number that ticks from the old value to the new one whenever
/// [value] changes — for hero amounts, metric cards, totals.
///
/// Example:
/// ```dart
/// CountUp(
///   value: todaysMetrics.totalRevenue,
///   format: (v) => AppDateUtils.formatCurrency(v),
///   style: GraphiteTheme.heroAmount,
/// )
/// ```
class CountUp extends StatefulWidget {
  final double value;
  final String Function(double) format;
  final TextStyle? style;
  final Duration duration;
  final TextAlign textAlign;

  const CountUp({
    super.key,
    required this.value,
    required this.format,
    this.style,
    this.duration = const Duration(milliseconds: 700),
    this.textAlign = TextAlign.start,
  });

  @override
  State<CountUp> createState() => _CountUpState();
}

class _CountUpState extends State<CountUp> {
  late Tween<double> _tween;

  @override
  void initState() {
    super.initState();
    _tween = Tween<double>(begin: widget.value, end: widget.value);
  }

  @override
  void didUpdateWidget(CountUp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _tween = Tween<double>(begin: oldWidget.value, end: widget.value);
    }
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: _tween,
      duration: widget.duration,
      curve: Curves.easeOutCubic,
      builder: (context, value, _) {
        return Text(
          widget.format(value),
          style: widget.style,
          textAlign: widget.textAlign,
        );
      },
    );
  }
}
