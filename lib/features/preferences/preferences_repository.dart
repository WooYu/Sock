import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'user_preferences.dart';

abstract interface class PreferencesRepository {
  Future<UserPreferences> load();
  Future<void> save(UserPreferences preferences);
}

class PersistentPreferencesRepository implements PreferencesRepository {
  static const _key = 'stockcal.preferences.v1';

  @override
  Future<UserPreferences> load() async {
    final value = (await SharedPreferences.getInstance()).getString(_key);
    if (value == null) return const UserPreferences();
    return UserPreferences.fromJson(jsonDecode(value) as Map<String, Object?>);
  }

  @override
  Future<void> save(UserPreferences preferences) async {
    await (await SharedPreferences.getInstance()).setString(
      _key,
      jsonEncode(preferences.toJson()),
    );
  }
}
