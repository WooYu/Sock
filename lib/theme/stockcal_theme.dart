import 'package:flutter/material.dart';

/// StockCal 深空科技调色板（蓝黑底 + 青色主色）。
///
/// A 股约定：红涨绿跌。主色为青，蓝作次要点缀。
class StockCalColors {
  StockCalColors._();

  // —— 深色（主打，深空科技）——
  static const Color bg = Color(0xFF0A0E15); // 页面背景（深空蓝黑）
  static const Color surface = Color(0xFF111623); // 卡片 / 面板
  static const Color surfaceHigh = Color(0xFF1A2130); // 浮层 / 选中
  static const Color primary = Color(0xFF38C3E0); // 主色青
  static const Color accent = Color(0xFF5AA9F0); // 次色蓝
  static const Color gain = Color(0xFFF0525D); // 涨（红）
  static const Color loss = Color(0xFF2BB673); // 跌（绿）
  static const Color textPrimary = Color(0xFFE7ECF5);
  static const Color textSecondary = Color(0xFF8B94A8);
  static const Color border = Color(0xFF1E2636);

  // —— 浅色（冷灰科技）——
  static const Color lightBg = Color(0xFFEEF1F6);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightTextPrimary = Color(0xFF1A1F27);
  static const Color lightTextSecondary = Color(0xFF5C6573);
  static const Color lightBorder = Color(0xFFE2E7EE);
  static const Color lightGain = Color(0xFFD63A48);
  static const Color lightLoss = Color(0xFF1E9E63);
}

/// 构建 StockCal 主题（深色 / 浅色）。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: StockCalColors.primary,
    brightness: brightness,
  ).copyWith(
    primary: StockCalColors.primary,
    onPrimary: dark ? const Color(0xFF04222E) : Colors.white,
    secondary: dark ? StockCalColors.accent : StockCalColors.primary,
    onSecondary: dark ? const Color(0xFF1C1C1C) : Colors.white,
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
