import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

/// Tabular figures keep numeric columns aligned.
/// Production design requires: "Numbers use tabular alignment."
const FontFeature tabularFigures = FontFeature.tabularFigures();

/// 行情方向色。A 股约定：红涨绿跌。
///
/// 注意与 [profitColor] / [lossAmountColor] 区分：本对表达**价格方向**
/// （涨跌幅、最高最低、关键区方向），极性为红涨绿跌。
Color gainColor(BuildContext context) => StockCalTokens.of(context).rise;

Color lossColor(BuildContext context) => StockCalTokens.of(context).fall;

/// 损益金额色。原型约定：绿盈红亏。
///
/// 与 [gainColor] / [lossColor] **极性相反**，这是原型的实际行为：
/// 同页中「最高 32.96」为红（行情方向），「浮动盈亏 +1170.00」为绿（损益）。
///
/// 本对建立于设计系统 Phase 0，当前零调用点；各屏改造时逐个调用点判定
/// 该处渲染的是行情方向还是损益金额，再决定用哪一对。
Color profitColor(BuildContext context) => StockCalTokens.of(context).profit;

Color lossAmountColor(BuildContext context) => StockCalTokens.of(context).loss;

/// Semantic color for a signed profit/loss value; null (neutral) when flat.
///
/// 行为未变：仍走行情方向色，以免静默翻转既有各屏的颜色。
Color? pnlColor(BuildContext context, double value) {
  if (value > 0) return gainColor(context);
  if (value < 0) return lossColor(context);
  return null;
}

/// Attaches tabular figures to a text style without mutating the source.
TextStyle withTabular(TextStyle? style) =>
    (style ?? const TextStyle()).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
