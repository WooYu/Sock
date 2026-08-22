import 'package:flutter/material.dart';

/// StockCal 调色板。
///
/// 深色 = 深空科技（蓝黑 + 青）；浅色 = 深空浅色（灰蓝底 + 青 + 细边框）。
/// A 股约定：红涨绿跌。
class StockCalColors {
  StockCalColors._();

  // —— 深色（深空科技：蓝黑 + 青）——
  static const Color bg = Color(0xFF0A0E15); // 页面背景
  static const Color surface = Color(0xFF111623); // 卡片 / 面板
  static const Color surfaceHigh = Color(0xFF1A2130); // 浮层 / 选中
  static const Color primary = Color(0xFF38C3E0); // 主色青
  static const Color accent = Color(0xFF38C3E0); // 次色（同青）
  static const Color gain = Color(0xFFF0525D); // 涨（红）
  static const Color loss = Color(0xFF2BB673); // 跌（绿）
  static const Color textPrimary = Color(0xFFE7ECF5);
  static const Color textSecondary = Color(0xFF8B94A8);
  static const Color border = Color(0xFF1E2636);

  // —— 浅色（深空浅色：灰蓝底 + 青 + 细边框）——
  static const Color lightBg = Color(0xFFEEF1F6); // 页面背景
  static const Color lightSurface = Color(0xFFFFFFFF); // 卡片 / 面板
  static const Color lightPrimary = Color(0xFF0E9CC4); // 主色青
  static const Color lightTextPrimary = Color(0xFF1A1F27); // 主文字
  static const Color lightTextSecondary = Color(0xFF5C6573); // 次文字
  static const Color lightBorder = Color(0xFFE2E7EE); // 细边框
  static const Color lightGain = Color(0xFFD63A48); // 涨（红）
  static const Color lightLoss = Color(0xFF1E9E63); // 跌（绿）
}

/// 构建 StockCal 主题（深色 / 浅色）。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final primary = dark ? StockCalColors.primary : StockCalColors.lightPrimary;
  final onPrimary = dark ? Colors.white : const Color(0xFF141414);
  final radius = 7.0;
  final borderWidth = 1.0;
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
