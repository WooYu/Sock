import 'package:flutter/foundation.dart';

class UserSession {
  const UserSession({required this.phone, required this.accessToken});

  final String phone;
  final String accessToken;

  bool get isSignedIn => accessToken.isNotEmpty;
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
  SessionController(this._repository);

  final SessionRepository _repository;
  UserSession? session;

  Future<void> restore() async {
    session = await _repository.restore();
    notifyListeners();
  }

  Future<void> verifyPhone({
    required String phone,
    required String code,
  }) async {
    if (!RegExp(r'^1\d{10}$').hasMatch(phone) || code.length != 6) {
      throw const VerificationException('请输入有效手机号和六位验证码');
    }
    final verified = UserSession(
      phone: phone,
      accessToken: 'local-session-$phone',
    );
    await _repository.save(verified);
    session = verified;
    notifyListeners();
  }

  Future<void> signOut() async {
    await _repository.clear();
    session = null;
    notifyListeners();
  }
}
