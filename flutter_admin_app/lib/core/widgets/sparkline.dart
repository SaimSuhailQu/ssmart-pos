import 'package:flutter/material.dart';

/// Minimal area sparkline: smooth line + gradient fill, no axes.
///
/// Draws [values] left-to-right. Empty or all-zero input renders a flat
/// baseline so the widget never looks broken on quiet days.
class Sparkline extends StatelessWidget {
  final List<double> values;
  final Color lineColor;
  final double strokeWidth;
  final double height;

  const Sparkline({
    super.key,
    required this.values,
    required this.lineColor,
    this.strokeWidth = 2.0,
    this.height = 56,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparklinePainter(
          values: values,
          lineColor: lineColor,
          strokeWidth: strokeWidth,
        ),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> values;
  final Color lineColor;
  final double strokeWidth;

  _SparklinePainter({
    required this.values,
    required this.lineColor,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;
    final pts = _points(size);
    final linePaint = Paint()
      ..color = lineColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = _smoothPath(pts);
    canvas.drawPath(path, linePaint);

    // Gradient fill under the line.
    final fillPath = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            lineColor.withValues(alpha: 0.28),
            lineColor.withValues(alpha: 0.0),
          ],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );

    // End dot.
    canvas.drawCircle(
      pts.last,
      strokeWidth + 1.5,
      Paint()..color = lineColor,
    );
  }

  List<Offset> _points(Size size) {
    final n = values.length;
    if (n == 0) {
      return [Offset(0, size.height / 2), Offset(size.width, size.height / 2)];
    }
    final maxV = values.fold<double>(0, (m, v) => v > m ? v : m);
    final minV = values.fold<double>(double.infinity, (m, v) => v < m ? v : m);
    final span = (maxV - minV).abs() < 1e-9 ? 1.0 : (maxV - minV);
    const pad = 6.0;
    return List.generate(n, (i) {
      final x = n == 1
          ? size.width / 2
          : pad + (size.width - pad * 2) * i / (n - 1);
      final t = (values[i] - minV) / span; // 0..1
      final y = size.height - pad - t * (size.height - pad * 2);
      return Offset(x, y);
    });
  }

  /// Catmull-Rom-ish smoothing through the points.
  Path _smoothPath(List<Offset> pts) {
    final path = Path()..moveTo(pts.first.dx, pts.first.dy);
    if (pts.length < 3) {
      for (var i = 1; i < pts.length; i++) {
        path.lineTo(pts[i].dx, pts[i].dy);
      }
      return path;
    }
    for (var i = 0; i < pts.length - 1; i++) {
      final p0 = i == 0 ? pts[i] : pts[i - 1];
      final p1 = pts[i];
      final p2 = pts[i + 1];
      final p3 = i + 2 < pts.length ? pts[i + 2] : p2;
      // Sample the segment for a smooth curve.
      for (var t = 0.0; t < 1.0; t += 0.12) {
        final x = 0.5 *
            ((2 * p1.dx) +
                (-p0.dx + p2.dx) * t +
                (2 * p0.dx - 5 * p1.dx + 4 * p2.dx - p3.dx) * t * t +
                (-p0.dx + 3 * p1.dx - 3 * p2.dx + p3.dx) * t * t * t);
        final y = 0.5 *
            ((2 * p1.dy) +
                (-p0.dy + p2.dy) * t +
                (2 * p0.dy - 5 * p1.dy + 4 * p2.dy - p3.dy) * t * t +
                (-p0.dy + 3 * p1.dy - 3 * p2.dy + p3.dy) * t * t * t);
        path.lineTo(x, y);
      }
    }
    path.lineTo(pts.last.dx, pts.last.dy);
    return path;
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      oldDelegate.values != values ||
      oldDelegate.lineColor != lineColor ||
      oldDelegate.strokeWidth != strokeWidth;
}
