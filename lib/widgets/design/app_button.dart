import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 按钮变体。还原原型 `.button.primary` / `.button.ghost`。
enum AppButtonVariant { primary, ghost }

/// 按钮。
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final primary = variant == AppButtonVariant.primary;
    final enabled = onPressed != null;

    return Opacity(
      key: const ValueKey('app-button-op'),
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          key: const ValueKey('app-button-box'),
          constraints: const BoxConstraints(minHeight: 36),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: primary ? t.accent : t.surface,
            border: primary
                ? null
                : Border.all(color: t.line, width: StockCalRadii.hairline),
            borderRadius: BorderRadius.circular(StockCalRadii.button),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: StockCalType.body,
              fontWeight: FontWeight.w700,
              color: primary ? Colors.white : t.muted,
            ),
          ),
        ),
      ),
    );
  }
}
