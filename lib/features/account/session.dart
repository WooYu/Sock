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
    if (session != null && devices.isEmpty) {
      if (remote == null) {
        _registerCurrentDevice();
      } else {
        try {
          final expiresAt = session!.expiresAt;
          if (expiresAt != null &&
              expiresAt.isBefore(
                DateTime.now().add(const Duration(minutes: 1)),
              ) &&
              session!.refreshToken.isNotEmpty) {
            await refreshAccessToken();
          }
          await _loadRemoteDevices();
        } on VerificationException {
          devices = const [];
        } on RemoteAuthException {
          devices = const [];
        }
      }
    }
    notifyListeners();
  }

  Future<void> requestVerificationCode(String phone) async {
    if (!RegExp(r'^1\d{10}$').hasMatch(phone)) {
      throw const VerificationException('请输入有效的十一位手机号');
    }
    if (remote == null) return;
    try {
      await remote!.requestCode(phone);
    } on RemoteAuthException catch (error) {
      if (error.statusCode == 429) {
        throw const VerificationException('请求过于频繁，请稍后再试');
      }
      if (error.statusCode == 503) {
        throw const VerificationException('短信服务暂不可用，请稍后再试');
      }
      throw const VerificationException('验证码发送失败，请检查网络后重试');
    } catch (_) {
      throw const VerificationException('无法连接服务器，请检查网络后重试');
    }
  }

  Future<void> verifyPhone({
    required String phone,
    required String code,
  }) async {
    if (!RegExp(r'^1\d{10}$').hasMatch(phone) || code.length != 6) {
      throw const VerificationException('请输入有效手机号和六位验证码');
    }
    final verifiedRemote = remote == null ? null : await _verifyRemote(phone, code);
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

  Future<RemoteSession> _verifyRemote(String phone, String code) async {
    try {
      return await remote!.verify(
        phone: phone,
        code: code,
        deviceName: 'StockCal Flutter',
      );
    } on RemoteAuthException catch (error) {
      if (error.statusCode == 401) {
        throw const VerificationException('验证码无效或已过期');
      }
      throw const VerificationException('登录失败，请稍后重试');
    } catch (_) {
      throw const VerificationException('无法连接服务器，请检查网络后重试');
    }
  }

  Future<void> refreshAccessToken() async {
    final current = session;
    if (current == null) return;
    if (remote != null && current.refreshToken.isNotEmpty) {
      try {
        final token = await remote!.refresh(current.refreshToken);
        final refreshed = UserSession(
          phone: current.phone,
          accessToken: token.accessToken,
          refreshToken: current.refreshToken,
          expiresAt: token.expiresAt,
        );
        await _repository.save(refreshed);
        session = refreshed;
        notifyListeners();
        return;
      } on RemoteAuthException {
        throw const VerificationException('登录状态续期失败，请重新登录');
      }
    }
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
    final current = session;
    final device = devices.where((item) => item.id == id).firstOrNull;
    if (device == null || device.isCurrent) return;
    if (remote != null && current != null) {
      try {
        await remote!.revokeDevice(
          accessToken: current.accessToken,
          deviceId: id,
        );
      } on RemoteAuthException {
        throw const VerificationException('设备撤销失败，请稍后重试');
      }
    }
    devices = devices.where((item) => item.id != id).toList(growable: false);
    notifyListeners();
  }

  Future<void> loadDevices() async {
    if (remote == null || session == null) return;
    await _loadRemoteDevices();
    notifyListeners();
  }

  Future<void> signOut() async {
    await _repository.clear();
    session = null;
    devices = const [];
    notifyListeners();
  }

  Future<void> deleteAccount() async {
    final current = session;
    if (current == null) return;
    if (remote != null) {
      try {
        await remote!.deleteAccount(current.accessToken);
      } on RemoteAuthException {
        throw const VerificationException('账户注销失败，请检查网络后重试');
      }
    }
    await signOut();
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

  Future<void> _loadRemoteDevices() async {
    final current = session;
    if (current == null) return;
    final remoteDevices = await remote!.devices(current.accessToken);
    final knownCurrent = devices
        .where((item) => item.isCurrent)
        .firstOrNull
        ?.id;
    devices = [
      for (var index = 0; index < remoteDevices.length; index += 1)
        UserDevice(
          id: remoteDevices[index].id,
          name: remoteDevices[index].name,
          isCurrent: knownCurrent == null
              ? index == 0
              : remoteDevices[index].id == knownCurrent,
        ),
    ];
  }
}
