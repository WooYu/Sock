import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 分段切换的三种视觉变体。
///
/// - [pill]：原型 `.cycle-tabs`。槽底 + 选中白底浮起。用于操作周期、AI 页签。
/// - [chip]：原型 `.period-switches`。白底细边，选中蓝底蓝字。用于 K 线周期。
/// - [duo]：原型 `.trade-side-tabs`。两格，买绿卖红。
enum SegTabsVariant { pill, chip, duo }

/// 分段切换。
class SegTabs extends StatelessWidget {
  const SegTabs({
    super.key,
    required this.labels,
    required this.selected,
    required this.onSelected,
    this.variant = SegTabsVariant.pill,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelected;
  final SegTabsVariant variant;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final items = [
      for (var i = 0; i < labels.length; i++) _item(context, t, i, labels[i]),
    ];

    if (variant == SegTabsVariant.duo) {
      return Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 5),
            Expanded(child: items[i]),
          ],
        ],
      );
    }

    if (variant == SegTabsVariant.chip) {
      return Wrap(spacing: 5, runSpacing: 5, children: items);
    }

    return Container(
      key: const ValueKey('seg-tab-track'),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: t.surfaceInset,
        border: Border.all(color: t.line, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.card),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            items[i],
          ],
        ],
      ),
    );
  }

  Widget _item(
    BuildContext context,
    StockCalTokens t,
    int index,
    String label,
  ) {
    final active = index == selected;
    late final Color bg;
    late final Color fg;
    late final Color? border;

    switch (variant) {
      case SegTabsVariant.pill:
        bg = active ? t.surface : Colors.transparent;
        fg = active ? t.ink : t.muted;
        border = null;
      case SegTabsVariant.chip:
        bg = active ? t.accentSoft : t.surface;
        fg = active ? t.accent : t.muted;
        border = active ? t.accent : t.tileLine;
      case SegTabsVariant.duo:
        final isBuy = index == 0;
        bg = active ? (isBuy ? t.profitSoft : t.lossSoft) : t.surface;
        fg = active ? (isBuy ? t.profit : t.loss) : t.muted;
        border = active ? (isBuy ? t.profit : t.loss) : t.tileLine;
    }

    return GestureDetector(
      onTap: () => onSelected(index),
      child: Container(
        key: const ValueKey('seg-tab-item'),
        alignment: Alignment.center,
        constraints: variant == SegTabsVariant.pill
            ? const BoxConstraints(minWidth: 58)
            : const BoxConstraints(),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: bg,
          border: border == null
              ? null
              : Border.all(color: border, width: StockCalRadii.hairline),
          borderRadius: BorderRadius.circular(
            variant == SegTabsVariant.pill
                ? StockCalRadii.tile
                : StockCalRadii.chip,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: StockCalType.bodyLg,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: fg,
          ),
        ),
      ),
    );
  }
}
