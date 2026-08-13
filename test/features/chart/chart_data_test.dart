import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/domain/stockcal_domain.dart';
import 'package:stockcal/features/chart/chart_data.dart';

void main() {
  group('ChartDataTransformer', () {
    final candles = [
      _candle(2026, 7, 30, 10, 12, 9, 11, 100),
      _candle(2026, 7, 31, 11, 13, 10, 12, 120),
      _candle(2026, 8, 3, 12, 15, 11, 14, 150),
      _candle(2026, 8, 4, 14, 16, 13, 15, 180),
    ];

    test('aggregates daily candles into trading weeks', () {
      final result = ChartDataTransformer.aggregate(
        candles,
        ChartTimeframe.weekly,
      );

      expect(result, hasLength(2));
      expect(result.first.day, DateTime(2026, 7, 31));
      expect(result.first.open, 10);
      expect(result.first.high, 13);
      expect(result.first.low, 9);
      expect(result.first.close, 12);
      expect(result.first.volume, 220);
      expect(result.last.day, DateTime(2026, 8, 4));
      expect(result.last.open, 12);
      expect(result.last.close, 15);
      expect(result.last.volume, 330);
    });

    test('aggregates daily candles into calendar months', () {
      final result = ChartDataTransformer.aggregate(
        candles,
        ChartTimeframe.monthly,
      );

      expect(result, hasLength(2));
      expect(result.first.day, DateTime(2026, 7, 31));
      expect(result.first.open, 10);
      expect(result.first.close, 12);
      expect(result.last.day, DateTime(2026, 8, 4));
      expect(result.last.high, 16);
      expect(result.last.low, 11);
    });

    test('returns an independent daily list in chronological order', () {
      final result = ChartDataTransformer.aggregate(
        candles.reversed.toList(),
        ChartTimeframe.daily,
      );

      expect(
        result.map((item) => item.day),
        orderedEquals(candles.map((item) => item.day)),
      );
      expect(identical(result, candles), isFalse);
    });

    test('applies provider supplied forward factors to prices only', () {
      final result = ChartDataTransformer.adjust(
        candles.take(2).toList(),
        AdjustmentMode.forward,
        [
          AdjustmentFactor(
            day: DateTime(2026, 7, 30),
            forward: 0.5,
            backward: 1,
          ),
          AdjustmentFactor(
            day: DateTime(2026, 7, 31),
            forward: 0.75,
            backward: 1,
          ),
        ],
      );

      expect(result.first.open, 5);
      expect(result.first.high, 6);
      expect(result.first.low, 4.5);
      expect(result.first.close, 5.5);
      expect(result.first.volume, 100);
      expect(result.last.close, 9);
    });

    test('uses backward factors and leaves missing dates unchanged', () {
      final result = ChartDataTransformer.adjust(
        candles.take(2).toList(),
        AdjustmentMode.backward,
        [AdjustmentFactor(day: DateTime(2026, 7, 30), forward: 1, backward: 2)],
      );

      expect(result.first.close, 22);
      expect(result.last.close, 12);
      expect(result.last.volume, 120);
    });
  });

  test('chart adapter exposes newest candle first without mutating input', () {
    final candles = [
      _candle(2026, 8, 3, 10, 12, 9, 11, 100),
      _candle(2026, 8, 4, 11, 13, 10, 12, 120),
    ];

    final result = CandlestickAdapter.newestFirst(candles);

    expect(result.first.date, DateTime(2026, 8, 4));
    expect(result.last.date, DateTime(2026, 8, 3));
    expect(candles.first.day, DateTime(2026, 8, 3));
  });
}

Candle _candle(
  int year,
  int month,
  int day,
  double open,
  double high,
  double low,
  double close,
  int volume,
) {
  return Candle(
    day: DateTime(year, month, day),
    open: open,
    high: high,
    low: low,
    close: close,
    volume: volume,
  );
}
