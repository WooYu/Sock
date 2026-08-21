import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/display.dart';
import 'technical_analysis.dart';

/// Semicircular direction-strength gauge (位界 KEYLINE 风格)。
class DirectionGauge extends StatelessWidget {
  const DirectionGauge({super.key, required this.strength, required this.direction});

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
          height: 120,
          width: 240,
          child: CustomPaint(
            painter: _GaugePainter(
              value: strength,
              color: color,
              track: Theme.of(context).colorScheme.surfaceContainerHigh,
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
  _GaugePainter({required this.value, required this.color, required this.track});

  final double value;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.85);
    final radius = size.width * 0.42;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = track
      ..strokeCap = StrokeCap.round;
    final valuePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = color
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi, false, trackPaint);
    final sweep = math.pi * (value / 100).clamp(0.0, 1.0);
    canvas.drawArc(rect, math.pi, sweep, false, valuePaint);
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.value != value || old.color != color || old.track != track;
}
