import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class SettingsDataService {
  static const _prefix = 'stockcal.';
  static const _backupKey = 'stockcal.backup.v1';

  Future<String> exportArchive() async {
    final preferences = await SharedPreferences.getInstance();
    final keys =
        preferences
            .getKeys()
            .where((key) => key.startsWith(_prefix) && key != _backupKey)
            .toList()
          ..sort();
    return jsonEncode({
      'version': 1,
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'data': {for (final key in keys) key: preferences.get(key)},
    });
  }

  Future<void> restoreArchive(String archive) async {
    final decoded = jsonDecode(archive);
    if (decoded is! Map<String, Object?> || decoded['version'] != 1) {
      throw const FormatException('不支持的数据归档版本');
    }
    final data = decoded['data'];
    if (data is! Map<String, Object?> ||
        data.keys.any((key) => !key.startsWith(_prefix))) {
      throw const FormatException('数据归档内容无效');
    }
    await clearLocalData();
    final preferences = await SharedPreferences.getInstance();
    for (final entry in data.entries) {
      await _set(preferences, entry.key, entry.value);
    }
  }

  Future<void> backup() async {
    final archive = await exportArchive();
    await (await SharedPreferences.getInstance()).setString(
      _backupKey,
      archive,
    );
  }

  Future<String?> latestBackup() async =>
      (await SharedPreferences.getInstance()).getString(_backupKey);

  Future<void> clearLocalData() async {
    final preferences = await SharedPreferences.getInstance();
    final keys = preferences
        .getKeys()
        .where((key) => key.startsWith(_prefix) && key != _backupKey)
        .toList(growable: false);
    for (final key in keys) {
      await preferences.remove(key);
    }
  }

  Future<void> clearAllData() async {
    final preferences = await SharedPreferences.getInstance();
    final keys = preferences
        .getKeys()
        .where((key) => key.startsWith(_prefix))
        .toList(growable: false);
    for (final key in keys) {
      await preferences.remove(key);
    }
  }

  Future<void> _set(
    SharedPreferences preferences,
    String key,
    Object? value,
  ) async {
    switch (value) {
      case String item:
        await preferences.setString(key, item);
      case bool item:
        await preferences.setBool(key, item);
      case int item:
        await preferences.setInt(key, item);
      case double item:
        await preferences.setDouble(key, item);
      case List<Object?> item when item.every((value) => value is String):
        await preferences.setStringList(key, item.cast<String>());
      default:
        throw FormatException('不支持的数据类型：$key');
    }
  }
}
