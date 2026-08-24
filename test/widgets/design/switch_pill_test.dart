import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/switch_pill.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  final t = StockCalTokens.light();

  testWidgets('开启时轨道取 accent', (tester) async {
    await tester.pumpWidget(_wrap(SwitchPill(value: true, onChanged: (_) {})));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('switch-track')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.accent);
  });

  testWidgets('关闭时轨道取 tileLine', (tester) async {
    await tester.pumpWidget(_wrap(SwitchPill(value: false, onChanged: (_) {})));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('switch-track')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.tileLine);
  });

  testWidgets('钮位移 13px', (tester) async {
    await tester.pumpWidget(_wrap(SwitchPill(value: false, onChanged: (_) {})));
    final off = tester.getTopLeft(find.byKey(const ValueKey('switch-knob'))).dx;
    await tester.pumpWidget(_wrap(SwitchPill(value: true, onChanged: (_) {})));
    await tester.pumpAndSettle();
    final on = tester.getTopLeft(find.byKey(const ValueKey('switch-knob'))).dx;
    expect(on - off, closeTo(13, 0.5));
  });

  testWidgets('点击回调取反值', (tester) async {
    bool? got;
    await tester
        .pumpWidget(_wrap(SwitchPill(value: false, onChanged: (v) => got = v)));
    await tester.tap(find.byType(SwitchPill));
    await tester.pump();
    expect(got, isTrue);
  });
}
