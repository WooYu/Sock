import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 面板容器。还原原型 `.panel`。
class PanelCard extends StatelessWidget {
  const PanelCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(17),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: t.surface,
        border: Border.all(color: t.line, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.panel),
        boxShadow: t.panelShadow,
      ),
      child: child,
    );
  }
}
