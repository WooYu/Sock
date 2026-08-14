import 'dart:convert';

import 'package:http/http.dart' as http;

import 'admin_service.dart';

class RemoteAdminSnapshot {
  const RemoteAdminSnapshot({
    required this.marketStatus,
    required this.secrets,
    required this.jobs,
    required this.users,
    required this.auditLogs,
    required this.aiCallLogs,
  });

  final String marketStatus;
  final List<SecretStatus> secrets;
  final List<SyncJob> jobs;
  final List<ManagedUser> users;
  final List<AdminAuditEvent> auditLogs;
  final List<AiCallLog> aiCallLogs;
}

class RemoteAdminService {
  RemoteAdminService({
    required this.baseUrl,
    required this.accessToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri baseUrl;
  final String? Function() accessToken;
  final http.Client _client;

  Future<RemoteAdminSnapshot> load() async {
    final overviewResponse = await _get('/api/v1/admin/overview');
    final jobsResponse = await _get('/api/v1/admin/jobs');
    final usersResponse = await _get('/api/v1/admin/users');
    final auditResponse = await _get('/api/v1/admin/audit-logs');
    final aiResponse = await _get('/api/v1/admin/ai-call-logs');
    final overview = jsonDecode(overviewResponse.body) as Map<String, Object?>;
    return RemoteAdminSnapshot(
      marketStatus: overview['marketStatus']! as String,
      secrets: (overview['secrets']! as List<Object?>)
          .map((item) {
            final value = item! as Map<String, Object?>;
            return SecretStatus(
              name: value['name']! as String,
              configured: value['configured']! as bool,
            );
          })
          .toList(growable: false),
      jobs: (jsonDecode(jobsResponse.body) as List<Object?>)
          .map((item) => _job(item! as Map<String, Object?>))
          .toList(growable: false),
      users: (jsonDecode(usersResponse.body) as List<Object?>)
          .map((item) {
            final value = item! as Map<String, Object?>;
            return ManagedUser(
              id: value['id']! as String,
              phoneMasked: value['phoneMasked']! as String,
              role: UserRole.values.byName(
                (value['role']! as String).toLowerCase(),
              ),
              enabled: value['enabled']! as bool,
            );
          })
          .toList(growable: false),
      auditLogs: (jsonDecode(auditResponse.body) as List<Object?>)
          .map((item) {
            final value = item! as Map<String, Object?>;
            return AdminAuditEvent(
              actor: value['actor']! as String,
              action: value['action']! as String,
              target: value['target']! as String,
              createdAt: DateTime.parse(value['createdAt']! as String),
            );
          })
          .toList(growable: false),
      aiCallLogs: (jsonDecode(aiResponse.body) as List<Object?>)
          .map((item) {
            final value = item! as Map<String, Object?>;
            return AiCallLog(
              actor: value['actor'] as String?,
              purpose: value['purpose']! as String,
              model: value['model']! as String,
              status: value['status']! as String,
              createdAt: DateTime.parse(value['createdAt']! as String),
            );
          })
          .toList(growable: false),
    );
  }

  Future<SyncJob> retry(String id) async {
    final response = await _client.post(
      _uri('/api/v1/admin/jobs/$id/retry'),
      headers: _headers(),
    );
    _ensureSuccess(response);
    return _job(jsonDecode(response.body) as Map<String, Object?>);
  }

  Future<SyncJob> repair(String stockCode) async {
    final response = await _client.post(
      _uri('/api/v1/admin/market-repairs'),
      headers: _headers(),
      body: jsonEncode({'stockCode': stockCode}),
    );
    _ensureSuccess(response);
    return _job(jsonDecode(response.body) as Map<String, Object?>);
  }

  Future<http.Response> _get(String path) async {
    final response = await _client.get(_uri(path), headers: _headers());
    _ensureSuccess(response);
    return response;
  }

  Uri _uri(String path) => baseUrl.resolve(path);

  Map<String, String> _headers() {
    final token = accessToken();
    if (token == null || token.isEmpty) {
      throw StateError('请先使用管理员账户登录');
    }
    return {
      'authorization': 'Bearer $token',
      'content-type': 'application/json',
    };
  }

  void _ensureSuccess(http.Response response) {
    if (response.statusCode == 403) throw StateError('当前账户没有管理权限');
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('管理服务请求失败 (${response.statusCode})');
    }
  }

  SyncJob _job(Map<String, Object?> value) => SyncJob(
    id: value['id']! as String,
    type: value['type']! as String,
    status: SyncJobStatus.values.byName(
      (value['status']! as String).toLowerCase(),
    ),
    attempts: value['attempts']! as int,
    error: value['error'] as String?,
  );
}
