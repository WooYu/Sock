import '../../domain/stockcal_domain.dart';

class Security {
  const Security({
    required this.code,
    required this.name,
    required this.pinyin,
    required this.initials,
    required this.exchange,
    required this.industry,
  });

  final String code;
  final String name;
  final String pinyin;
  final String initials;
  final String exchange;
  final String industry;
}

abstract interface class StockCatalog {
  Future<List<Security>> search(String query, {int limit = 20});
}

class MemoryStockCatalog implements StockCatalog {
  const MemoryStockCatalog(this.securities);

  final List<Security> securities;

  @override
  Future<List<Security>> search(String query, {int limit = 20}) async {
    final normalized = query.trim().toLowerCase().replaceAll(' ', '');
    final matches = securities.where((security) {
      return normalized.isEmpty ||
          security.code.contains(normalized) ||
          security.name.contains(normalized) ||
          security.pinyin.contains(normalized) ||
          security.initials.contains(normalized);
    }).toList();
    matches.sort((a, b) {
      final aExact = a.code == normalized ? 0 : 1;
      final bExact = b.code == normalized ? 0 : 1;
      final byExact = aExact.compareTo(bExact);
      if (byExact != 0) return byExact;
      return a.code.compareTo(b.code);
    });
    return matches.take(limit).toList(growable: false);
  }
}

enum MarketDataState { realtime, delayed, stale, offlineCache }

class MarketFreshness {
  static MarketDataState evaluate({
    required DateTime fetchedAt,
    required DateTime now,
    required Duration realtimeThreshold,
    required Duration staleThreshold,
    required bool isOnline,
  }) {
    if (!isOnline) return MarketDataState.offlineCache;
    final age = now.difference(fetchedAt);
    if (age <= realtimeThreshold) return MarketDataState.realtime;
    if (age <= staleThreshold) return MarketDataState.delayed;
    return MarketDataState.stale;
  }
}

class AShareQuote {
  const AShareQuote({
    required this.security,
    required this.price,
    required this.previousClose,
    required this.open,
    required this.high,
    required this.low,
    required this.volume,
    required this.turnover,
    required this.limitRatio,
  });

  final Security security;
  final double price;
  final double previousClose;
  final double open;
  final double high;
  final double low;
  final int volume;
  final double turnover;
  final double limitRatio;

  double get change => price - previousClose;
  double get changePercent =>
      previousClose == 0 ? 0 : change / previousClose * 100;
  double get limitUp => _roundPrice(previousClose * (1 + limitRatio));
  double get limitDown => _roundPrice(previousClose * (1 - limitRatio));

  double _roundPrice(double value) => (value * 100).round() / 100;
}

class MarketSourceInfo {
  const MarketSourceInfo({
    required this.name,
    required this.fetchedAt,
    required this.state,
    required this.isOnline,
  });

  final String name;
  final DateTime fetchedAt;
  final MarketDataState state;
  final bool isOnline;
}

class MarketSnapshot {
  const MarketSnapshot({
    required this.quote,
    required this.dailyCandles,
    required this.source,
  });

  final AShareQuote quote;
  final List<Candle> dailyCandles;
  final MarketSourceInfo source;
}

abstract interface class AShareMarketAdapter {
  Future<MarketSnapshot> snapshot(String code);
}

class MarketLoadException implements Exception {
  const MarketLoadException(this.message);

  final String message;

  @override
  String toString() => message;
}

class DemoAshareMarketAdapter implements AShareMarketAdapter {
  DemoAshareMarketAdapter({DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  final DateTime Function() _clock;

  @override
  Future<MarketSnapshot> snapshot(String code) async {
    final security = DemoAshareData.securities.firstWhere(
      (item) => item.code == code,
      orElse: () => throw ArgumentError('未知 A 股代码：$code'),
    );
    final now = _clock();
    final fetchedAt = now.subtract(const Duration(minutes: 15));
    final candles = DemoAshareData.candlesFor(code);
    final previousClose = code == '600519'
        ? 1729.0
        : candles[candles.length - 2].close;
    final price = code == '600519' ? 1742.0 : candles.last.close;
    final limitRatio = code.startsWith('300') || code.startsWith('688')
        ? 0.20
        : 0.10;
    return MarketSnapshot(
      quote: AShareQuote(
        security: security,
        price: price,
        previousClose: previousClose,
        open: candles.last.open,
        high: candles.last.high,
        low: candles.last.low,
        volume: candles.last.volume,
        turnover: price * candles.last.volume,
        limitRatio: limitRatio,
      ),
      dailyCandles: candles,
      source: MarketSourceInfo(
        name: 'StockCal 演示行情',
        fetchedAt: fetchedAt,
        state: MarketFreshness.evaluate(
          fetchedAt: fetchedAt,
          now: now,
          realtimeThreshold: const Duration(minutes: 1),
          staleThreshold: const Duration(minutes: 30),
          isOnline: true,
        ),
        isOnline: true,
      ),
    );
  }
}

class DemoAshareData {
  static const securities = [
    Security(
      code: '600519',
      name: '贵州茅台',
      pinyin: 'guizhoumaotai',
      initials: 'gzmt',
      exchange: 'SH',
      industry: '白酒',
    ),
    Security(
      code: '000001',
      name: '平安银行',
      pinyin: 'pinganyinhang',
      initials: 'payh',
      exchange: 'SZ',
      industry: '银行',
    ),
    Security(
      code: '300750',
      name: '宁德时代',
      pinyin: 'ningdeshidai',
      initials: 'ndsd',
      exchange: 'SZ',
      industry: '电池',
    ),
    Security(
      code: '688981',
      name: '中芯国际',
      pinyin: 'zhongxinguoji',
      initials: 'zxgj',
      exchange: 'SH',
      industry: '半导体',
    ),
  ];

  static List<Candle> candlesFor(String code) {
    final base = switch (code) {
      '600519' => 1680.0,
      '300750' => 198.0,
      '688981' => 48.0,
      _ => 12.0,
    };
    return List.generate(40, (index) {
      final trend = index * (code == '600519' ? 1.55 : 0.08);
      final wave = switch (index % 5) {
        0 => -4.0,
        1 => 2.0,
        2 => 6.0,
        3 => -1.0,
        _ => 3.0,
      };
      final scale = code == '600519' ? 1.0 : 0.08;
      final close = base + trend + wave * scale;
      final open = close - (index.isEven ? 2.0 : -1.5) * scale;
      return Candle(
        day: DateTime(2026, 6, 22).add(Duration(days: index)),
        open: open,
        high: (open > close ? open : close) + 8 * scale,
        low: (open < close ? open : close) - 7 * scale,
        close: close,
        volume: 18000 + index * 420 + (index % 4) * 1500,
      );
    });
  }
}
