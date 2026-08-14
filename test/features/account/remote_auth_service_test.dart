import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/account/remote_auth_service.dart';
import 'package:stockcal/features/account/session.dart';

void main() {
  test('requests a one-time verification code for the phone', () async {
    late http.Request sent;
    final service = RemoteAuthService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      client: MockClient((request) async {
        sent = request;
        return http.Response('', 202);
      }),
    );

    await service.requestCode('13800138000');

    expect(sent.method, 'POST');
    expect(sent.url.path, '/api/v1/auth/request-code');
    expect(jsonDecode(sent.body), {'phone': '13800138000'});
  });

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

  test('refreshes an access token with the persisted refresh token', () async {
    final service = RemoteAuthService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      client: MockClient((request) async {
        expect(request.url.path, '/api/v1/auth/refresh');
        expect(jsonDecode(request.body), {'refreshToken': 'refresh-1'});
        return http.Response(
          '{"accessToken":"access-2","expiresAt":"2026-08-14T02:00:00Z"}',
          200,
        );
      }),
    );

    final token = await service.refresh('refresh-1');

    expect(token.accessToken, 'access-2');
    expect(token.expiresAt, DateTime.parse('2026-08-14T02:00:00Z'));
  });

  test('session controller persists the complete remote session', () async {
    final repository = MemorySessionRepository();
    final service = RemoteAuthService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({
            'accessToken': 'access-1',
            'refreshToken': 'refresh-1',
            'expiresAt': '2026-08-14T01:00:00Z',
            'profile': {'phone': '13800138000'},
            'device': {
              'id': 'd1',
              'name': 'Flutter',
              'lastSeenAt': '2026-08-14T00:00:00Z',
            },
          }),
          200,
        ),
      ),
    );
    final controller = SessionController(repository, remote: service);

    await controller.verifyPhone(phone: '13800138000', code: '123456');

    final stored = await repository.restore();
    expect(stored?.refreshToken, 'refresh-1');
    expect(stored?.expiresAt, DateTime.parse('2026-08-14T01:00:00Z'));
    expect(controller.devices.single.id, 'd1');
  });

  test(
    'session controller refreshes remotely and persists the new token',
    () async {
      final repository = MemorySessionRepository();
      await repository.save(
        UserSession(
          phone: '13800138000',
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          expiresAt: DateTime.now().add(const Duration(minutes: 10)),
        ),
      );
      final service = RemoteAuthService(
        baseUrl: Uri.parse('https://api.stockcal.test'),
        client: MockClient((request) async {
          if (request.url.path.endsWith('/refresh')) {
            return http.Response(
              jsonEncode({
                'accessToken': 'access-2',
                'expiresAt': DateTime.now()
                    .add(const Duration(minutes: 15))
                    .toUtc()
                    .toIso8601String(),
              }),
              200,
            );
          }
          return http.Response('[]', 200);
        }),
      );
      final controller = SessionController(repository, remote: service);
      await controller.restore();

      await controller.refreshAccessToken();

      expect(controller.session?.accessToken, 'access-2');
      expect((await repository.restore())?.accessToken, 'access-2');
      expect(controller.session?.refreshToken, 'refresh-1');
    },
  );

  test('restore renews an expiring token before loading devices', () async {
    final paths = <String>[];
    final repository = MemorySessionRepository();
    await repository.save(
      UserSession(
        phone: '13800138000',
        accessToken: 'expired-access',
        refreshToken: 'refresh-1',
        expiresAt: DateTime.now().add(const Duration(seconds: 30)),
      ),
    );
    final controller = SessionController(
      repository,
      remote: RemoteAuthService(
        baseUrl: Uri.parse('https://api.stockcal.test'),
        client: MockClient((request) async {
          paths.add(request.url.path);
          if (request.url.path.endsWith('/refresh')) {
            return http.Response(
              jsonEncode({
                'accessToken': 'renewed-access',
                'expiresAt': DateTime.now()
                    .add(const Duration(minutes: 15))
                    .toUtc()
                    .toIso8601String(),
              }),
              200,
            );
          }
          expect(request.headers['authorization'], 'Bearer renewed-access');
          return http.Response('[]', 200);
        }),
      ),
    );

    await controller.restore();

    expect(paths, ['/api/v1/auth/refresh', '/api/v1/auth/devices']);
    expect(controller.session?.accessToken, 'renewed-access');
  });
}
