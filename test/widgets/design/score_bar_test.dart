import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/score_bar.dart';

Widget _wrap(Widget child, {double width = 300}) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

void main() {
  final t = StockCalTokens.light();

  testWidgets('bar：条宽为容器的 value%', (tester) async {
    await tester.pumpWidget(
      _wrap(const ScoreBar(value: 50, showValue: false), width: 200),
    );
    final fill = tester.getSize(find.byKey(const ValueKey('score-bar-fill')));
    expect(fill.width, closeTo(100, 1));
  });

  testWidgets('bar：显示数值', (tester) async {
    await tester.pumpWidget(_wrap(const ScoreBar(value: 86)));
    expect(find.text('86'), findsOneWidget);
  });

  testWidgets('bar：tone 决定渐变起点色，取自 token', (tester) async {
    for (final (tone, expected) in [
      (ScoreTone.accent, t.accent),
      (ScoreTone.fall, t.fall),
      (ScoreTone.amber, t.amber),
      (ScoreTone.rise, t.rise),
    ]) {
      await tester.pumpWidget(_wrap(ScoreBar(value: 60, tone: tone)));
      final deco = tester
          .widget<Container>(find.byKey(const ValueKey('score-bar-fill')))
          .decoration! as BoxDecoration;
      expect((deco.gradient! as LinearGradient).colors.first, expected);
    }
  });

  testWidgets('gauge：游标位于 value%', (tester) async {
    await tester.pumpWidget(
      _wrap(const ScoreBar(value: 64, variant: ScoreBarVariant.gauge), width: 200),
    );
    final marker = tester.getTopLeft(find.byKey(const ValueKey('score-gauge-marker')));
    final track = tester.getTopLeft(find.byKey(const ValueKey('score-gauge-track')));
    expect(marker.dx - track.dx, closeTo(128, 2));
  });

  testWidgets('value 超界被夹到 0..100', (tester) async {
    await tester.pumpWidget(
      _wrap(const ScoreBar(value: 150, showValue: false), width: 200),
    );
    final fill = tester.getSize(find.byKey(const ValueKey('score-bar-fill')));
    expect(fill.width, closeTo(200, 1));

    await tester.pumpWidget(
      _wrap(const ScoreBar(value: -20, showValue: false), width: 200),
    );
    final zero = tester.getSize(find.byKey(const ValueKey('score-bar-fill')));
    expect(zero.width, closeTo(0, 1));
  });
}
