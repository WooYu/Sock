import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/direction_gauge.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/theme/stockcal_theme.dart';
import 'package:stockcal/widgets/design/score_bar.dart';

Widget _wrap(Widget child) => MaterialApp(
  theme: buildStockCalTheme(Brightness.light),
  home: Scaffold(body: Center(child: child)),
);

void main() {
  testWidgets('DirectionGauge renders strength and direction label', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const DirectionGauge(strength: 64.0, direction: Direction.bullish)),
    );
    expect(find.text('64/100'), findsOneWidget);
    expect(find.text('多头'), findsOneWidget);
    expect(find.byType(ScoreBar), findsOneWidget);
    expect(find.byKey(const ValueKey('score-gauge-track')), findsOneWidget);
    expect(find.byKey(const ValueKey('score-gauge-marker')), findsOneWidget);
  });

  testWidgets('DirectionGauge renders bearish label', (tester) async {
    await tester.pumpWidget(
      _wrap(const DirectionGauge(strength: 30.0, direction: Direction.bearish)),
    );
    expect(find.text('30/100'), findsOneWidget);
    expect(find.text('空头'), findsOneWidget);
  });
}
