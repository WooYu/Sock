import 'package:flutter/material.dart';

/// StockCal X 风格调色板（纯黑底 + X 蓝主色）。
///
/// A 股约定：红涨绿跌。整体黑白灰极简，主色为 X 蓝。
class StockCalColors {
  StockCalColors._();

  // —— 深色（主打，X 纯黑）——
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

  // —— 浅色（X 白）——
  static const Color lightBg = Color(0xFFFFFFFF);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightTextPrimary = Color(0xFF0F1419);
  static const Color lightTextSecondary = Color(0xFF536471);
  static const Color lightBorder = Color(0xFFEFF3F4);
  static const Color lightGain = Color(0xFFF91880);
  static const Color lightLoss = Color(0xFF00BA7C);
}

/// 构建 StockCal 主题（深色 / 浅色）。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: StockCalColors.primary,
    brightness: brightness,
  ).copyWith(
    primary: StockCalColors.primary,
    onPrimary: Colors.white,
    secondary: dark ? StockCalColors.accent : StockCalColors.primary,
    onSecondary: Colors.white,
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
        fontWeight: FontWeight.w600,
        color: onSurface,
      ),
    ),

    cardTheme: CardThemeData(
      color: dark ? StockCalColors.surface : StockCalColors.lightSurface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: divider),
      ),
    ),

    dividerTheme: DividerThemeData(color: divider, thickness: 1, space: 1),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? StockCalColors.surface : StockCalColors.lightSurface,
      indicatorColor: scheme.primary.withValues(alpha: 0.16),
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? scheme.primary : muted,
        ),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? StockCalColors.surfaceHigh : const Color(0xFFF0F2F5),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: StockCalColors.primary, width: 1.4),
      ),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        minimumSize: const Size(48, 44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),

    listTileTheme: ListTileThemeData(
      iconColor: muted,
      textColor: onSurface,
      subtitleTextStyle: TextStyle(color: muted),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: dark ? StockCalColors.surfaceHigh : const Color(0xFFF0F2F5),
      side: BorderSide(color: divider),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      labelStyle: TextStyle(color: onSurface, fontSize: 12),
    ),
  );
}
