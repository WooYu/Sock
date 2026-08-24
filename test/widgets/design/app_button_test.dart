import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/app_button.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: Center(child: child)),
    );

BoxDecoration _deco(WidgetTester tester) => tester
    .widget<Container>(find.byKey(const ValueKey('app-button-box')))
    .decoration! as BoxDecoration;

void main() {
  final t = StockCalTokens.light();

  testWidgets('primary：accent 底、白字', (tester) async {
    await tester
        .pumpWidget(_wrap(AppButton(label: '保存交易记录', onPressed: () {})));
    expect(_deco(tester).color, t.accent);
    expect(
      tester.widget<Text>(find.text('保存交易记录')).style!.color,
      Colors.white,
    );
  });

  testWidgets('ghost：surface 底、line 边、muted 字', (tester) async {
    await tester.pumpWidget(
      _wrap(
        AppButton(
          label: '恢复全部调整',
          onPressed: () {},
          variant: AppButtonVariant.ghost,
        ),
      ),
    );
    expect(_deco(tester).color, t.surface);
    expect(_deco(tester).border!.top.color, t.line);
    expect(
      tester.widget<Text>(find.text('恢复全部调整')).style!.color,
      t.muted,
    );
  });

  testWidgets('最小高度 36', (tester) async {
    await tester.pumpWidget(_wrap(AppButton(label: 'x', onPressed: () {})));
    expect(
      tester.getSize(find.byKey(const ValueKey('app-button-box'))).height,
      greaterThanOrEqualTo(36),
    );
  });

  testWidgets('onPressed 为 null 时不触发且降透明度', (tester) async {
    await tester.pumpWidget(_wrap(const AppButton(label: '停用')));
    await tester.tap(find.text('停用'));
    await tester.pump();
    final opacity =
        tester.widget<Opacity>(find.byKey(const ValueKey('app-button-op')));
    expect(opacity.opacity, 0.45);
  });

  testWidgets('点击触发回调', (tester) async {
    var n = 0;
    await tester
        .pumpWidget(_wrap(AppButton(label: '点我', onPressed: () => n++)));
    await tester.tap(find.text('点我'));
    await tester.pump();
    expect(n, 1);
  });
}
