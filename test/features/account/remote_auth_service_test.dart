import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/account/remote_auth_service.dart';

void main() {
  test('verifies phone and maps tokens profile and device', () async {
    final service = RemoteAuthService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      client: MockClient((request) async {
        expect(request.url.path, '/api/v1/auth/verify');
        expect(jsonDecode(request.body)['deviceName'], 'Flutter Web');
        return http.Response(
          jsonEncode({
            'accessToken': 'access-1',
            'refreshToken': 'refresh-1',
            'expiresAt': '2026-08-14T01:00:00Z',
            'profile': {'phone': '13800138000', 'displayName': 'StockCal 用户'},
            'device': {
              'id': 'd1',
              'name': 'Flutter Web',
              'lastSeenAt': '2026-08-14T00:00:00Z',
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final session = await service.verify(
      phone: '13800138000',
      code: '123456',
      deviceName: 'Flutter Web',
    );
    expect(session.accessToken, 'access-1');
    expect(session.refreshToken, 'refresh-1');
    expect(session.device.id, 'd1');
  });

  test('lists and revokes devices with bearer authorization', () async {
    final requests = <http.Request>[];
    final service = RemoteAuthService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      client: MockClient((request) async {
        requests.add(request);
        if (request.method == 'GET') {
          return http.Response(
            '[{"id":"d1","name":"Web","lastSeenAt":"2026-08-14T00:00:00Z"}]',
            200,
          );
        }
        return http.Response('', 204);
      }),
    );

    expect((await service.devices('token')).single.name, 'Web');
    await service.revokeDevice(accessToken: 'token', deviceId: 'd1');
    expect(
      requests.every(
        (request) => request.headers['authorization'] == 'Bearer token',
      ),
      isTrue,
    );
  });
}
