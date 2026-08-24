import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/status_badge.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: child),
    );

BoxDecoration _decoOf(WidgetTester tester) => tester
    .widget<Container>(
      find.descendant(
        of: find.byType(StatusBadge),
        matching: find.byType(Container),
      ),
    )
    .decoration! as BoxDecoration;

void main() {
  final t = StockCalTokens.light();

  final cases = <BadgeTone, (Color, Color)>{
    BadgeTone.neutral: (t.faint, t.surfaceInset),
    BadgeTone.accent: (t.accent, t.accentSoft),
    BadgeTone.amber: (t.amber, t.amberSoft),
    BadgeTone.rise: (t.rise, t.riseSoft),
    BadgeTone.fall: (t.fall, t.fallSoft),
    BadgeTone.profit: (t.profit, t.profitSoft),
    BadgeTone.loss: (t.loss, t.lossSoft),
  };

  cases.forEach((tone, pair) {
    testWidgets('tone $tone 的前景/背景成对取自 token', (tester) async {
      await tester.pumpWidget(_wrap(StatusBadge('标签', tone: tone)));
      expect(_decoOf(tester).color, pair.$2);
      expect(tester.widget<Text>(find.text('标签')).style!.color, pair.$1);
    });
  });

  testWidgets('dot 为 true 时渲染圆点', (tester) async {
    await tester.pumpWidget(
      _wrap(const StatusBadge('一致', tone: BadgeTone.fall, dot: true)),
    );
    expect(find.byKey(const ValueKey('status-badge-dot')), findsOneWidget);
  });

  testWidgets('dot 默认关闭', (tester) async {
    await tester.pumpWidget(_wrap(const StatusBadge('一致')));
    expect(find.byKey(const ValueKey('status-badge-dot')), findsNothing);
  });
}
