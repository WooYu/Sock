import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/panel_card.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.light}) =>
    MaterialApp(
      theme: ThemeData(
        extensions: [
          brightness == Brightness.light
              ? StockCalTokens.light()
              : StockCalTokens.dark(),
        ],
      ),
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('边框 1px、圆角 11、背景取 surface', (tester) async {
    await tester.pumpWidget(_wrap(const PanelCard(child: Text('x'))));
    final deco = tester
        .widget<Container>(
          find.descendant(
            of: find.byType(PanelCard),
            matching: find.byType(Container),
          ),
        )
        .decoration! as BoxDecoration;
    final t = StockCalTokens.light();
    expect(deco.color, t.surface);
    expect(deco.border!.top.width, StockCalRadii.hairline);
    expect(deco.border!.top.color, t.line);
    expect(deco.borderRadius, BorderRadius.circular(StockCalRadii.panel));
    expect(deco.boxShadow, t.panelShadow);
  });

  testWidgets('深色下取深色 token，不硬编码', (tester) async {
    await tester.pumpWidget(
      _wrap(const PanelCard(child: Text('x')), brightness: Brightness.dark),
    );
    final deco = tester
        .widget<Container>(
          find.descendant(
            of: find.byType(PanelCard),
            matching: find.byType(Container),
          ),
        )
        .decoration! as BoxDecoration;
    expect(deco.color, StockCalTokens.dark().surface);
  });
}
