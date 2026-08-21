import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/direction_gauge.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';

void main() {
  testWidgets('DirectionGauge renders strength and direction label', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: DirectionGauge(strength: 64.0, direction: Direction.bullish),
        ),
      ),
    );
    expect(find.text('64/100'), findsOneWidget);
    expect(find.text('多头'), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
  });

  testWidgets('DirectionGauge renders bearish label', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: DirectionGauge(strength: 30.0, direction: Direction.bearish),
        ),
      ),
    );
    expect(find.text('30/100'), findsOneWidget);
    expect(find.text('空头'), findsOneWidget);
  });
}
