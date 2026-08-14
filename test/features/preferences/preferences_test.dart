import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockcal/features/preferences/preferences_controller.dart';
import 'package:stockcal/features/preferences/preferences_repository.dart';
import 'package:stockcal/features/preferences/user_preferences.dart';

void main() {
  test('preferences default to system theme and notifications enabled', () {
    const preferences = UserPreferences();
    expect(preferences.theme, ThemePreference.system);
    expect(preferences.notificationsEnabled, isTrue);
  });

  test('copyWith changes only the requested field and json round-trips', () {
    final original = const UserPreferences(
      theme: ThemePreference.dark,
      notificationsEnabled: false,
    );
    final renamed = original.copyWith(theme: ThemePreference.light);
    expect(renamed.theme, ThemePreference.light);
    expect(renamed.notificationsEnabled, isFalse);

    final restored = UserPreferences.fromJson(renamed.toJson());
    expect(restored.theme, ThemePreference.light);
    expect(restored.notificationsEnabled, isFalse);
  });

  test('repository returns defaults when empty and persists changes', () async {
    SharedPreferences.setMockInitialValues({});
    final repository = PersistentPreferencesRepository();

    expect((await repository.load()).theme, ThemePreference.system);

    await repository.save(
      const UserPreferences(
        theme: ThemePreference.dark,
        notificationsEnabled: false,
      ),
    );
    final restored = await repository.load();
    expect(restored.theme, ThemePreference.dark);
    expect(restored.notificationsEnabled, isFalse);
  });

  test('controller loads once and persists theme and notification changes', () async {
    SharedPreferences.setMockInitialValues({});
    final controller = PreferencesController(
      repository: PersistentPreferencesRepository(),
    );
    await controller.load();

    var notifications = 0;
    controller.addListener(() => notifications += 1);

    await controller.setTheme(ThemePreference.dark);
    expect(controller.preferences.theme, ThemePreference.dark);
    expect(notifications, 1);

    await controller.setNotificationsEnabled(false);
    expect(controller.preferences.notificationsEnabled, isFalse);
    expect(notifications, 2);

    final restored = await PersistentPreferencesRepository().load();
    expect(restored.theme, ThemePreference.dark);
    expect(restored.notificationsEnabled, isFalse);
  });
}
