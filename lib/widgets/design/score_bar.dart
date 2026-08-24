import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import 'mono_text.dart';

/// 打分条形态。
///
/// - [bar]：原型 `.mode-score`，条宽 = 分值百分比，右侧跟数字。
/// - [gauge]：原型 `.gauge-track`，满宽三段渐变 + 游标，用于方向强度。
enum ScoreBarVariant { bar, gauge }

/// 打分条色调。对应原型 `.mode-option` 的 rise / fall / amber 分档。
enum ScoreTone { accent, fall, amber, rise }

/// 打分条 / 强度仪表。
class ScoreBar extends StatelessWidget {
  const ScoreBar({
    super.key,
    required this.value,
    this.variant = ScoreBarVariant.bar,
    this.tone = ScoreTone.accent,
    this.showValue = true,
  });

  /// 0–100。超界自动夹取。
  final double value;
  final ScoreBarVariant variant;
  final ScoreTone tone;
  final bool showValue;

  double get _ratio => value.clamp(0, 100) / 100;

  Color _toneColor(StockCalTokens t) => switch (tone) {
    ScoreTone.accent => t.accent,
    ScoreTone.fall => t.fall,
    ScoreTone.amber => t.amber,
    ScoreTone.rise => t.rise,
  };

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    if (variant == ScoreBarVariant.gauge) return _gauge(t);
    return _bar(t);
  }

  Widget _bar(StockCalTokens t) {
    final base = _toneColor(t);
    final track = LayoutBuilder(
      builder: (context, c) => Align(
        alignment: Alignment.centerLeft,
        child: Container(
          key: const ValueKey('score-bar-fill'),
          width: c.maxWidth * _ratio,
          height: 4,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [base, Color.lerp(base, Colors.white, 0.62)!],
            ),
            borderRadius: BorderRadius.circular(99),
          ),
        ),
      ),
    );
    if (!showValue) return track;
    return Row(
      children: [
        Expanded(child: track),
        const SizedBox(width: 8),
        MonoText(
          value.clamp(0, 100).round().toString(),
          size: StockCalType.body,
          weight: FontWeight.w700,
          color: t.muted,
        ),
      ],
    );
  }

  Widget _gauge(StockCalTokens t) {
    return LayoutBuilder(
      builder: (context, c) => Stack(
        children: [
          Container(
            key: const ValueKey('score-gauge-track'),
            height: 6,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [t.fall, t.surfaceInset, t.rise],
                stops: const [0, 0.5, 1],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          Positioned(
            left: (c.maxWidth * _ratio - 1).clamp(0, c.maxWidth - 2),
            child: Container(
              key: const ValueKey('score-gauge-marker'),
              width: 2,
              height: 6,
              color: t.ink,
            ),
          ),
        ],
      ),
    );
  }
}
