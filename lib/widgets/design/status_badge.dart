import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 徽章色调。
///
/// [rise] / [fall] 表达行情方向（红涨绿跌）；
/// [profit] / [loss] 表达损益金额（绿盈红亏）。两者极性相反，勿混用。
enum BadgeTone { neutral, accent, amber, rise, fall, profit, loss }

/// 小徽章。还原原型的 `.panel-note` / `.demo-tag` / `.trade-badge`
/// / `.history-status` / `.status-dot`。
///
/// 命名为 StatusBadge 而非 Badge，以避免与 material.Badge 冲突。
class StatusBadge extends StatelessWidget {
  const StatusBadge(
    this.label, {
    super.key,
    this.tone = BadgeTone.neutral,
    this.dot = false,
    this.mono = false,
  });

  final String label;
  final BadgeTone tone;

  /// 是否在文字前渲染一个带光晕的圆点（还原 `.status-dot`）。
  final bool dot;

  /// 是否用等宽字（还原 `.rule-card-head span` 的规则编号）。
  final bool mono;

  (Color, Color) _colors(StockCalTokens t) => switch (tone) {
    BadgeTone.neutral => (t.faint, t.surfaceInset),
    BadgeTone.accent => (t.accent, t.accentSoft),
    BadgeTone.amber => (t.amber, t.amberSoft),
    BadgeTone.rise => (t.rise, t.riseSoft),
    BadgeTone.fall => (t.fall, t.fallSoft),
    BadgeTone.profit => (t.profit, t.profitSoft),
    BadgeTone.loss => (t.loss, t.lossSoft),
  };

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final (fg, bg) = _colors(t);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(StockCalRadii.chip),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              key: const ValueKey('status-badge-dot'),
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: fg,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: bg, spreadRadius: 3)],
              ),
            ),
            const SizedBox(width: 7),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: StockCalType.eyebrow,
              fontWeight: FontWeight.w700,
              color: fg,
              fontFamily: mono ? 'monospace' : null,
            ),
          ),
        ],
      ),
    );
  }
}
