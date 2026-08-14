import 'package:flutter/material.dart';

import '../features/home/home_screen.dart';
import '../features/preferences/preferences_controller.dart';
import '../features/preferences/preferences_repository.dart';
import '../features/preferences/user_preferences.dart';

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
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF176B87),
            brightness: Brightness.light,
          ),
        ),
        darkTheme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF176B87),
            brightness: Brightness.dark,
          ),
        ),
        home: HomeScreen(preferences: _preferences),
      ),
    );
  }
}
