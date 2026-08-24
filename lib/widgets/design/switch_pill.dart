import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 小开关。还原原型 `.switch`（轨 30×17，钮 11，位移 13）。
class SwitchPill extends StatelessWidget {
  const SwitchPill({
    super.key,
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool> onChanged;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Semantics(
      label: semanticLabel,
      toggled: value,
      button: true,
      child: GestureDetector(
        onTap: () => onChanged(!value),
        child: Container(
          key: const ValueKey('switch-track'),
          width: 30,
          height: 17,
          decoration: BoxDecoration(
            color: value ? t.accent : t.tileLine,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Stack(
            children: [
              AnimatedPositioned(
                duration: const Duration(milliseconds: 150),
                left: value ? 16 : 3,
                top: 3,
                child: Container(
                  key: const ValueKey('switch-knob'),
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    color: t.surface,
                    shape: BoxShape.circle,
                    boxShadow: t.panelShadow,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
