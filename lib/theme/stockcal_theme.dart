import 'package:flutter/material.dart';

import 'design_tokens.dart';

/// StockCal 调色板（兼容层）。
///
/// 取值现由 [StockCalTokens] 提供。保留本类是为了不改动既有的大量引用；
/// 新代码请直接使用 `StockCalTokens.of(context)`，本类随各屏改造逐步退役。
@Deprecated('改用 StockCalTokens.of(context)；本类随各屏改造逐步退役')
class StockCalColors {
  StockCalColors._();

  static final StockCalTokens _dark = StockCalTokens.dark();
  static final StockCalTokens _light = StockCalTokens.light();

  // —— 深色 ——
  static final Color bg = _dark.canvas;
  static final Color surface = _dark.surface;
  static final Color surfaceHigh = _dark.surfaceInset;
  static final Color primary = _dark.accent;
  static final Color accent = _light.accent;
  static final Color gain = _light.rise;
  static final Color loss = _light.fall;
  static final Color textPrimary = _dark.ink;
  static final Color textSecondary = _dark.muted;
  static final Color border = _dark.line;

  // —— 浅色 ——
  static final Color lightBg = _light.canvas;
  static final Color lightSurface = _light.surface;
  static final Color lightPrimary = _light.accent;
  static final Color lightTextPrimary = _light.ink;
  static final Color lightTextSecondary = _light.muted;
  static final Color lightBorder = _light.line;
  static final Color lightGain = _light.rise;
  static final Color lightLoss = _light.fall;
}

/// 构建 StockCal 主题（深色 / 浅色）。取值全部来自 [StockCalTokens]。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final t = dark ? StockCalTokens.dark() : StockCalTokens.light();
  const radius = StockCalRadii.button;
  const borderWidth = StockCalRadii.hairline;
  const onPrimary = Colors.white;

  final scheme =
      ColorScheme.fromSeed(seedColor: t.accent, brightness: brightness).copyWith(
        primary: t.accent,
        onPrimary: onPrimary,
        secondary: t.accent,
        onSecondary: onPrimary,
        surface: t.surface,
        onSurface: t.ink,
        onSurfaceVariant: t.muted,
        outline: t.line,
        outlineVariant: t.softLine,
        error: t.loss,
      );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: t.canvas,
    visualDensity: VisualDensity.compact,
    extensions: [t],

    appBarTheme: AppBarTheme(
      backgroundColor: t.surface,
      foregroundColor: t.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: StockCalType.h2,
        fontWeight: FontWeight.w700,
        color: t.ink,
      ),
    ),

    cardTheme: CardThemeData(
      color: t.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(StockCalRadii.card),
        side: BorderSide(color: t.line, width: borderWidth),
      ),
    ),

    dividerTheme: DividerThemeData(color: t.softLine, thickness: 1, space: 1),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: t.surface,
      indicatorColor: t.accentSoft,
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: StockCalType.bodyLg,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? t.accent : t.muted,
        ),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: BorderSide(color: t.line, width: borderWidth),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: BorderSide(color: t.line, width: borderWidth),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: BorderSide(color: t.accent, width: borderWidth + 0.4),
      ),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: t.accent,
        foregroundColor: onPrimary,
        minimumSize: const Size(48, 44),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: t.ink,
        minimumSize: const Size(48, 44),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: t.line, width: borderWidth),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),

    listTileTheme: ListTileThemeData(
      iconColor: t.muted,
      textColor: t.ink,
      subtitleTextStyle: TextStyle(color: t.muted),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: t.surface,
      side: BorderSide(color: t.line, width: borderWidth),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(StockCalRadii.chip),
      ),
      labelStyle: TextStyle(color: t.ink, fontSize: StockCalType.bodyLg),
    ),
  );
}
