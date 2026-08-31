import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/section_heading.dart';
import 'package:stockcal/widgets/design/status_badge.dart';

Widget _wrap(Widget child) => MaterialApp(
  theme: ThemeData(extensions: [StockCalTokens.light()]),
  home: Scaffold(body: child),
);

void main() {
  final t = StockCalTokens.light();

  testWidgets('eyebrow 大写、带字距、取 token 色', (tester) async {
    await tester.pumpWidget(
      _wrap(const SectionHeading(eyebrow: '组合视角 · 多股票盈亏', title: '组合总览')),
    );
    final style = tester.widget<Text>(find.text('组合视角 · 多股票盈亏')).style!;
    expect(style.fontSize, StockCalType.eyebrow);
    expect(style.letterSpacing, StockCalType.eyebrowSpacing);
    expect(style.fontWeight, FontWeight.w800);
    expect(style.color, t.eyebrowInk);
  });

  testWidgets('title 取 h2 字号与 ink 色', (tester) async {
    await tester.pumpWidget(
      _wrap(const SectionHeading(eyebrow: 'A', title: '组合总览')),
    );
    final style = tester.widget<Text>(find.text('组合总览')).style!;
    expect(style.fontSize, StockCalType.h2);
    expect(style.color, t.ink);
  });

  testWidgets('trailing 渲染在尾部', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const SectionHeading(
          eyebrow: 'A',
          title: 'B',
          trailing: StatusBadge('演示持仓 · 非真实账户'),
        ),
      ),
    );
    expect(find.byType(StatusBadge), findsOneWidget);
  });

  testWidgets('无 trailing 时不占位', (tester) async {
    await tester.pumpWidget(
      _wrap(const SectionHeading(eyebrow: 'A', title: 'B')),
    );
    expect(find.byType(StatusBadge), findsNothing);
    expect(find.byType(Spacer), findsNothing);
  });

  testWidgets('窄屏大字体时尾部徽章换行且不溢出', (tester) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(2)),
        child: _wrap(
          const SizedBox(
            width: 320,
            child: SectionHeading(
              eyebrow: 'Pattern Matching',
              title: '盈利模式识别',
              trailing: StatusBadge('命中 8/11'),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    final titleBottom = tester.getBottomLeft(find.text('盈利模式识别')).dy;
    final badgeTop = tester.getTopLeft(find.byType(StatusBadge)).dy;
    expect(badgeTop, greaterThanOrEqualTo(titleBottom));
  });
}
