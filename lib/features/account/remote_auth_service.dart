import 'dart:convert';

import 'package:http/http.dart' as http;

class RemoteDevice {
  const RemoteDevice({
    required this.id,
    required this.name,
    required this.lastSeenAt,
  });

  final String id;
  final String name;
  final DateTime lastSeenAt;
}

class RemoteSession {
  const RemoteSession({
    required this.phone,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.device,
  });

  final String phone;
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final RemoteDevice device;
}

class RemoteToken {
  const RemoteToken({required this.accessToken, required this.expiresAt});

  final String accessToken;
  final DateTime expiresAt;
}

class RemoteAuthException implements Exception {
  const RemoteAuthException(this.statusCode, this.message);
  final int statusCode;
  final String message;
}

class RemoteAuthService {
  RemoteAuthService({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final Uri baseUrl;
  final http.Client _client;

  Future<void> requestCode(String phone) async {
    final response = await _client.post(
      baseUrl.resolve('/api/v1/auth/request-code'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'phone': phone}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteAuthException(response.statusCode, response.body);
    }
  }

  Future<RemoteSession> verify({
    required String phone,
    required String code,
    required String deviceName,
  }) async {
    final response = await _client.post(
      baseUrl.resolve('/api/v1/auth/verify'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'phone': phone,
        'code': code,
        'deviceName': deviceName,
      }),
    );
    final json = _json(response);
    final profile = json['profile']! as Map<String, Object?>;
    return RemoteSession(
      phone: profile['phone']! as String,
      accessToken: json['accessToken']! as String,
      refreshToken: json['refreshToken']! as String,
      expiresAt: DateTime.parse(json['expiresAt']! as String),
      device: _device(json['device']! as Map<String, Object?>),
    );
  }

  Future<RemoteToken> refresh(String refreshToken) async {
    final response = await _client.post(
      baseUrl.resolve('/api/v1/auth/refresh'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    final json = _json(response);
    return RemoteToken(
      accessToken: json['accessToken']! as String,
      expiresAt: DateTime.parse(json['expiresAt']! as String),
    );
  }

  Future<List<RemoteDevice>> devices(String accessToken) async {
    final response = await _client.get(
      baseUrl.resolve('/api/v1/auth/devices'),
      headers: _authorization(accessToken),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteAuthException(response.statusCode, response.body);
    }
    return (jsonDecode(response.body) as List<Object?>)
        .map((item) => _device(item! as Map<String, Object?>))
        .toList(growable: false);
  }

  Future<void> revokeDevice({
    required String accessToken,
    required String deviceId,
  }) async {
    final response = await _client.delete(
      baseUrl.resolve('/api/v1/auth/devices/$deviceId'),
      headers: _authorization(accessToken),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteAuthException(response.statusCode, response.body);
    }
  }

  Map<String, Object?> _json(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw RemoteAuthException(response.statusCode, response.body);
    }
    return jsonDecode(response.body) as Map<String, Object?>;
  }

  RemoteDevice _device(Map<String, Object?> json) => RemoteDevice(
    id: json['id']! as String,
    name: json['name']! as String,
    lastSeenAt: DateTime.parse(json['lastSeenAt']! as String),
  );

  Map<String, String> _authorization(String token) => {
    'authorization': 'Bearer $token',
  };
}
