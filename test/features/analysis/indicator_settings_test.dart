import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';
import 'package:stockcal/features/market/market_data.dart';

void main() {
  test('indicator settings default to the standard five-value set', () {
    const settings = IndicatorSettings();
    expect(settings.maShortPeriod, 5);
    expect(settings.maLongPeriod, 20);
    expect(settings.emaPeriod, 12);
    expect(settings.bollPeriod, 20);
    expect(settings.bollMultiplier, 2);
    expect(settings.volumePeriod, 5);
  });

  test('indicator settings round-trip through json and copyWith', () {
    const original = IndicatorSettings(
      maShortPeriod: 3,
      maLongPeriod: 10,
      emaPeriod: 5,
      bollPeriod: 14,
      bollMultiplier: 2.5,
      volumePeriod: 6,
    );
    final renamed = original.copyWith(maLongPeriod: 12);

    expect(renamed.maLongPeriod, 12);
    expect(renamed.maShortPeriod, 3);

    final restored = IndicatorSettings.fromJson(renamed.toJson());
    expect(restored.maLongPeriod, 12);
    expect(restored.bollMultiplier, 2.5);
    expect(restored.volumePeriod, 6);
  });

  test('StockAnalyzer applies custom indicator periods to its outputs', () {
    final snapshot = DemoAshareData.candlesFor('600519');
    final settings = const IndicatorSettings(
      maShortPeriod: 3,
      maLongPeriod: 10,
      emaPeriod: 5,
    );
    final analysis = StockAnalyzer(settings: settings).analyze(snapshot);

    final calculator = IndicatorCalculator();
    final expectedShort = calculator.sma(snapshot, period: 3).last!;
    final expectedLong = calculator.sma(snapshot, period: 10).last!;

    expect(analysis.maShort, closeTo(expectedShort, 0.0001));
    expect(analysis.maLong, closeTo(expectedLong, 0.0001));
    expect(analysis.settings.maLongPeriod, 10);
    expect(analysis.matchedRules.any((rule) => rule.name.contains('MA10')), isTrue);
  });
}
