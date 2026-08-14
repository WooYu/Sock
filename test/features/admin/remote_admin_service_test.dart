import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stockcal/features/admin/admin_service.dart';
import 'package:stockcal/features/admin/remote_admin_service.dart';

void main() {
  test('loads real overview jobs and users with bearer authorization', () async {
    final paths = <String>[];
    final service = RemoteAdminService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      accessToken: () => 'admin-token',
      client: MockClient((request) async {
        paths.add(request.url.path);
        expect(request.headers['authorization'], 'Bearer admin-token');
        return switch (request.url.path) {
          '/api/v1/admin/overview' => http.Response(
            jsonEncode({
              'marketStatus': 'A 股行情服务已配置',
              'secrets': [
                {'name': '短信服务', 'configured': false},
                {'name': '行情服务', 'configured': true},
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          ),
          '/api/v1/admin/jobs' => http.Response(
            '[{"id":"job-1","type":"MARKET_REPAIR","target":"600519","status":"FAILED","attempts":2,"error":"timeout","updatedAt":"2026-08-14T00:00:00Z"}]',
            200,
          ),
          '/api/v1/admin/users' => http.Response(
            '[{"id":"u1","phoneMasked":"138****8000","displayName":"用户一","role":"ANALYST","enabled":true}]',
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          ),
          _ => http.Response('', 404),
        };
      }),
    );

    final snapshot = await service.load();

    expect(paths, [
      '/api/v1/admin/overview',
      '/api/v1/admin/jobs',
      '/api/v1/admin/users',
    ]);
    expect(snapshot.marketStatus, 'A 股行情服务已配置');
    expect(snapshot.secrets.first.configured, isFalse);
    expect(snapshot.jobs.single.status, SyncJobStatus.failed);
    expect(snapshot.users.single.role, UserRole.analyst);
  });

  test('retries jobs and submits market repair through admin API', () async {
    final requests = <http.Request>[];
    final service = RemoteAdminService(
      baseUrl: Uri.parse('https://api.stockcal.test'),
      accessToken: () => 'admin-token',
      client: MockClient((request) async {
        requests.add(request);
        return http.Response(
          '{"id":"job-1","type":"MARKET_REPAIR","target":"600519","status":"QUEUED","attempts":3,"error":null,"updatedAt":"2026-08-14T00:00:00Z"}',
          request.url.path.endsWith('market-repairs') ? 202 : 200,
        );
      }),
    );

    final retried = await service.retry('job-1');
    final repaired = await service.repair('600519');

    expect(retried.status, SyncJobStatus.queued);
    expect(repaired.type, 'MARKET_REPAIR');
    expect(requests[0].url.path, '/api/v1/admin/jobs/job-1/retry');
    expect(requests[1].url.path, '/api/v1/admin/market-repairs');
    expect(jsonDecode(requests[1].body), {'stockCode': '600519'});
  });
}
