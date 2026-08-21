import 'dart:math' as math;

import '../../domain/stockcal_domain.dart';
import '../rules/rule_engine.dart';

class AnalysisException implements Exception {
  const AnalysisException(this.message);

  final String message;

  @override
  String toString() => message;
}

enum RuleBand { primary, alternate, risk, caution }

class ParameterItem {
  const ParameterItem({
    required this.label,
    required this.value,
    required this.unit,
  });

  final String label;
  final double value;
  final String unit;
}

class ConditionCheck {
  const ConditionCheck({required this.label, required this.met});

  final String label;
  final bool met;
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

  double atr(List<Candle> candles, {required int period}) {
    _validatePeriod(period);
    if (candles.length < period + 1) {
      throw AnalysisException('计算 ATR$period 至少需要 ${period + 1} 根 K 线');
    }
    var sum = 0.0;
    for (var i = 1; i <= period; i++) {
      final c = candles[i];
      final tr = math.max(
        c.high - c.low,
        math.max(
          (c.high - candles[i - 1].close).abs(),
          (c.low - candles[i - 1].close).abs(),
        ),
      );
      sum += tr;
    }
    return sum / period;
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
  /// 完整 MA 周期（5/10/20/30/60/90/120/250）。
  static const maPeriods = [5, 10, 20, 30, 60, 90, 120, 250];

  const FutureIndicatorPoint({
    required this.day,
    required this.maValues,
    required this.bollUpper,
    required this.bollMiddle,
    required this.bollLower,
  });

  final DateTime day;
  final Map<int, double> maValues;
  final double bollUpper;
  final double bollMiddle;
  final double bollLower;

  double ma(int period) => maValues[period] ?? double.nan;
}

class MatchedRule {
  const MatchedRule({
    required this.name,
    required this.score,
    required this.band,
  });

  final String name;
  final int score;
  final RuleBand band;
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
    required this.maValues,
    required this.volumeRatio,
    required this.future,
    required this.settings,
    required this.amplitude,
    required this.atr,
    required this.parameters,
    required this.ruleHitCount,
    required this.ruleTotalCount,
    required this.conditions,
    required this.ruleCredibility,
    required this.modelName,
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
  final Map<int, double> maValues;
  final double volumeRatio;
  final List<FutureIndicatorPoint> future;
  final IndicatorSettings settings;
  final double amplitude;
  final double atr;
  final List<ParameterItem> parameters;
  final int ruleHitCount;
  final int ruleTotalCount;
  final List<ConditionCheck> conditions;
  final double ruleCredibility;
  final String modelName;
}

class StockAnalyzer {
  StockAnalyzer({
    IndicatorCalculator? calculator,
    this.settings = const IndicatorSettings(),
    this.ruleBook,
  }) : _calculator = calculator ?? IndicatorCalculator();

  final IndicatorCalculator _calculator;
  IndicatorSettings settings;
  final RuleBook? ruleBook;

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
    final maValues = {
      for (final period in FutureIndicatorPoint.maPeriods)
        period: candles.length >= period
            ? _calculator.sma(candles, period: period).last!
            : double.nan,
    };
    // 支撑 / 压力 / 目标：高低点 + MA/BOLL 位结合。
    final supportLevels = <double>[support];
    for (final value in maValues.values) {
      if (!value.isNaN && value <= lastClose) supportLevels.add(value);
    }
    if (boll.lower <= lastClose) supportLevels.add(boll.lower);
    final combinedSupport = supportLevels.reduce((a, b) => a > b ? a : b);

    final resistanceLevels = <double>[resistance];
    for (final value in maValues.values) {
      if (!value.isNaN && value >= lastClose) resistanceLevels.add(value);
    }
    if (boll.upper >= lastClose) resistanceLevels.add(boll.upper);
    final combinedResistance = resistanceLevels.reduce((a, b) => a < b ? a : b);

    final aboveResistance = <double>[];
    for (final value in maValues.values) {
      if (!value.isNaN && value > combinedResistance) {
        aboveResistance.add(value);
      }
    }
    if (boll.upper > combinedResistance) aboveResistance.add(boll.upper);
    final combinedTarget = aboveResistance.isEmpty
        ? combinedResistance + (combinedResistance - combinedSupport)
        : aboveResistance.reduce((a, b) => a < b ? a : b);
    final trendPositive = lastClose >= maLong && maShort >= maLong;
    final nearSupport = lastClose - support <= range * 0.35;
    final matchedRules = <MatchedRule>[
      if (trendPositive)
        MatchedRule(
          name: 'MA${settings.maShortPeriod} 上穿并站稳 MA${settings.maLongPeriod}',
          score: 86,
          band: RuleBand.primary,
        ),
      if (lastClose >= ema)
        MatchedRule(
          name: '收盘价位于 EMA${settings.emaPeriod} 上方',
          score: 74,
          band: RuleBand.alternate,
        ),
      if (volumeRatio >= 1)
        MatchedRule(
          name: '成交量不低于${settings.volumePeriod}日均量',
          score: 61,
          band: RuleBand.risk,
        ),
      if (nearSupport)
        MatchedRule(
          name: '价格接近二十日支撑区',
          score: 48,
          band: RuleBand.risk,
        ),
      if (lastClose < boll.upper)
        MatchedRule(
          name: '仍处于 BOLL 上轨以内',
          score: 39,
          band: RuleBand.caution,
        ),
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

    final prevClose = candles.length > 1
        ? candles[candles.length - 2].close
        : lastClose;
    final amplitude = prevClose == 0
        ? 0.0
        : (candles.last.high - candles.last.low) / prevClose * 100;
    final atr = _calculator.atr(candles, period: 14);
    final parameters = <ParameterItem>[
      ParameterItem(label: 'MA${settings.maShortPeriod}', value: maShort, unit: ''),
      ParameterItem(label: 'MA${settings.maLongPeriod}', value: maLong, unit: ''),
      ParameterItem(label: 'EMA${settings.emaPeriod}', value: ema, unit: ''),
      ParameterItem(label: 'BOLL 上轨', value: boll.upper, unit: ''),
      ParameterItem(label: 'BOLL 中轨', value: boll.middle, unit: ''),
      ParameterItem(label: 'BOLL 下轨', value: boll.lower, unit: ''),
      ParameterItem(label: 'ATR', value: atr, unit: ''),
      ParameterItem(label: '振幅', value: amplitude, unit: '%'),
      ParameterItem(label: '量比', value: volumeRatio, unit: ''),
      ParameterItem(label: '昨收', value: prevClose, unit: ''),
      ParameterItem(label: '今开', value: candles.last.open, unit: ''),
      ParameterItem(label: '最高', value: candles.last.high, unit: ''),
    ];
    final conditions = <ConditionCheck>[
      ConditionCheck(
        label: 'MA${settings.maShortPeriod} 上移',
        met: maShort >= maLong,
      ),
      ConditionCheck(label: 'BOLL 抬升', met: lastClose >= boll.middle),
      ConditionCheck(label: '振幅达标', met: amplitude >= 3),
    ];
    var hit = 0;
    var total = matchedRules.length;
    if (ruleBook != null) {
      final facts = RuleFacts(
        closeAboveMa20: trendPositive,
        volumeRatio: volumeRatio,
        supportDistance: supportDistance.toDouble(),
      );
      total = ruleBook!.activeRules.length;
      hit = ruleBook!.activeRules
          .where((rule) => ruleBook!.evaluate(rule, facts))
          .length;
    }
    final ruleCredibility =
        (0.4 + hit / (total == 0 ? 1 : total) * 0.5).clamp(0.4, 0.9) * 100;

    return StockAnalysis(
      lastClose: lastClose,
      support: combinedSupport,
      resistance: combinedResistance,
      target: combinedTarget,
      confidence: confidence,
      riskLevel: risk,
      direction: direction,
      directionStrength: directionStrength,
      matchedRules: List.unmodifiable(matchedRules),
      maShort: maShort,
      maLong: maLong,
      ema: ema,
      bollinger: boll,
      maValues: maValues,
      volumeRatio: volumeRatio,
      future: _extend(candles, sessions: 3),
      settings: settings,
      amplitude: amplitude,
      atr: atr,
      parameters: parameters,
      ruleHitCount: hit,
      ruleTotalCount: total,
      conditions: conditions,
      ruleCredibility: ruleCredibility,
      modelName: 'GPT-5 轻量分类模型',
    );
  }

  /// 用线性外推补齐未来 N 天蜡烛，返回「历史 + 未来」完整序列。
  List<Candle> extendCandles(List<Candle> source, {int sessions = 3}) {
    final rolling = List<Candle>.of(source);
    for (var index = 0; index < sessions; index++) {
      final day = _nextTradingDay(rolling.last.day);
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
    }
    return rolling;
  }

  List<FutureIndicatorPoint> _extend(
    List<Candle> source, {
    required int sessions,
  }) {
    final rolling = extendCandles(source, sessions: sessions);
    final result = <FutureIndicatorPoint>[];
    for (var index = 0; index < sessions; index++) {
      final upto = source.length + index + 1;
      final slice = rolling.sublist(0, upto);
      final day = rolling[upto - 1].day;
      final boll = _calculator
          .bollinger(
            slice,
            period: settings.bollPeriod,
            multiplier: settings.bollMultiplier,
          )
          .last!;
      result.add(
        FutureIndicatorPoint(
          day: day,
          maValues: {
            for (final period in FutureIndicatorPoint.maPeriods)
              period: slice.length >= period
                  ? _calculator.sma(slice, period: period).last!
                  : double.nan,
          },
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
