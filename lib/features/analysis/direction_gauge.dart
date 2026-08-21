import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/display.dart';
import 'technical_analysis.dart';

/// Semicircular direction-strength gauge（深空科技风）。
class DirectionGauge extends StatelessWidget {
  const DirectionGauge({
    super.key,
    required this.strength,
    required this.direction,
  });

  final double strength;
  final Direction direction;

  @override
  Widget build(BuildContext context) {
    final color = switch (direction) {
      Direction.bullish => gainColor(context),
      Direction.neutral => Theme.of(context).colorScheme.onSurfaceVariant,
      Direction.bearish => lossColor(context),
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 138,
          width: 260,
          child: CustomPaint(
            painter: _GaugePainter(
              value: strength,
              color: color,
              track: Theme.of(context).colorScheme.surfaceContainerHigh,
              needle: Theme.of(context).colorScheme.onSurface,
              label: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Text(
          '${strength.round()}/100',
          style: withTabular(
            Theme.of(context).textTheme.titleLarge?.copyWith(color: color),
          ),
        ),
        Text(_label(direction), style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  static String _label(Direction direction) => switch (direction) {
    Direction.bullish => '多头',
    Direction.neutral => '中性',
    Direction.bearish => '空头',
  };
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({
    required this.value,
    required this.color,
    required this.track,
    required this.needle,
    required this.label,
  });

  final double value;
  final Color color;
  final Color track;
  final Color needle;
  final Color label;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.82);
    final radius = size.width * 0.40;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final ratio = (value / 100).clamp(0.0, 1.0);

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = track
      ..strokeCap = StrokeCap.round;
    final glowPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 20
      ..color = color.withValues(alpha: 0.16)
      ..strokeCap = StrokeCap.round;
    final valuePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = color
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(rect, math.pi, math.pi, false, trackPaint);
    final sweep = math.pi * ratio;
    if (sweep > 0) {
      canvas.drawArc(rect, math.pi, sweep, false, glowPaint);
      canvas.drawArc(rect, math.pi, sweep, false, valuePaint);
    }

    final angle = math.pi + sweep;
    final tip =
        center + Offset(math.cos(angle), math.sin(angle)) * (radius - 18);
    canvas.drawLine(
      center,
      tip,
      Paint()
        ..color = needle
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(center, 5, Paint()..color = needle);

    _drawLabel(canvas, '空头', Offset(14, size.height - 12), label, TextAlign.left);
    _drawLabel(
      canvas,
      '多头',
      Offset(size.width - 14, size.height - 12),
      label,
      TextAlign.right,
    );
  }

  void _drawLabel(
    Canvas canvas,
    String text,
    Offset anchor,
    Color color,
    TextAlign align,
  ) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: 11)),
      textDirection: TextDirection.ltr,
      textAlign: align,
    )..layout();
    final x = align == TextAlign.left ? anchor.dx : anchor.dx - tp.width;
    tp.paint(canvas, Offset(x, anchor.dy));
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.value != value ||
      old.color != color ||
      old.track != track ||
      old.needle != needle;
}
