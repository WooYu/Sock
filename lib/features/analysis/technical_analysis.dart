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

enum TrendPattern { climbing, reboundToMa5, mirrorBollUpper, consolidation }

extension TrendPatternX on TrendPattern {
  String get label => switch (this) {
    TrendPattern.climbing => '攀升',
    TrendPattern.reboundToMa5 => '反抽五日线',
    TrendPattern.mirrorBollUpper => '照镜子',
    TrendPattern.consolidation => '震荡',
  };
}

class TrendSignal {
  const TrendSignal({
    required this.pattern,
    required this.reason,
    this.support,
    this.resistance,
    this.target,
  });

  final TrendPattern pattern;
  final String reason;
  final double? support;
  final double? resistance;
  final double? target;
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
    required this.hitRuleNames,
    required this.conditions,
    required this.ruleCredibility,
    required this.modelName,
    required this.trendPattern,
    required this.trendReason,
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
  final List<String> hitRuleNames;
  final List<ConditionCheck> conditions;
  final double ruleCredibility;
  final String modelName;
  final TrendPattern trendPattern;
  final String trendReason;
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
    final hitRuleNames = <String>[];
    if (ruleBook != null) {
      final facts = RuleFacts(
        closeAboveMa20: trendPositive,
        volumeRatio: volumeRatio,
        supportDistance: supportDistance.toDouble(),
      );
      total = ruleBook!.activeRules.length;
      for (final rule in ruleBook!.activeRules) {
        if (ruleBook!.evaluate(rule, facts)) {
          hit++;
          hitRuleNames.add(rule.name);
        }
      }
    }
    final ruleCredibility =
        (0.4 + hit / (total == 0 ? 1 : total) * 0.5).clamp(0.4, 0.9) * 100;
    final trend = recognizeTrend(candles);
    final finalSupport = trend.support ?? combinedSupport;
    final finalResistance = trend.resistance ?? combinedResistance;
    final finalTarget = trend.target ?? combinedTarget;

    return StockAnalysis(
      lastClose: lastClose,
      support: finalSupport,
      resistance: finalResistance,
      target: finalTarget,
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
      hitRuleNames: List.unmodifiable(hitRuleNames),
      conditions: conditions,
      ruleCredibility: ruleCredibility,
      modelName: '本地规则引擎（启发式）',
      trendPattern: trend.pattern,
      trendReason: trend.reason,
    );
  }

  /// 识别次日走势模式，并给出该模式对应的支撑 / 压力 / 目标位。
  TrendSignal recognizeTrend(List<Candle> candles) {
    final n = candles.length;
    if (n < 22) {
      return const TrendSignal(
        pattern: TrendPattern.consolidation,
        reason: '数据不足，暂不预测',
      );
    }
    final sma5 = _calculator.sma(candles, period: 5);
    final sma10 = _calculator.sma(candles, period: 10);
    final sma20 = _calculator.sma(candles, period: 20);
    final bolls = _calculator.bollinger(
      candles,
      period: settings.bollPeriod,
      multiplier: settings.bollMultiplier,
    );
    final atr = _calculator.atr(candles, period: 14);
    final recent = candles.sublist(math.max(0, n - 20));
    final recentLow = recent.map((c) => c.low).reduce(math.min);
    final recentHigh = recent.map((c) => c.high).reduce(math.max);

    final close = candles[n - 1].close;
    final prevClose = candles[n - 2].close;
    final prevPrevClose = candles[n - 3].close;
    final ma5 = sma5[n - 1]!;
    final prevMa5 = sma5[n - 2]!;
    final ma10 = sma10[n - 1]!;
    final ma20 = sma20[n - 1]!;
    final bollUpper = bolls[n - 1]!.upper;
    final prevBollUpper = bolls[n - 2]!.upper;
    final prevPrevBollUpper = bolls[n - 3]!.upper;
    final ma30 = n >= 30 ? _calculator.sma(candles, period: 30).last! : double.nan;

    // 攀升：多头排列 + 价格站上 MA5 + MA5 上翘
    if (ma5 > ma10 && ma10 > ma20 && close >= ma5 && ma5 > prevMa5) {
      final resistance = bollUpper > close ? bollUpper : recentHigh;
      return TrendSignal(
        pattern: TrendPattern.climbing,
        reason: 'MA5/10/20 多头排列且 MA5 上翘，价格站上 MA5',
        support: ma10,
        resistance: resistance,
        target: ma30.isFinite && ma30 > resistance ? ma30 : resistance + atr,
      );
    }

    // 反抽五日线：昨日跌破 MA5，今日反弹回踩
    if (prevClose < prevMa5 && close > prevClose && close < ma5) {
      return TrendSignal(
        pattern: TrendPattern.reboundToMa5,
        reason: '昨日收盘跌破 MA5，今日反弹回踩 MA5',
        support: recentLow,
        resistance: ma5,
        target: ma10 > ma5 ? ma10 : ma5 + atr,
      );
    }

    // 照镜子（经典）：前日突破 BOLL 上轨 → 昨日跌破上轨 → 预计反抽上轨
    if (prevPrevClose > prevPrevBollUpper && prevClose < prevBollUpper) {
      return TrendSignal(
        pattern: TrendPattern.mirrorBollUpper,
        reason: '前日突破 BOLL 上轨，昨日跌破上轨，预计反抽上轨',
        support: prevBollUpper,
        resistance: recentHigh,
        target: recentHigh + atr,
      );
    }

    return const TrendSignal(
      pattern: TrendPattern.consolidation,
      reason: '多空不明，震荡整理',
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
