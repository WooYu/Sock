import 'package:flutter/foundation.dart';

import 'remote_auth_service.dart';

class UserSession {
  const UserSession({
    required this.phone,
    required this.accessToken,
    this.refreshToken = '',
    this.expiresAt,
  });

  final String phone;
  final String accessToken;
  final String refreshToken;
  final DateTime? expiresAt;

  bool get isSignedIn => accessToken.isNotEmpty;
}

class UserDevice {
  const UserDevice({
    required this.id,
    required this.name,
    required this.isCurrent,
  });

  final String id;
  final String name;
  final bool isCurrent;
}

abstract interface class SessionRepository {
  Future<UserSession?> restore();
  Future<void> save(UserSession session);
  Future<void> clear();
}

class MemorySessionRepository implements SessionRepository {
  UserSession? _session;

  @override
  Future<UserSession?> restore() async => _session;

  @override
  Future<void> save(UserSession session) async {
    _session = session;
  }

  @override
  Future<void> clear() async {
    _session = null;
  }
}

class VerificationException implements Exception {
  const VerificationException(this.message);

  final String message;

  @override
  String toString() => message;
}

class SessionController extends ChangeNotifier {
  SessionController(this._repository, {this.remote});

  final SessionRepository _repository;
  final RemoteAuthService? remote;
  UserSession? session;
  List<UserDevice> devices = const [];
  var _tokenVersion = 0;

  Future<void> restore() async {
    session = await _repository.restore();
    if (session != null && devices.isEmpty) _registerCurrentDevice();
    notifyListeners();
  }

  Future<void> verifyPhone({
    required String phone,
    required String code,
  }) async {
    if (!RegExp(r'^1\d{10}$').hasMatch(phone) || code.length != 6) {
      throw const VerificationException('请输入有效手机号和六位验证码');
    }
    final verifiedRemote = remote == null
        ? null
        : await remote!.verify(
            phone: phone,
            code: code,
            deviceName: 'StockCal Flutter',
          );
    final verified = verifiedRemote == null
        ? UserSession(phone: phone, accessToken: 'local-session-$phone')
        : UserSession(
            phone: verifiedRemote.phone,
            accessToken: verifiedRemote.accessToken,
            refreshToken: verifiedRemote.refreshToken,
            expiresAt: verifiedRemote.expiresAt,
          );
    await _repository.save(verified);
    session = verified;
    if (verifiedRemote == null) {
      _registerCurrentDevice();
    } else {
      devices = [
        UserDevice(
          id: verifiedRemote.device.id,
          name: verifiedRemote.device.name,
          isCurrent: true,
        ),
      ];
    }
    notifyListeners();
  }

  Future<void> refreshAccessToken() async {
    final current = session;
    if (current == null) return;
    _tokenVersion += 1;
    final refreshed = UserSession(
      phone: current.phone,
      accessToken: 'local-session-${current.phone}-$_tokenVersion',
    );
    await _repository.save(refreshed);
    session = refreshed;
    notifyListeners();
  }

  void registerDevice(UserDevice device) {
    devices = [...devices.where((item) => item.id != device.id), device];
    notifyListeners();
  }

  Future<void> revokeDevice(String id) async {
    devices = devices
        .where((device) => device.id != id || device.isCurrent)
        .toList(growable: false);
    notifyListeners();
  }

  Future<void> signOut() async {
    await _repository.clear();
    session = null;
    devices = const [];
    notifyListeners();
  }

  void _registerCurrentDevice() {
    devices = const [
      UserDevice(
        id: 'current-device',
        name: 'StockCal Flutter',
        isCurrent: true,
      ),
    ];
  }
}
