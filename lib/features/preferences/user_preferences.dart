enum ThemePreference { system, light, dark }

class UserPreferences {
  const UserPreferences({
    this.theme = ThemePreference.system,
    this.notificationsEnabled = true,
  });

  final ThemePreference theme;
  final bool notificationsEnabled;

  UserPreferences copyWith({
    ThemePreference? theme,
    bool? notificationsEnabled,
  }) => UserPreferences(
    theme: theme ?? this.theme,
    notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
  );

  Map<String, Object?> toJson() => {
    'theme': theme.name,
    'notificationsEnabled': notificationsEnabled,
  };

  static UserPreferences fromJson(Map<String, Object?> json) => UserPreferences(
    theme: ThemePreference.values.byName(json['theme']! as String),
    notificationsEnabled: json['notificationsEnabled']! as bool,
  );
}
