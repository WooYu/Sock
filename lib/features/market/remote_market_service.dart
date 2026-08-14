import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../domain/stockcal_domain.dart';
import 'market_data.dart';

class RemoteMarketService implements StockCatalog, AShareMarketAdapter {
  RemoteMarketService({
    required this.baseUrl,
    required this.accessToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final String? Function() accessToken;
  final http.Client _client;

  @override
  Future<List<Security>> search(String query, {int limit = 20}) async {
    final uri = baseUrl
        .resolve('/api/v1/market/search')
        .replace(queryParameters: {'q': query, 'limit': '$limit'});
    final response = await _client.get(uri, headers: _headers());
    _ensureSuccess(response, '股票搜索失败');
    return (jsonDecode(response.body) as List<Object?>)
        .cast<Map<String, Object?>>()
        .map(_security)
        .toList(growable: false);
  }

  @override
  Future<MarketSnapshot> snapshot(String code) async {
    final response = await _client.get(
      baseUrl.resolve('/api/v1/market/stocks/$code/snapshot'),
      headers: _headers(),
    );
    _ensureSuccess(response, '行情加载失败');
    final value = jsonDecode(response.body) as Map<String, Object?>;
    final quote = value['quote']! as Map<String, Object?>;
    final source = value['source']! as Map<String, Object?>;
    return MarketSnapshot(
      quote: AShareQuote(
        security: _security(quote['security']! as Map<String, Object?>),
        price: _double(quote['price']),
        previousClose: _double(quote['previousClose']),
        open: _double(quote['open']),
        high: _double(quote['high']),
        low: _double(quote['low']),
        volume: (quote['volume']! as num).toInt(),
        turnover: _double(quote['turnover']),
        limitRatio: _double(quote['limitRatio']),
      ),
      dailyCandles: (value['dailyCandles']! as List<Object?>)
          .map((item) {
            final candle = item! as Map<String, Object?>;
            return Candle(
              day: DateTime.parse(candle['day']! as String),
              open: _double(candle['open']),
              high: _double(candle['high']),
              low: _double(candle['low']),
              close: _double(candle['close']),
              volume: (candle['volume']! as num).toInt(),
            );
          })
          .toList(growable: false),
      source: MarketSourceInfo(
        name: source['name']! as String,
        fetchedAt: DateTime.parse(source['fetchedAt']! as String),
        state: _state(source['state']! as String),
        isOnline: source['online']! as bool,
      ),
    );
  }

  Map<String, String> _headers() {
    final token = accessToken();
    if (token == null || token.isEmpty) throw StateError('请先登录后查看行情');
    return {'authorization': 'Bearer $token', 'accept': 'application/json'};
  }

  void _ensureSuccess(http.Response response, String action) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MarketLoadException('$action (${response.statusCode})');
    }
  }

  Security _security(Map<String, Object?> value) => Security(
    code: value['code']! as String,
    name: value['name']! as String,
    pinyin: value['pinyin']! as String,
    initials: value['initials']! as String,
    exchange: value['exchange']! as String,
    industry: value['industry']! as String,
  );

  double _double(Object? value) => (value! as num).toDouble();

  MarketDataState _state(String value) => switch (value) {
    'REALTIME' => MarketDataState.realtime,
    'DELAYED' => MarketDataState.delayed,
    'STALE' => MarketDataState.stale,
    'OFFLINE_CACHE' => MarketDataState.offlineCache,
    _ => throw FormatException('未知行情状态：$value'),
  };
}
