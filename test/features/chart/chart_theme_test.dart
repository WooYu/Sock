import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/chart/professional_chart_screen.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  test('chart palette constants follow the prototype palette', () {
    expect(StockCalColors.gain, const Color(0xFFE94052));
    expect(StockCalColors.loss, const Color(0xFF0A9F6F));
    expect(StockCalColors.accent, const Color(0xFF4057E8));
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
