import 'package:flutter/material.dart';

/// K 线指标调色板。深浅共用。
@immutable
class IndicatorPalette {
  const IndicatorPalette({
    required this.ma5,
    required this.ma10,
    required this.ma20,
    required this.ma30,
    required this.ma60,
    required this.ma120,
    required this.ma250,
    required this.boll,
  });

  final Color ma5;
  final Color ma10;
  final Color ma20;
  final Color ma30;
  final Color ma60;
  final Color ma120;
  final Color ma250;
  final Color boll;

  static const IndicatorPalette standard = IndicatorPalette(
    ma5: Color(0xFFD6A12A),
    ma10: Color(0xFF4E9BD6),
    ma20: Color(0xFFA46EE8),
    ma30: Color(0xFFD56C9A),
    ma60: Color(0xFF45A88B),
    ma120: Color(0xFFE17B43),
    ma250: Color(0xFF65738A),
    boll: Color(0xFF6678E5),
  );
}

/// 圆角。不随亮度变化。
class StockCalRadii {
  StockCalRadii._();

  static const double panel = 11;
  static const double card = 9;
  static const double tile = 7;
  static const double button = 8;
  static const double chip = 5;
  static const double hairline = 1;
}

/// 字号阶。不随亮度变化。
///
/// 除 [micro] 外照抄原型。原型该档为 8px，Flutter 中 8 逻辑像素在手机上
/// 不可读且不满足无障碍要求，故抬到 10。
class StockCalType {
  StockCalType._();

  static const double eyebrow = 9;
  static const double micro = 10;
  static const double label = 10;
  static const double body = 11;
  static const double bodyLg = 12;
  static const double metric = 17;
  static const double metricLg = 18;
  static const double h2 = 18;

  /// 原型 eyebrow 为 .14em；Flutter letterSpacing 单位是逻辑像素。
  static const double eyebrowSpacing = eyebrow * 0.14;
}

/// StockCal 设计 token。
///
/// 浅色取值来源：`docs/stockcal-prototype.css`（线上原型样式表）。
/// 深色为过渡取值，待 X 配色确定后整段替换。
@immutable
class StockCalTokens extends ThemeExtension<StockCalTokens> {
  const StockCalTokens({
    required this.canvas,
    required this.surface,
    required this.surfaceSunken,
    required this.surfaceHeader,
    required this.surfaceInset,
    required this.line,
    required this.softLine,
    required this.tileLine,
    required this.ink,
    required this.muted,
    required this.faint,
    required this.eyebrowInk,
    required this.rise,
    required this.riseSoft,
    required this.fall,
    required this.fallSoft,
    required this.profit,
    required this.profitSoft,
    required this.loss,
    required this.lossSoft,
    required this.accent,
    required this.accentSoft,
    required this.amber,
    required this.amberSoft,
    required this.panelShadow,
    required this.indicators,
  });

  // —— 底与面 ——
  final Color canvas;
  final Color surface;
  final Color surfaceSunken;
  final Color surfaceHeader;
  final Color surfaceInset;

  // —— 线 ——
  final Color line;
  final Color softLine;
  final Color tileLine;

  // —— 字 ——
  final Color ink;
  final Color muted;
  final Color faint;
  final Color eyebrowInk;

  // —— 行情方向（红涨绿跌）——
  final Color rise;
  final Color riseSoft;
  final Color fall;
  final Color fallSoft;

  // —— 损益金额（绿盈红亏）——
  //
  // 与行情方向极性相反，这是原型的实际行为，非笔误。
  final Color profit;
  final Color profitSoft;
  final Color loss;
  final Color lossSoft;

  // —— 强调 ——
  final Color accent;
  final Color accentSoft;
  final Color amber;
  final Color amberSoft;

  final List<BoxShadow> panelShadow;
  final IndicatorPalette indicators;

  static StockCalTokens of(BuildContext context) =>
      Theme.of(context).extension<StockCalTokens>() ?? StockCalTokens.light();

  factory StockCalTokens.light() => const StockCalTokens(
    canvas: Color(0xFFF5F6F8),
    surface: Color(0xFFFFFFFF),
    surfaceSunken: Color(0xFFFBFCFE),
    surfaceHeader: Color(0xFFF7F8FB),
    surfaceInset: Color(0xFFEEF0F4),
    line: Color(0xFFE7E9EF),
    softLine: Color(0xFFEEF0F5),
    tileLine: Color(0xFFE3E6ED),
    ink: Color(0xFF172033),
    muted: Color(0xFF6C7486),
    faint: Color(0xFF9299A8),
    eyebrowInk: Color(0xFF9198A7),
    rise: Color(0xFFE94052),
    riseSoft: Color(0xFFFFF1F2),
    fall: Color(0xFF0A9F6F),
    fallSoft: Color(0xFFEAF9F3),
    profit: Color(0xFF27875D),
    profitSoft: Color(0xFFEEFAF3),
    loss: Color(0xFFD24A55),
    lossSoft: Color(0xFFFFF1F2),
    accent: Color(0xFF4057E8),
    accentSoft: Color(0xFFEDF0FF),
    amber: Color(0xFFE39B2E),
    amberSoft: Color(0xFFFFF8E9),
    panelShadow: [
      BoxShadow(color: Color(0x081E2A46), blurRadius: 12, offset: Offset(0, 3)),
    ],
    indicators: IndicatorPalette.standard,
  );

  /// 过渡取值，待 X 配色确定后替换本工厂整体。
  /// 来源：`docs/stockcal-redesign-prototype-v1.html` 深色块。
  factory StockCalTokens.dark() => const StockCalTokens(
    canvas: Color(0xFF0A0E15),
    surface: Color(0xFF111623),
    surfaceSunken: Color(0xFF0D111A),
    surfaceHeader: Color(0xFF151B29),
    surfaceInset: Color(0xFF1A2130),
    line: Color(0xFF1E2636),
    softLine: Color(0xFF182030),
    tileLine: Color(0xFF2A3346),
    ink: Color(0xFFE7ECF5),
    muted: Color(0xFF8B94A8),
    faint: Color(0xFF5A6478),
    eyebrowInk: Color(0xFF5A6478),
    rise: Color(0xFFF0525D),
    riseSoft: Color(0x26F0525D),
    fall: Color(0xFF2BB673),
    fallSoft: Color(0x262BB673),
    profit: Color(0xFF3FBF85),
    profitSoft: Color(0x263FBF85),
    loss: Color(0xFFE8606B),
    lossSoft: Color(0x26E8606B),
    accent: Color(0xFF5B74FF),
    accentSoft: Color(0x2E5B74FF),
    amber: Color(0xFFE39B2E),
    amberSoft: Color(0x29E39B2E),
    panelShadow: [
      BoxShadow(color: Color(0x66000000), blurRadius: 16, offset: Offset(0, 4)),
    ],
    indicators: IndicatorPalette.standard,
  );

  @override
  StockCalTokens copyWith({
    Color? canvas,
    Color? surface,
    Color? surfaceSunken,
    Color? surfaceHeader,
    Color? surfaceInset,
    Color? line,
    Color? softLine,
    Color? tileLine,
    Color? ink,
    Color? muted,
    Color? faint,
    Color? eyebrowInk,
    Color? rise,
    Color? riseSoft,
    Color? fall,
    Color? fallSoft,
    Color? profit,
    Color? profitSoft,
    Color? loss,
    Color? lossSoft,
    Color? accent,
    Color? accentSoft,
    Color? amber,
    Color? amberSoft,
    List<BoxShadow>? panelShadow,
    IndicatorPalette? indicators,
  }) {
    return StockCalTokens(
      canvas: canvas ?? this.canvas,
      surface: surface ?? this.surface,
      surfaceSunken: surfaceSunken ?? this.surfaceSunken,
      surfaceHeader: surfaceHeader ?? this.surfaceHeader,
      surfaceInset: surfaceInset ?? this.surfaceInset,
      line: line ?? this.line,
      softLine: softLine ?? this.softLine,
      tileLine: tileLine ?? this.tileLine,
      ink: ink ?? this.ink,
      muted: muted ?? this.muted,
      faint: faint ?? this.faint,
      eyebrowInk: eyebrowInk ?? this.eyebrowInk,
      rise: rise ?? this.rise,
      riseSoft: riseSoft ?? this.riseSoft,
      fall: fall ?? this.fall,
      fallSoft: fallSoft ?? this.fallSoft,
      profit: profit ?? this.profit,
      profitSoft: profitSoft ?? this.profitSoft,
      loss: loss ?? this.loss,
      lossSoft: lossSoft ?? this.lossSoft,
      accent: accent ?? this.accent,
      accentSoft: accentSoft ?? this.accentSoft,
      amber: amber ?? this.amber,
      amberSoft: amberSoft ?? this.amberSoft,
      panelShadow: panelShadow ?? this.panelShadow,
      indicators: indicators ?? this.indicators,
    );
  }

  @override
  StockCalTokens lerp(ThemeExtension<StockCalTokens>? other, double t) {
    if (other is! StockCalTokens) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return StockCalTokens(
      canvas: c(canvas, other.canvas),
      surface: c(surface, other.surface),
      surfaceSunken: c(surfaceSunken, other.surfaceSunken),
      surfaceHeader: c(surfaceHeader, other.surfaceHeader),
      surfaceInset: c(surfaceInset, other.surfaceInset),
      line: c(line, other.line),
      softLine: c(softLine, other.softLine),
      tileLine: c(tileLine, other.tileLine),
      ink: c(ink, other.ink),
      muted: c(muted, other.muted),
      faint: c(faint, other.faint),
      eyebrowInk: c(eyebrowInk, other.eyebrowInk),
      rise: c(rise, other.rise),
      riseSoft: c(riseSoft, other.riseSoft),
      fall: c(fall, other.fall),
      fallSoft: c(fallSoft, other.fallSoft),
      profit: c(profit, other.profit),
      profitSoft: c(profitSoft, other.profitSoft),
      loss: c(loss, other.loss),
      lossSoft: c(lossSoft, other.lossSoft),
      accent: c(accent, other.accent),
      accentSoft: c(accentSoft, other.accentSoft),
      amber: c(amber, other.amber),
      amberSoft: c(amberSoft, other.amberSoft),
      panelShadow: t < 0.5 ? panelShadow : other.panelShadow,
      indicators: t < 0.5 ? indicators : other.indicators,
    );
  }
}
