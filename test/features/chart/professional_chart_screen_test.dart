import 'package:candlesticks/candlesticks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart' as domain;
import 'package:stockcal/features/chart/chart_data.dart';
import 'package:stockcal/features/chart/professional_chart_screen.dart';

void main() {
  testWidgets(
    'renders chart with timeframe, adjustment, and forecast boundary',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: ProfessionalChartScreen(candles: _candles())),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(Candlesticks), findsOneWidget);
      expect(find.text('日线'), findsOneWidget);
      expect(find.text('周线'), findsOneWidget);
      expect(find.text('月线'), findsOneWidget);
      expect(find.text('不复权'), findsOneWidget);
      expect(find.text('真实行情'), findsOneWidget);
      expect(find.text('预测区'), findsOneWidget);
    },
  );

  testWidgets('switches timeframe and adjustment mode', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ProfessionalChartScreen(candles: _candles())),
      ),
    );

    await tester.tap(find.text('周线'));
    await tester.pump();
    final timeframeControl = tester.widget<SegmentedButton<ChartTimeframe>>(
      find.byType(SegmentedButton<ChartTimeframe>),
    );
    expect(timeframeControl.selected, {ChartTimeframe.weekly});

    await tester.tap(find.text('不复权'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('前复权').last);
    await tester.pumpAndSettle();
    expect(find.text('前复权'), findsOneWidget);
  });
}

List<domain.Candle> _candles() {
  return List.generate(20, (index) {
    final price = 10.0 + index;
    return domain.Candle(
      day: DateTime(2026, 7, 1).add(Duration(days: index)),
      open: price,
      high: price + 2,
      low: price - 1,
      close: price + 1,
      volume: 1000 + index * 10,
    );
  });
}
