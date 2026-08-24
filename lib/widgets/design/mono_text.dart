import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 等宽 + tabular 数字。所有价格、数量、百分比用它。
class MonoText extends StatelessWidget {
  const MonoText(
    this.text, {
    super.key,
    this.size,
    this.color,
    this.weight,
    this.textAlign,
  });

  final String text;
  final double? size;
  final Color? color;
  final FontWeight? weight;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Text(
      text,
      textAlign: textAlign,
      style: TextStyle(
        fontFamily: 'monospace',
        fontFamilyFallback: const ['SF Mono', 'Consolas', 'Menlo'],
        fontSize: size ?? StockCalType.body,
        fontWeight: weight ?? FontWeight.w600,
        color: color ?? t.ink,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}
