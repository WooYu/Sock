import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/app/stockcal_app.dart';
import 'package:stockcal/features/preferences/preferences_controller.dart';
import 'package:stockcal/features/preferences/preferences_repository.dart';
import 'package:stockcal/features/preferences/user_preferences.dart';

class _MemoryPreferencesRepository implements PreferencesRepository {
  _MemoryPreferencesRepository(this.preferences);
  UserPreferences preferences;

  @override
  Future<UserPreferences> load() async => preferences;

  @override
  Future<void> save(UserPreferences preferences) async {
    this.preferences = preferences;
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('StockCal app uses production title and Material 3 theme', (
    tester,
  ) async {
    await tester.pumpWidget(const StockCalApp());

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));

    expect(app.title, 'StockCal');
    expect(app.debugShowCheckedModeBanner, isFalse);
    expect(app.theme?.useMaterial3, isTrue);
    expect(app.theme?.colorScheme.brightness, Brightness.light);
    expect(app.darkTheme?.colorScheme.brightness, Brightness.dark);
  });

  testWidgets('injected dark preference selects the dark theme mode', (
    tester,
  ) async {
    final preferences = PreferencesController(
      repository: _MemoryPreferencesRepository(
        const UserPreferences(theme: ThemePreference.dark),
      ),
    );
    await preferences.load();

    await tester.pumpWidget(StockCalApp(preferences: preferences));

    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.themeMode, ThemeMode.dark);
  });
}
