import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/chart/professional_chart_screen.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  test('chart palette constants match the deep-space theme', () {
    expect(StockCalColors.gain, const Color(0xFFF0525D));
    expect(StockCalColors.loss, const Color(0xFF2BB673));
    expect(StockCalColors.accent, const Color(0xFF38C3E0));
  });

  testWidgets('chart renders with theme colors', (tester) async {
    final candles = [
      for (var i = 0; i < 10; i++)
        Candle(
          day: DateTime(2026, 1, i + 1),
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 100,
        ),
    ];
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.dark),
      home: ProfessionalChartScreen(candles: candles),
    ));
    expect(find.byType(ProfessionalChartScreen), findsOneWidget);
  });
}
