import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/seg_tabs.dart';

Widget _wrap(Widget child) => MaterialApp(
  theme: ThemeData(extensions: [StockCalTokens.light()]),
  home: Scaffold(body: Center(child: child)),
);

BoxDecoration _segDeco(WidgetTester tester, String label) =>
    tester
            .widget<Container>(
              find.ancestor(
                of: find.text(label),
                matching: find.byKey(const ValueKey('seg-tab-item')),
              ),
            )
            .decoration!
        as BoxDecoration;

void main() {
  final t = StockCalTokens.light();

  testWidgets('pill：选中白底，未选透明', (tester) async {
    await tester.pumpWidget(
      _wrap(
        SegTabs(
          labels: const ['短线', '波段', '中长线'],
          selected: 0,
          onSelected: (_) {},
        ),
      ),
    );
    expect(_segDeco(tester, '短线').color, t.surface);
    expect(_segDeco(tester, '波段').color, Colors.transparent);
  });

  testWidgets('pill：槽底取 surfaceInset', (tester) async {
    await tester.pumpWidget(
      _wrap(
        SegTabs(labels: const ['短线', '波段'], selected: 0, onSelected: (_) {}),
      ),
    );
    final deco =
        tester
                .widget<Container>(find.byKey(const ValueKey('seg-tab-track')))
                .decoration!
            as BoxDecoration;
    expect(deco.color, t.surfaceInset);
  });

  testWidgets('chip：选中取 accentSoft 底与 accent 字', (tester) async {
    await tester.pumpWidget(
      _wrap(
        SegTabs(
          labels: const ['日线', '周线', '月线'],
          selected: 1,
          onSelected: (_) {},
          variant: SegTabsVariant.chip,
        ),
      ),
    );
    expect(_segDeco(tester, '周线').color, t.accentSoft);
    expect(tester.widget<Text>(find.text('周线')).style!.color, t.accent);
    expect(tester.widget<Text>(find.text('日线')).style!.color, t.muted);
  });

  testWidgets('duo：index 0 选中取 profit 色系，index 1 取 loss 色系', (tester) async {
    await tester.pumpWidget(
      _wrap(
        SegTabs(
          labels: const ['买入', '卖出'],
          selected: 0,
          onSelected: (_) {},
          variant: SegTabsVariant.duo,
        ),
      ),
    );
    expect(_segDeco(tester, '买入').color, t.profitSoft);
    expect(tester.widget<Text>(find.text('买入')).style!.color, t.profit);

    await tester.pumpWidget(
      _wrap(
        SegTabs(
          labels: const ['买入', '卖出'],
          selected: 1,
          onSelected: (_) {},
          variant: SegTabsVariant.duo,
        ),
      ),
    );
    expect(_segDeco(tester, '卖出').color, t.lossSoft);
    expect(tester.widget<Text>(find.text('卖出')).style!.color, t.loss);
  });

  testWidgets('点击回调返回 index', (tester) async {
    int? got;
    await tester.pumpWidget(
      _wrap(
        SegTabs(
          labels: const ['短线', '波段', '中长线'],
          selected: 0,
          onSelected: (i) => got = i,
        ),
      ),
    );
    await tester.tap(find.text('中长线'));
    await tester.pump();
    expect(got, 2);
  });

  testWidgets('每个页签有选中语义、键盘焦点和至少 48dp 触控高度', (tester) async {
    await tester.pumpWidget(
      _wrap(
        SegTabs(labels: const ['短线', '波段'], selected: 0, onSelected: (_) {}),
      ),
    );

    expect(
      tester.getSemantics(find.text('短线')),
      matchesSemantics(
        label: '短线',
        isButton: true,
        hasSelectedState: true,
        isSelected: true,
        isInMutuallyExclusiveGroup: true,
        isFocusable: true,
        hasTapAction: true,
        hasFocusAction: true,
      ),
    );
    final item = find.ancestor(
      of: find.text('短线'),
      matching: find.byKey(const ValueKey('seg-tab-item')),
    );
    expect(tester.getSize(item).height, greaterThanOrEqualTo(48));
  });
}
