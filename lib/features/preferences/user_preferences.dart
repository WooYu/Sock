import '../analysis/technical_analysis.dart';

enum ThemePreference { system, light, dark }

class UserPreferences {
  const UserPreferences({
    this.theme = ThemePreference.system,
    this.notificationsEnabled = true,
    this.indicatorSettings = const IndicatorSettings(),
  });

  final ThemePreference theme;
  final bool notificationsEnabled;
  final IndicatorSettings indicatorSettings;

  UserPreferences copyWith({
    ThemePreference? theme,
    bool? notificationsEnabled,
    IndicatorSettings? indicatorSettings,
  }) => UserPreferences(
    theme: theme ?? this.theme,
    notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
    indicatorSettings: indicatorSettings ?? this.indicatorSettings,
  );

  Map<String, Object?> toJson() => {
    'theme': theme.name,
    'notificationsEnabled': notificationsEnabled,
    'indicatorSettings': indicatorSettings.toJson(),
  };

  static UserPreferences fromJson(Map<String, Object?> json) => UserPreferences(
    theme: ThemePreference.values.byName(json['theme']! as String),
    notificationsEnabled: json['notificationsEnabled']! as bool,
    indicatorSettings: json['indicatorSettings'] == null
        ? const IndicatorSettings()
        : IndicatorSettings.fromJson(
            json['indicatorSettings']! as Map<String, Object?>,
          ),
  );
}
