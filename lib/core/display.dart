import 'package:flutter/material.dart';

import '../theme/stockcal_theme.dart';

/// Tabular figures keep numeric columns aligned.
/// Production design requires: "Numbers use tabular alignment."
const FontFeature tabularFigures = FontFeature.tabularFigures();

/// A-share convention: red means up/gain, green means down/loss.
/// Applied consistently so gain/loss never relies on color alone.
Color gainColor(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? StockCalColors.gain
        : StockCalColors.lightGain;

Color lossColor(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? StockCalColors.loss
        : StockCalColors.lightLoss;

/// Semantic color for a signed profit/loss value; null (neutral) when flat.
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
