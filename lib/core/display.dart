import 'package:flutter/material.dart';

/// Tabular figures keep numeric columns aligned.
/// Production design requires: "Numbers use tabular alignment."
const FontFeature tabularFigures = FontFeature.tabularFigures();

/// A-share convention: red means up/gain, green means down/loss.
/// Applied consistently so gain/loss never relies on color alone.
Color gainColor(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFFFF6B6B)
        : Colors.red.shade700;

Color lossColor(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF2ECC71)
        : Colors.green.shade700;

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
