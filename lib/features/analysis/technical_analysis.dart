import 'dart:math' as math;

import '../../domain/stockcal_domain.dart';

class AnalysisException implements Exception {
  const AnalysisException(this.message);

  final String message;

  @override
  String toString() => message;
}

class IndicatorSettings {
  const IndicatorSettings({
    this.maShortPeriod = 5,
    this.maLongPeriod = 20,
    this.emaPeriod = 12,
    this.bollPeriod = 20,
    this.bollMultiplier = 2,
    this.volumePeriod = 5,
  });

  final int maShortPeriod;
  final int maLongPeriod;
  final int emaPeriod;
  final int bollPeriod;
  final double bollMultiplier;
  final int volumePeriod;

  IndicatorSettings copyWith({
    int? maShortPeriod,
    int? maLongPeriod,
    int? emaPeriod,
    int? bollPeriod,
    double? bollMultiplier,
    int? volumePeriod,
  }) => IndicatorSettings(
    maShortPeriod: maShortPeriod ?? this.maShortPeriod,
    maLongPeriod: maLongPeriod ?? this.maLongPeriod,
    emaPeriod: emaPeriod ?? this.emaPeriod,
    bollPeriod: bollPeriod ?? this.bollPeriod,
    bollMultiplier: bollMultiplier ?? this.bollMultiplier,
    volumePeriod: volumePeriod ?? this.volumePeriod,
  );

  Map<String, Object?> toJson() => {
    'maShortPeriod': maShortPeriod,
    'maLongPeriod': maLongPeriod,
    'emaPeriod': emaPeriod,
    'bollPeriod': bollPeriod,
    'bollMultiplier': bollMultiplier,
    'volumePeriod': volumePeriod,
  };

  static IndicatorSettings fromJson(Map<String, Object?> json) =>
      IndicatorSettings(
        maShortPeriod: (json['maShortPeriod']! as num).toInt(),
        maLongPeriod: (json['maLongPeriod']! as num).toInt(),
        emaPeriod: (json['emaPeriod']! as num).toInt(),
        bollPeriod: (json['bollPeriod']! as num).toInt(),
        bollMultiplier: (json['bollMultiplier']! as num).toDouble(),
        volumePeriod: (json['volumePeriod']! as num).toInt(),
      );

  @override
  bool operator ==(Object other) =>
      other is IndicatorSettings &&
      other.maShortPeriod == maShortPeriod &&
      other.maLongPeriod == maLongPeriod &&
      other.emaPeriod == emaPeriod &&
      other.bollPeriod == bollPeriod &&
      other.bollMultiplier == bollMultiplier &&
      other.volumePeriod == volumePeriod;

  @override
  int get hashCode => Object.hash(
    maShortPeriod,
    maLongPeriod,
    emaPeriod,
    bollPeriod,
    bollMultiplier,
    volumePeriod,
  );
}

class BollingerBand {
  const BollingerBand({
    required this.middle,
    required this.upper,
    required this.lower,
  });

  final double middle;
  final double upper;
  final double lower;
}

class VolumeIndicator {
  const VolumeIndicator({required this.average, required this.latestRatio});

  final List<double?> average;
  final double latestRatio;
}

class IndicatorCalculator {
  List<double?> sma(List<Candle> candles, {required int period}) {
    _validatePeriod(period);
    if (candles.length < period) {
      throw AnalysisException('计算 MA$period 至少需要 $period 根 K 线');
    }
    final result = List<double?>.filled(candles.length, null);
    var sum = 0.0;
    for (var index = 0; index < candles.length; index++) {
      sum += candles[index].close;
      if (index >= period) sum -= candles[index - period].close;
      if (index >= period - 1) result[index] = sum / period;
    }
    return result;
  }

  List<double?> ema(List<Candle> candles, {required int period}) {
    _validatePeriod(period);
    if (candles.length < period) {
      throw AnalysisException('计算 EMA$period 至少需要 $period 根 K 线');
    }
    final result = List<double?>.filled(candles.length, null);
    final seed =
        candles.take(period).fold<double>(0, (sum, item) => sum + item.close) /
        period;
    result[period - 1] = seed;
    final alpha = 2 / (period + 1);
    var previous = seed;
    for (var index = period; index < candles.length; index++) {
      previous = candles[index].close * alpha + previous * (1 - alpha);
      result[index] = previous;
    }
    return result;
  }

  List<BollingerBand?> bollinger(
    List<Candle> candles, {
    required int period,
    double multiplier = 2,
  }) {
    _validatePeriod(period);
    if (candles.length < period) {
      throw AnalysisException('计算 BOLL$period 至少需要 $period 根 K 线');
    }
    final result = List<BollingerBand?>.filled(candles.length, null);
    for (var index = period - 1; index < candles.length; index++) {
      final values = candles
          .sublist(index - period + 1, index + 1)
          .map((item) => item.close)
          .toList();
      final mean = values.fold<double>(0, (sum, value) => sum + value) / period;
      final variance =
          values.fold<double>(
            0,
            (sum, value) => sum + math.pow(value - mean, 2),
          ) /
          period;
      final deviation = math.sqrt(variance);
      result[index] = BollingerBand(
        middle: mean,
        upper: mean + deviation * multiplier,
        lower: mean - deviation * multiplier,
      );
    }
    return result;
  }

  VolumeIndicator volume(List<Candle> candles, {required int period}) {
    _validatePeriod(period);
    if (candles.length < period) {
      throw AnalysisException('计算成交量均线至少需要 $period 根 K 线');
    }
    final average = List<double?>.filled(candles.length, null);
    var sum = 0.0;
    for (var index = 0; index < candles.length; index++) {
      sum += candles[index].volume;
      if (index >= period) sum -= candles[index - period].volume;
      if (index >= period - 1) average[index] = sum / period;
    }
    final latestAverage = average.last!;
    return VolumeIndicator(
      average: average,
      latestRatio: latestAverage == 0 ? 0 : candles.last.volume / latestAverage,
    );
  }

  void _validatePeriod(int period) {
    if (period <= 0) throw ArgumentError.value(period, 'period', '必须大于零');
  }
}

enum RiskLevel { low, medium, high }

enum Direction { bullish, neutral, bearish }

enum OperationCycle { short, swing, long }

extension OperationCycleX on OperationCycle {
  String get label => switch (this) {
    OperationCycle.short => '短线',
    OperationCycle.swing => '波段',
    OperationCycle.long => '中长线',
  };

  int get lookback => switch (this) {
    OperationCycle.short => 10,
    OperationCycle.swing => 20,
    OperationCycle.long => 60,
  };
}

class FutureIndicatorPoint {
  const FutureIndicatorPoint({
    required this.day,
    required this.maShort,
    required this.maLong,
    required this.bollUpper,
    required this.bollMiddle,
    required this.bollLower,
  });

  final DateTime day;
  final double maShort;
  final double maLong;
  final double bollUpper;
  final double bollMiddle;
  final double bollLower;
}

class MatchedRule {
  const MatchedRule({required this.name, required this.score});

  final String name;
  final int score;
}

class StockAnalysis {
  const StockAnalysis({
    required this.lastClose,
    required this.support,
    required this.resistance,
    required this.target,
    required this.confidence,
    required this.riskLevel,
    required this.direction,
    required this.directionStrength,
    required this.matchedRules,
    required this.maShort,
    required this.maLong,
    required this.ema,
    required this.bollinger,
    required this.volumeRatio,
    required this.future,
    required this.settings,
  });

  final double lastClose;
  final double support;
  final double resistance;
  final double target;
  final double confidence;
  final RiskLevel riskLevel;
  final Direction direction;
  final double directionStrength;
  final List<MatchedRule> matchedRules;
  final double maShort;
  final double maLong;
  final double ema;
  final BollingerBand bollinger;
  final double volumeRatio;
  final List<FutureIndicatorPoint> future;
  final IndicatorSettings settings;
}

class StockAnalyzer {
  StockAnalyzer({
    IndicatorCalculator? calculator,
    this.settings = const IndicatorSettings(),
  }) : _calculator = calculator ?? IndicatorCalculator();

  final IndicatorCalculator _calculator;
  IndicatorSettings settings;

  StockAnalysis analyze(List<Candle> source, {int lookback = 20}) {
    if (source.length < 20) {
      throw const AnalysisException('个股分析至少需要 20 根日 K 线');
    }
    final candles = List<Candle>.of(source);
    final recent = candles.sublist(math.max(0, candles.length - lookback));
    final support = recent.map((item) => item.low).reduce(math.min);
    final resistance = recent.map((item) => item.high).reduce(math.max);
    final range = resistance - support;
    final lastClose = candles.last.close;
    final maShort = _calculator.sma(candles, period: settings.maShortPeriod).last!;
    final maLong = _calculator.sma(candles, period: settings.maLongPeriod).last!;
    final ema = _calculator.ema(candles, period: settings.emaPeriod).last!;
    final boll = _calculator
        .bollinger(
          candles,
          period: settings.bollPeriod,
          multiplier: settings.bollMultiplier,
        )
        .last!;
    final volumeRatio = _calculator
        .volume(candles, period: settings.volumePeriod)
        .latestRatio;
    final trendPositive = lastClose >= maLong && maShort >= maLong;
    final nearSupport = lastClose - support <= range * 0.35;
    final matchedRules = <MatchedRule>[
      if (trendPositive)
        MatchedRule(name: 'MA${settings.maShortPeriod} 上穿并站稳 MA${settings.maLongPeriod}', score: 86),
      if (lastClose >= ema)
        MatchedRule(name: '收盘价位于 EMA${settings.emaPeriod} 上方', score: 74),
      if (volumeRatio >= 1)
        MatchedRule(name: '成交量不低于${settings.volumePeriod}日均量', score: 61),
      if (nearSupport) MatchedRule(name: '价格接近二十日支撑区', score: 48),
      if (lastClose < boll.upper) MatchedRule(name: '仍处于 BOLL 上轨以内', score: 39),
    ]..sort((a, b) => b.score.compareTo(a.score));
    final confidence = (0.5 + matchedRules.length * 0.08).clamp(0.5, 0.9);
    final direction = trendPositive
        ? Direction.bullish
        : maShort >= maLong
        ? Direction.neutral
        : Direction.bearish;
    final directionStrength = (confidence * 100).round().toDouble();
    final supportDistance = lastClose == 0
        ? 1
        : (lastClose - support) / lastClose;
    final risk = supportDistance < 0.02
        ? RiskLevel.high
        : volumeRatio > 1.5
        ? RiskLevel.medium
        : RiskLevel.low;

    return StockAnalysis(
      lastClose: lastClose,
      support: support,
      resistance: resistance,
      target: resistance + range * 0.382,
      confidence: confidence,
      riskLevel: risk,
      direction: direction,
      directionStrength: directionStrength,
      matchedRules: List.unmodifiable(matchedRules),
      maShort: maShort,
      maLong: maLong,
      ema: ema,
      bollinger: boll,
      volumeRatio: volumeRatio,
      future: _extend(candles, sessions: 3),
      settings: settings,
    );
  }

  List<FutureIndicatorPoint> _extend(
    List<Candle> source, {
    required int sessions,
  }) {
    final rolling = List<Candle>.of(source);
    final result = <FutureIndicatorPoint>[];
    var day = source.last.day;
    for (var index = 0; index < sessions; index++) {
      day = _nextTradingDay(day);
      final projectedClose = _linearProjection(rolling);
      rolling.add(
        Candle(
          day: day,
          open: projectedClose,
          high: projectedClose,
          low: projectedClose,
          close: projectedClose,
          volume: rolling.last.volume,
        ),
      );
      final boll = _calculator
          .bollinger(
            rolling,
            period: settings.bollPeriod,
            multiplier: settings.bollMultiplier,
          )
          .last!;
      result.add(
        FutureIndicatorPoint(
          day: day,
          maShort: _calculator.sma(rolling, period: settings.maShortPeriod).last!,
          maLong: _calculator.sma(rolling, period: settings.maLongPeriod).last!,
          bollUpper: boll.upper,
          bollMiddle: boll.middle,
          bollLower: boll.lower,
        ),
      );
    }
    return List.unmodifiable(result);
  }

  double _linearProjection(List<Candle> candles) {
    final recent = candles.sublist(candles.length - 5);
    final dailyChange =
        (recent.last.close - recent.first.close) / (recent.length - 1);
    return recent.last.close + dailyChange;
  }

  DateTime _nextTradingDay(DateTime day) {
    var next = day.add(const Duration(days: 1));
    while (next.weekday == DateTime.saturday ||
        next.weekday == DateTime.sunday) {
      next = next.add(const Duration(days: 1));
    }
    return next;
  }
}
