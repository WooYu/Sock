import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/market/remote_market_service.dart';

void main() {
  test('searches and maps authenticated backend market snapshots', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (request.url.path.endsWith('/search')) {
        return http.Response(
          jsonEncode([
            {
              'code': '600519',
              'name': '贵州茅台',
              'pinyin': 'guizhoumaotai',
              'initials': 'gzmt',
              'exchange': 'SH',
              'industry': '白酒',
            },
          ]),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }
      return http.Response(
        jsonEncode({
          'quote': {
            'security': {
              'code': '600519',
              'name': '贵州茅台',
              'pinyin': 'guizhoumaotai',
              'initials': 'gzmt',
              'exchange': 'SH',
              'industry': '白酒',
            },
            'price': 1742.0,
            'previousClose': 1729.0,
            'open': 1730.0,
            'high': 1750.0,
            'low': 1720.0,
            'volume': 32000,
            'turnover': 55744000.0,
            'limitRatio': 0.1,
          },
          'dailyCandles': [
            {
              'day': '2026-08-13',
              'open': 1720.0,
              'high': 1740.0,
              'low': 1718.0,
              'close': 1729.0,
              'volume': 30000,
            },
            {
              'day': '2026-08-14',
              'open': 1730.0,
              'high': 1750.0,
              'low': 1720.0,
              'close': 1742.0,
              'volume': 32000,
            },
          ],
          'source': {
            'name': 'StockCal A股行情适配器',
            'fetchedAt': '2026-08-14T06:45:00Z',
            'state': 'DELAYED',
            'online': true,
          },
        }),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    });
    final service = RemoteMarketService(
      baseUrl: Uri.parse('http://localhost:8080'),
      accessToken: () => 'access-1',
      client: client,
    );

    final results = await service.search('gzmt');
    final snapshot = await service.snapshot('600519');

    expect(results.single.name, '贵州茅台');
    expect(snapshot.quote.price, 1742.0);
    expect(snapshot.dailyCandles, hasLength(2));
    expect(snapshot.source.state.name, 'delayed');
    expect(requests.first.url.queryParameters['q'], 'gzmt');
    expect(
      requests.every(
        (request) => request.headers['authorization'] == 'Bearer access-1',
      ),
      isTrue,
    );
  });

  test('requires login before calling backend', () async {
    final service = RemoteMarketService(
      baseUrl: Uri.parse('http://localhost:8080'),
      accessToken: () => null,
      client: MockClient((_) async => http.Response('{}', 500)),
    );

    expect(() => service.search('600519'), throwsA(isA<StateError>()));
  });
}
