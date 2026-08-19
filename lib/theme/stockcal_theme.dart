import 'package:flutter/material.dart';

/// StockCal 金融主题调色板（TradingView 深色专业风）。
///
/// A 股约定：红涨绿跌。主色为蓝，黄作点缀。
class StockCalColors {
  StockCalColors._();

  // —— 深色（主打，2026 Midnight Blue）——
  static const Color bg = Color(0xFF0F1219); // 页面背景（午夜海军蓝）
  static const Color surface = Color(0xFF1A1E27); // 卡片 / 面板
  static const Color surfaceHigh = Color(0xFF262B36); // 浮层 / 选中
  static const Color primary = Color(0xFF3B6FE0); // 主色蓝
  static const Color accent = Color(0xFFE8A23C); // 暖金点缀
  static const Color gain = Color(0xFFF23645); // 涨（红）
  static const Color loss = Color(0xFF089981); // 跌（绿）
  static const Color textPrimary = Color(0xFFE3E6EB);
  static const Color textSecondary = Color(0xFF8A90A0);
  static const Color border = Color(0xFF262B36);

  // —— 浅色 ——
  static const Color lightBg = Color(0xFFF4F6F9);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightTextPrimary = Color(0xFF1B1F27);
  static const Color lightTextSecondary = Color(0xFF6B7280);
  static const Color lightBorder = Color(0xFFE2E5EA);
  static const Color lightGain = Color(0xFFD93025);
  static const Color lightLoss = Color(0xFF188038);
}

/// 构建 StockCal 主题（深色 / 浅色）。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: StockCalColors.primary,
    brightness: brightness,
  ).copyWith(
    primary: StockCalColors.primary,
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
        foregroundColor: Colors.white,
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
