import 'package:flutter/material.dart';

import '../features/home/home_screen.dart';
import '../features/preferences/preferences_controller.dart';
import '../features/preferences/preferences_repository.dart';
import '../features/preferences/user_preferences.dart';
import '../theme/stockcal_theme.dart';

class StockCalApp extends StatefulWidget {
  const StockCalApp({super.key, this.preferences});

  final PreferencesController? preferences;

  @override
  State<StockCalApp> createState() => _StockCalAppState();
}

class _StockCalAppState extends State<StockCalApp> {
  PreferencesController? _ownedPreferences;

  PreferencesController get _preferences =>
      widget.preferences ?? (_ownedPreferences ??= _createOwned());

  PreferencesController _createOwned() {
    final controller = PreferencesController(
      repository: PersistentPreferencesRepository(),
    );
    controller.load();
    return controller;
  }

  @override
  void dispose() {
    _ownedPreferences?.dispose();
    super.dispose();
  }

  ThemeMode _themeMode(ThemePreference preference) => switch (preference) {
    ThemePreference.system => ThemeMode.system,
    ThemePreference.light => ThemeMode.light,
    ThemePreference.dark => ThemeMode.dark,
  };

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _preferences,
      builder: (context, _) => MaterialApp(
        title: 'StockCal',
        debugShowCheckedModeBanner: false,
        themeMode: _themeMode(_preferences.preferences.theme),
        theme: buildStockCalTheme(Brightness.light),
        darkTheme: buildStockCalTheme(Brightness.dark),
        home: HomeScreen(preferences: _preferences),
      ),
    );
  }
}
