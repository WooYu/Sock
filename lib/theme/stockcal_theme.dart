import 'package:flutter/material.dart';

/// StockCal 调色板。
///
/// 深色 = X 风格（纯黑 + X 蓝）；浅色 = 新野兽派（奶油纸底 + 墨色粗边框 + 明黄主色）。
/// A 股约定：红涨绿跌。
class StockCalColors {
  StockCalColors._();

  // —— 深色（X 纯黑）——
  static const Color bg = Color(0xFF000000); // 页面背景（纯黑）
  static const Color surface = Color(0xFF16181C); // 卡片 / 面板
  static const Color surfaceHigh = Color(0xFF1D1F23); // 浮层 / 选中
  static const Color primary = Color(0xFF1D9BF0); // 主色 X 蓝
  static const Color accent = Color(0xFF1D9BF0); // 次色（同 X 蓝）
  static const Color gain = Color(0xFFF91880); // 涨（X 红）
  static const Color loss = Color(0xFF00BA7C); // 跌（X 绿）
  static const Color textPrimary = Color(0xFFE7E9EA);
  static const Color textSecondary = Color(0xFF71767B);
  static const Color border = Color(0xFF2F3336);

  // —— 浅色（新野兽派）——
  static const Color lightBg = Color(0xFFF4EFE1); // 奶油纸底
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightPrimary = Color(0xFFF9C80E); // 明黄主色
  static const Color lightTextPrimary = Color(0xFF141414); // 墨色
  static const Color lightTextSecondary = Color(0xFF57534E);
  static const Color lightBorder = Color(0xFF141414); // 粗边框墨色
  static const Color lightGain = Color(0xFFE53E2D); // 涨（红）
  static const Color lightLoss = Color(0xFF0BA968); // 跌（绿）
}

/// 构建 StockCal 主题（深色 / 浅色）。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final primary = dark ? StockCalColors.primary : StockCalColors.lightPrimary;
  final onPrimary = dark ? Colors.white : const Color(0xFF141414);
  final radius = dark ? 7.0 : 0.0;
  final borderWidth = dark ? 1.0 : 2.0;
  final cardBorder = dark
      ? StockCalColors.border
      : StockCalColors.lightBorder;

  final scheme = ColorScheme.fromSeed(
    seedColor: primary,
    brightness: brightness,
  ).copyWith(
    primary: primary,
    onPrimary: onPrimary,
    secondary: dark ? StockCalColors.accent : StockCalColors.lightPrimary,
    onSecondary: onPrimary,
    surface: dark ? StockCalColors.surface : StockCalColors.lightSurface,
    onSurface: dark
        ? StockCalColors.textPrimary
        : StockCalColors.lightTextPrimary,
    onSurfaceVariant: dark
        ? StockCalColors.textSecondary
        : StockCalColors.lightTextSecondary,
    outline: dark ? StockCalColors.border : StockCalColors.lightBorder,
    outlineVariant: dark ? StockCalColors.border : StockCalColors.lightBorder,
    error: dark ? StockCalColors.gain : StockCalColors.lightGain,
  );

  final onSurface = scheme.onSurface;
  final muted = scheme.onSurfaceVariant;
  final divider = dark ? StockCalColors.border : StockCalColors.lightBorder;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? StockCalColors.bg : StockCalColors.lightBg,
    visualDensity: VisualDensity.compact,

    appBarTheme: AppBarTheme(
      backgroundColor: dark ? StockCalColors.bg : StockCalColors.lightSurface,
      foregroundColor: onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: onSurface,
      ),
    ),

    cardTheme: CardThemeData(
      color: dark ? StockCalColors.surface : StockCalColors.lightSurface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radius),
        side: BorderSide(color: cardBorder, width: borderWidth),
      ),
    ),

    dividerTheme: DividerThemeData(color: divider, thickness: 1, space: 1),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark
          ? StockCalColors.surface
          : StockCalColors.lightSurface,
      indicatorColor: primary.withValues(alpha: 0.2),
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? primary : muted,
        ),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark
          ? StockCalColors.surfaceHigh
          : StockCalColors.lightSurface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: BorderSide(color: cardBorder, width: borderWidth),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: BorderSide(color: cardBorder, width: borderWidth),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(radius),
        borderSide: BorderSide(color: primary, width: borderWidth + 0.4),
      ),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        minimumSize: const Size(48, 44),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: dark
              ? BorderSide.none
              : BorderSide(color: StockCalColors.lightBorder, width: 2),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: onSurface,
        minimumSize: const Size(48, 44),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: cardBorder, width: borderWidth),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),

    listTileTheme: ListTileThemeData(
      iconColor: muted,
      textColor: onSurface,
      subtitleTextStyle: TextStyle(color: muted),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: dark
          ? StockCalColors.surfaceHigh
          : StockCalColors.lightSurface,
      side: BorderSide(color: cardBorder, width: dark ? 1 : 2),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius)),
      labelStyle: TextStyle(color: onSurface, fontSize: 12),
    ),
  );
}
