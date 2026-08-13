import '../../domain/stockcal_domain.dart';
import 'package:candlesticks/candlesticks.dart' as chart;

enum ChartTimeframe { daily, weekly, monthly }

enum AdjustmentMode { none, forward, backward }

class AdjustmentFactor {
  const AdjustmentFactor({
    required this.day,
    required this.forward,
    required this.backward,
  });

  final DateTime day;
  final double forward;
  final double backward;
}

class ChartDataTransformer {
  const ChartDataTransformer._();

  static List<Candle> aggregate(
    List<Candle> candles,
    ChartTimeframe timeframe,
  ) {
    final ordered = [...candles]..sort((a, b) => a.day.compareTo(b.day));
    if (timeframe == ChartTimeframe.daily) return ordered;

    final groups = <String, List<Candle>>{};
    for (final candle in ordered) {
      final key = timeframe == ChartTimeframe.weekly
          ? _weekKey(candle.day)
          : '${candle.day.year}-${candle.day.month}';
      groups.putIfAbsent(key, () => []).add(candle);
    }
    return groups.values.map(_merge).toList(growable: false);
  }

  static List<Candle> adjust(
    List<Candle> candles,
    AdjustmentMode mode,
    List<AdjustmentFactor> factors,
  ) {
    if (mode == AdjustmentMode.none) return [...candles];
    final byDay = {for (final factor in factors) _dayKey(factor.day): factor};
    return candles
        .map((candle) {
          final factor = byDay[_dayKey(candle.day)];
          final multiplier = switch (mode) {
            AdjustmentMode.none => 1.0,
            AdjustmentMode.forward => factor?.forward ?? 1.0,
            AdjustmentMode.backward => factor?.backward ?? 1.0,
          };
          return Candle(
            day: candle.day,
            open: candle.open * multiplier,
            high: candle.high * multiplier,
            low: candle.low * multiplier,
            close: candle.close * multiplier,
            volume: candle.volume,
          );
        })
        .toList(growable: false);
  }

  static Candle _merge(List<Candle> group) {
    return Candle(
      day: group.last.day,
      open: group.first.open,
      high: group.map((item) => item.high).reduce(_max),
      low: group.map((item) => item.low).reduce(_min),
      close: group.last.close,
      volume: group.fold(0, (total, item) => total + item.volume),
    );
  }

  static String _weekKey(DateTime day) {
    final monday = day.subtract(Duration(days: day.weekday - DateTime.monday));
    return _dayKey(monday);
  }

  static String _dayKey(DateTime day) => '${day.year}-${day.month}-${day.day}';

  static double _max(double a, double b) => a > b ? a : b;
  static double _min(double a, double b) => a < b ? a : b;
}

class CandlestickAdapter {
  const CandlestickAdapter._();

  static List<chart.Candle> newestFirst(List<Candle> candles) {
    final ordered = [...candles]..sort((a, b) => b.day.compareTo(a.day));
    return ordered
        .map(
          (item) => chart.Candle(
            date: item.day,
            high: item.high,
            low: item.low,
            open: item.open,
            close: item.close,
            volume: item.volume.toDouble(),
          ),
        )
        .toList(growable: false);
  }
}
