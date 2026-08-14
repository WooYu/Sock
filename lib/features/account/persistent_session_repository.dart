import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'session.dart';

class PersistentSessionRepository implements SessionRepository {
  static const _key = 'stockcal.session.v1';

  @override
  Future<UserSession?> restore() async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return null;
    final json = jsonDecode(value) as Map<String, Object?>;
    return UserSession(
      phone: json['phone']! as String,
      accessToken: json['accessToken']! as String,
    );
  }

  @override
  Future<void> save(UserSession session) async {
    final value = jsonEncode({
      'phone': session.phone,
      'accessToken': session.accessToken,
    });
    await (await SharedPreferences.getInstance()).setString(_key, value);
  }

  @override
  Future<void> clear() async {
    await (await SharedPreferences.getInstance()).remove(_key);
  }
}
