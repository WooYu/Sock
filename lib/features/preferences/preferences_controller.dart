import 'package:flutter/foundation.dart';

import '../analysis/technical_analysis.dart';
import 'preferences_repository.dart';
import 'user_preferences.dart';

class PreferencesController extends ChangeNotifier {
  PreferencesController({required this.repository});

  final PreferencesRepository repository;

  UserPreferences _preferences = const UserPreferences();
  var _loaded = false;

  UserPreferences get preferences => _preferences;

  Future<void> load() async {
    if (_loaded) return;
    _preferences = await repository.load();
    _loaded = true;
    notifyListeners();
  }

  Future<void> setTheme(ThemePreference theme) async {
    _preferences = _preferences.copyWith(theme: theme);
    notifyListeners();
    await repository.save(_preferences);
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    _preferences = _preferences.copyWith(notificationsEnabled: enabled);
    notifyListeners();
    await repository.save(_preferences);
  }

  Future<void> setIndicatorSettings(IndicatorSettings settings) async {
    _preferences = _preferences.copyWith(indicatorSettings: settings);
    notifyListeners();
    await repository.save(_preferences);
  }
}
