import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import '../../widgets/design.dart';
import 'technical_analysis.dart';

/// 原型同款线性方向强度条。
///
/// 从左到右依次表示空头、中性、多头；游标位置由 [strength] 决定。
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
    final t = StockCalTokens.of(context);
    final value = strength.clamp(0, 100).toDouble();
    return Semantics(
      label: '方向强度 ${value.round()}/100，${_label(direction)}',
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  '方向强度',
                  style: TextStyle(
                    color: t.muted,
                    fontSize: StockCalType.body,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                MonoText(
                  '${value.round()}/100',
                  color: t.ink,
                  size: StockCalType.metric,
                  weight: FontWeight.w700,
                ),
              ],
            ),
            const SizedBox(height: 10),
            ScoreBar(value: value, variant: ScoreBarVariant.gauge),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _AxisLabel('空头', color: t.faint),
                _AxisLabel('中性', color: t.faint),
                _AxisLabel('多头', color: t.faint),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _label(Direction direction) => switch (direction) {
    Direction.bullish => '多头',
    Direction.neutral => '中性',
    Direction.bearish => '空头',
  };
}

class _AxisLabel extends StatelessWidget {
  const _AxisLabel(this.label, {required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: TextStyle(
      color: color,
      fontSize: StockCalType.micro,
      fontWeight: FontWeight.w600,
    ),
  );
}
