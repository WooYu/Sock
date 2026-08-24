import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/mono_text.dart';

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
  testWidgets('带 tabular figures', (tester) async {
    await tester.pumpWidget(_wrap(const MonoText('32.68')));
    final style = tester.widget<Text>(find.text('32.68')).style!;
    expect(style.fontFeatures, contains(const FontFeature.tabularFigures()));
  });

  testWidgets('默认色取 token 的 ink，不硬编码', (tester) async {
    await tester.pumpWidget(_wrap(const MonoText('32.68')));
    final style = tester.widget<Text>(find.text('32.68')).style!;
    expect(style.color, StockCalTokens.light().ink);

    await tester.pumpWidget(
      _wrap(const MonoText('32.68'), brightness: Brightness.dark),
    );
    await tester.pumpAndSettle();
    final darkStyle = tester.widget<Text>(find.text('32.68')).style!;
    expect(darkStyle.color, StockCalTokens.dark().ink);
  });

  testWidgets('可覆盖字号与颜色', (tester) async {
    await tester.pumpWidget(
      _wrap(const MonoText('32.68', size: 17, color: Color(0xFF123456))),
    );
    final style = tester.widget<Text>(find.text('32.68')).style!;
    expect(style.fontSize, 17);
    expect(style.color, const Color(0xFF123456));
  });
}
