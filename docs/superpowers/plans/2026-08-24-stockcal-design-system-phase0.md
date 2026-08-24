# StockCal 设计系统层（Phase 0）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把原型 CSS 的视觉语言固化为一套 Flutter token + 十个共享表现型组件，使后续九个业务屏的改造变成「填数据」。

**Architecture:** `StockCalTokens` 作为 `ThemeExtension` 承载全部随亮度变化的取值（颜色、阴影、K 线调色板）；不随亮度变化的（圆角、字号阶）放在普通 `const` 类里。`buildStockCalTheme(Brightness)` 从 token 推导 `ThemeData`。十个组件只读 token，颜色字面量一律不出现在组件文件中。本期不改动任何业务屏。

**Tech Stack:** Flutter / Material 3 / `flutter_test`

**Spec:** `docs/superpowers/specs/2026-08-24-stockcal-design-system-design.md`

## Global Constraints

- 浅色取值以 spec「一、Token 层」表格为准，逐值精确，不得近似。
- 颜色字面量（`0xFF…` / `Color(...)`）**只许**出现在 `lib/theme/design_tokens.dart`。其余新增文件中出现即为缺陷。
- 组件为表现型：入参是数据与回调，不访问 repository、不含业务逻辑。
- 组件名 `StatusBadge`，**不可**命名为 `Badge`（与 `material.Badge` 冲突）。
- 本期不改动 `lib/features/**`，唯二例外：新增 `lib/features/dev/design_gallery_screen.dart`、在设置页加画廊入口。
- `lib/widgets/metric_card.dart` 不动。
- 每个 task 结束时 `flutter analyze` 必须 0 issue。
- 验收结果以实际运行输出为准，不引用历史记录。

---

### Task 1: Token 层

**Files:**
- Create: `lib/theme/design_tokens.dart`
- Test: `test/theme/design_tokens_test.dart`

**Interfaces:**
- Consumes: 无
- Produces: `StockCalTokens`（`ThemeExtension`，字段见下）、`StockCalTokens.of(BuildContext)`、`StockCalTokens.light()`、`StockCalTokens.dark()`、`IndicatorPalette`、`StockCalRadii`、`StockCalType`

- [ ] **Step 1: 写失败测试**

```dart
// test/theme/design_tokens_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';

void main() {
  group('StockCalTokens.light 逐值等于原型取值', () {
    final t = StockCalTokens.light();

    test('底与面', () {
      expect(t.canvas, const Color(0xFFF5F6F8));
      expect(t.surface, const Color(0xFFFFFFFF));
      expect(t.surfaceSunken, const Color(0xFFFBFCFE));
      expect(t.surfaceHeader, const Color(0xFFF7F8FB));
      expect(t.surfaceInset, const Color(0xFFEEF0F4));
    });

    test('线', () {
      expect(t.line, const Color(0xFFE7E9EF));
      expect(t.softLine, const Color(0xFFEEF0F5));
      expect(t.tileLine, const Color(0xFFE3E6ED));
    });

    test('字', () {
      expect(t.ink, const Color(0xFF172033));
      expect(t.muted, const Color(0xFF6C7486));
      expect(t.faint, const Color(0xFF9299A8));
      expect(t.eyebrowInk, const Color(0xFF9198A7));
    });

    test('行情方向：红涨绿跌', () {
      expect(t.rise, const Color(0xFFE94052));
      expect(t.riseSoft, const Color(0xFFFFF1F2));
      expect(t.fall, const Color(0xFF0A9F6F));
      expect(t.fallSoft, const Color(0xFFEAF9F3));
    });

    test('损益金额：绿盈红亏，与行情方向极性相反', () {
      expect(t.profit, const Color(0xFF27875D));
      expect(t.profitSoft, const Color(0xFFEEFAF3));
      expect(t.loss, const Color(0xFFD24A55));
      expect(t.lossSoft, const Color(0xFFFFF1F2));
      expect(t.profit, isNot(t.rise));
      expect(t.loss, isNot(t.fall));
    });

    test('强调', () {
      expect(t.accent, const Color(0xFF4057E8));
      expect(t.accentSoft, const Color(0xFFEDF0FF));
      expect(t.amber, const Color(0xFFE39B2E));
      expect(t.amberSoft, const Color(0xFFFFF8E9));
    });

    test('K 线指标调色板', () {
      expect(t.indicators.ma5, const Color(0xFFD6A12A));
      expect(t.indicators.ma10, const Color(0xFF4E9BD6));
      expect(t.indicators.ma20, const Color(0xFFA46EE8));
      expect(t.indicators.ma30, const Color(0xFFD56C9A));
      expect(t.indicators.ma60, const Color(0xFF45A88B));
      expect(t.indicators.ma120, const Color(0xFFE17B43));
      expect(t.indicators.ma250, const Color(0xFF65738A));
      expect(t.indicators.boll, const Color(0xFF6678E5));
    });
  });

  test('dark 槽位齐全（取值为过渡值，不断言具体色）', () {
    final d = StockCalTokens.dark();
    expect(d.canvas, isNot(StockCalTokens.light().canvas));
    // 结构完整性：任一槽位缺失都会在构造期报错，此处断言关键槽位可读且成对
    expect(d.riseSoft, isNotNull);
    expect(d.fallSoft, isNotNull);
    expect(d.profitSoft, isNotNull);
    expect(d.lossSoft, isNotNull);
    expect(d.indicators.ma5, StockCalTokens.light().indicators.ma5,
        reason: '指标调色板深浅共用');
  });

  test('ThemeExtension 契约：lerp 与 copyWith', () {
    final l = StockCalTokens.light();
    final d = StockCalTokens.dark();
    expect(l.lerp(d, 0).canvas, l.canvas);
    expect(l.lerp(d, 1).canvas, d.canvas);
    expect(l.lerp(null, 0.5), l);
    expect(l.copyWith(accent: const Color(0xFF123456)).accent,
        const Color(0xFF123456));
    expect(l.copyWith().canvas, l.canvas);
  });

  testWidgets('可经 Theme 取出', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: const Scaffold(body: SizedBox()),
    ));
    final ctx = tester.element(find.byType(Scaffold));
    expect(StockCalTokens.of(ctx).accent, const Color(0xFF4057E8));
  });

  test('字号阶与圆角', () {
    expect(StockCalType.eyebrow, 9);
    expect(StockCalType.micro, 10, reason: '原型 8px 抬到 10，唯一偏离处');
    expect(StockCalType.h2, 18);
    expect(StockCalRadii.panel, 11);
    expect(StockCalRadii.tile, 7);
  });
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `flutter test test/theme/design_tokens_test.dart`
Expected: FAIL —— `Target of URI doesn't exist: 'package:stockcal/theme/design_tokens.dart'`

- [ ] **Step 3: 实现**

```dart
// lib/theme/design_tokens.dart
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

  // 底与面
  final Color canvas;
  final Color surface;
  final Color surfaceSunken;
  final Color surfaceHeader;
  final Color surfaceInset;

  // 线
  final Color line;
  final Color softLine;
  final Color tileLine;

  // 字
  final Color ink;
  final Color muted;
  final Color faint;
  final Color eyebrowInk;

  // 行情方向（红涨绿跌）
  final Color rise;
  final Color riseSoft;
  final Color fall;
  final Color fallSoft;

  // 损益金额（绿盈红亏）—— 与行情方向极性相反，照原型
  final Color profit;
  final Color profitSoft;
  final Color loss;
  final Color lossSoft;

  // 强调
  final Color accent;
  final Color accentSoft;
  final Color amber;
  final Color amberSoft;

  final List<BoxShadow> panelShadow;
  final IndicatorPalette indicators;

  static StockCalTokens of(BuildContext context) =>
      Theme.of(context).extension<StockCalTokens>() ?? light();

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
          BoxShadow(
            color: Color(0x081E2A46),
            blurRadius: 12,
            offset: Offset(0, 3),
          ),
        ],
        indicators: IndicatorPalette.standard,
      );

  /// 过渡取值，待 X 配色确定后替换本工厂整体。
  /// 来源：docs/stockcal-redesign-prototype-v1.html 深色块。
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
          BoxShadow(
            color: Color(0x66000000),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `flutter test test/theme/design_tokens_test.dart && flutter analyze lib/theme/design_tokens.dart`
Expected: 全部 PASS，analyze 0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/theme/design_tokens.dart test/theme/design_tokens_test.dart
git commit -m "feat(theme): add StockCalTokens design-token layer from prototype CSS"
```

---

### Task 2: 主题从 token 推导 + display 接线

**Files:**
- Modify: `lib/theme/stockcal_theme.dart`（全文改写）
- Modify: `lib/core/display.dart`
- Modify: `test/theme/stockcal_theme_test.dart`（更新断言）
- Modify: `test/features/chart/chart_theme_test.dart`（更新断言）

**Interfaces:**
- Consumes: Task 1 的 `StockCalTokens`、`StockCalRadii`
- Produces: `buildStockCalTheme(Brightness)`（签名不变，`ThemeData.extensions` 含 `StockCalTokens`）；`display.dart` 新增 `profitColor(BuildContext)` / `lossAmountColor(BuildContext)`

**关键约束：不得静默翻转既有九屏的颜色。** `gainColor` / `lossColor` / `pnlColor` 的**语义与调用关系保持不变**，仅取值改指 token 的 `rise` / `fall`。新增的 `profitColor` / `lossAmountColor` 本期建立但**零调用点**。

- [ ] **Step 1: 更新既有两个测试的断言（先红）**

```dart
// test/theme/stockcal_theme_test.dart —— 全文替换
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/core/display.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/theme/stockcal_theme.dart';

void main() {
  testWidgets('浅色主题取原型取值，且挂载 token 扩展', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.light),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFFF5F6F8));
    expect(Theme.of(context).colorScheme.primary, const Color(0xFF4057E8));
    expect(StockCalTokens.of(context).canvas, const Color(0xFFF5F6F8));
    // 行情方向：红涨绿跌，语义未变
    expect(gainColor(context), const Color(0xFFE94052));
    expect(lossColor(context), const Color(0xFF0A9F6F));
    // 损益金额：绿盈红亏，与行情方向极性相反
    expect(profitColor(context), const Color(0xFF27875D));
    expect(lossAmountColor(context), const Color(0xFFD24A55));
  });

  testWidgets('深色主题挂载 token 扩展且槽位可读', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.dark),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(Theme.of(context).brightness, Brightness.dark);
    expect(Theme.of(context).scaffoldBackgroundColor,
        StockCalTokens.dark().canvas);
    expect(StockCalTokens.of(context).accent, StockCalTokens.dark().accent);
  });

  testWidgets('pnlColor 行为未变：仍走行情方向色', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.light),
      home: const Scaffold(body: SizedBox()),
    ));
    final context = tester.element(find.byType(Scaffold));
    expect(pnlColor(context, 1), gainColor(context));
    expect(pnlColor(context, -1), lossColor(context));
    expect(pnlColor(context, 0), isNull);
  });
}
```

```dart
// test/features/chart/chart_theme_test.dart —— 仅替换第一个 test 块
  test('chart palette constants follow the prototype palette', () {
    expect(StockCalColors.gain, const Color(0xFFE94052));
    expect(StockCalColors.loss, const Color(0xFF0A9F6F));
    expect(StockCalColors.accent, const Color(0xFF4057E8));
  });
```

（该文件第二个 `testWidgets('chart renders with theme colors', ...)` 保持原样不动。）

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/theme/stockcal_theme_test.dart test/features/chart/chart_theme_test.dart`
Expected: FAIL —— 断言色值不符；`profitColor` 未定义

- [ ] **Step 3: 改写 `stockcal_theme.dart`**

`StockCalColors` 保留（41 处引用不动），仅把常量取值改为从 token 取；加 `@Deprecated`。`buildStockCalTheme` 改为从 token 推导，并把 token 挂进 `extensions`。

```dart
// lib/theme/stockcal_theme.dart
import 'package:flutter/material.dart';

import 'design_tokens.dart';

/// StockCal 调色板（兼容层）。
///
/// 取值现由 [StockCalTokens] 提供。保留本类是为了不改动 41 处既有引用；
/// 新代码请直接使用 `StockCalTokens.of(context)`，本类将随各屏改造逐步退役。
@Deprecated('改用 StockCalTokens.of(context)；本类随各屏改造逐步退役')
class StockCalColors {
  StockCalColors._();

  static final StockCalTokens _d = StockCalTokens.dark();
  static final StockCalTokens _l = StockCalTokens.light();

  // —— 深色 ——
  static final Color bg = _d.canvas;
  static final Color surface = _d.surface;
  static final Color surfaceHigh = _d.surfaceInset;
  static final Color primary = _d.accent;
  static final Color accent = _l.accent;
  static final Color gain = _l.rise;
  static final Color loss = _l.fall;
  static final Color textPrimary = _d.ink;
  static final Color textSecondary = _d.muted;
  static final Color border = _d.line;

  // —— 浅色 ——
  static final Color lightBg = _l.canvas;
  static final Color lightSurface = _l.surface;
  static final Color lightPrimary = _l.accent;
  static final Color lightTextPrimary = _l.ink;
  static final Color lightTextSecondary = _l.muted;
  static final Color lightBorder = _l.line;
  static final Color lightGain = _l.rise;
  static final Color lightLoss = _l.fall;
}

/// 构建 StockCal 主题（深色 / 浅色）。取值全部来自 [StockCalTokens]。
ThemeData buildStockCalTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final t = dark ? StockCalTokens.dark() : StockCalTokens.light();
  const radius = StockCalRadii.button;
  const borderWidth = StockCalRadii.hairline;
  final onPrimary = dark ? Colors.white : Colors.white;

  final scheme = ColorScheme.fromSeed(
    seedColor: t.accent,
    brightness: brightness,
  ).copyWith(
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
```

- [ ] **Step 4: 改 `display.dart`**

```dart
// lib/core/display.dart
import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

/// Tabular figures keep numeric columns aligned.
/// Production design requires: "Numbers use tabular alignment."
const FontFeature tabularFigures = FontFeature.tabularFigures();

/// 行情方向色。A 股约定：红涨绿跌。
///
/// 注意与 [profitColor] / [lossAmountColor] 区分：本对表达**价格方向**
/// （涨跌幅、最高最低、关键区方向），极性为红涨绿跌。
Color gainColor(BuildContext context) => StockCalTokens.of(context).rise;

Color lossColor(BuildContext context) => StockCalTokens.of(context).fall;

/// 损益金额色。原型约定：绿盈红亏。
///
/// 与 [gainColor] / [lossColor] **极性相反**，这是原型的实际行为：
/// 同页中「最高 32.96」为红（行情方向），「浮动盈亏 +1170.00」为绿（损益）。
///
/// 本期建立但零调用点；各屏改造时逐个调用点判定该用哪一对。
Color profitColor(BuildContext context) => StockCalTokens.of(context).profit;

Color lossAmountColor(BuildContext context) =>
    StockCalTokens.of(context).loss;

/// Semantic color for a signed profit/loss value; null (neutral) when flat.
///
/// 行为未变：仍走行情方向色，以免静默翻转既有各屏。
Color? pnlColor(BuildContext context, double value) {
  if (value > 0) return gainColor(context);
  if (value < 0) return lossColor(context);
  return null;
}

/// Attaches tabular figures to a text style without mutating the source.
TextStyle withTabular(TextStyle? style) =>
    (style ?? const TextStyle()).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
```

- [ ] **Step 5: 运行全量测试**

Run: `flutter test && flutter analyze`
Expected: 全绿；analyze 0 issue。

若有既有测试因配色变更而红，逐个查看：**断言旧青色取值的**更新为新取值；**断言布局/行为的**若红则说明改坏了，必须修实现而非改断言。

- [ ] **Step 6: 提交**

```bash
git add lib/theme/stockcal_theme.dart lib/core/display.dart \
        test/theme/stockcal_theme_test.dart test/features/chart/chart_theme_test.dart
git commit -m "feat(theme): derive ThemeData from tokens, adopt prototype light-blue palette"
```

---

### Task 3: MonoText + StatusBadge

**Files:**
- Create: `lib/widgets/design/mono_text.dart`, `lib/widgets/design/status_badge.dart`
- Test: `test/widgets/design/mono_text_test.dart`, `test/widgets/design/status_badge_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`、`StockCalType`、`StockCalRadii`
- Produces: `MonoText(String text, {double? size, Color? color, FontWeight? weight})`；`StatusBadge(String label, {BadgeTone tone, bool dot, bool mono})`；`enum BadgeTone { neutral, accent, amber, rise, fall, profit, loss }`

> 命名：**必须**叫 `StatusBadge`。`Badge` 与 `material.Badge` 冲突。

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/mono_text_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/mono_text.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.light}) =>
    MaterialApp(
      theme: ThemeData(extensions: [
        brightness == Brightness.light
            ? StockCalTokens.light()
            : StockCalTokens.dark(),
      ]),
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('带 tabular figures', (tester) async {
    await tester.pumpWidget(_wrap(const MonoText('32.68')));
    final style = tester.widget<Text>(find.text('32.68')).style!;
    expect(style.fontFeatures, contains(const FontFeature.tabularFigures()));
  });

  testWidgets('默认色取 token 的 ink，不硬编码', (tester) async {
    await tester.pumpWidget(_wrap(const MonoText('32.68')));
    final style = tester.widget<Text>(find.text('32.68')).style!;
    expect(style.color, StockCalTokens.light().ink);

    await tester.pumpWidget(_wrap(const MonoText('32.68'),
        brightness: Brightness.dark));
    await tester.pumpAndSettle();
    final darkStyle = tester.widget<Text>(find.text('32.68')).style!;
    expect(darkStyle.color, StockCalTokens.dark().ink);
  });

  testWidgets('可覆盖字号与颜色', (tester) async {
    await tester.pumpWidget(_wrap(
      const MonoText('32.68', size: 17, color: Color(0xFF123456)),
    ));
    final style = tester.widget<Text>(find.text('32.68')).style!;
    expect(style.fontSize, 17);
    expect(style.color, const Color(0xFF123456));
  });
}
```

```dart
// test/widgets/design/status_badge_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/status_badge.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: child),
    );

BoxDecoration _decoOf(WidgetTester tester) => tester
    .widget<Container>(find.descendant(
      of: find.byType(StatusBadge),
      matching: find.byType(Container),
    ))
    .decoration! as BoxDecoration;

void main() {
  final t = StockCalTokens.light();

  final cases = <BadgeTone, (Color fg, Color bg)>{
    BadgeTone.neutral: (t.faint, t.surfaceInset),
    BadgeTone.accent: (t.accent, t.accentSoft),
    BadgeTone.amber: (t.amber, t.amberSoft),
    BadgeTone.rise: (t.rise, t.riseSoft),
    BadgeTone.fall: (t.fall, t.fallSoft),
    BadgeTone.profit: (t.profit, t.profitSoft),
    BadgeTone.loss: (t.loss, t.lossSoft),
  };

  cases.forEach((tone, pair) {
    testWidgets('tone $tone 的前景/背景成对取自 token', (tester) async {
      await tester.pumpWidget(_wrap(StatusBadge('标签', tone: tone)));
      expect(_decoOf(tester).color, pair.$2);
      expect(tester.widget<Text>(find.text('标签')).style!.color, pair.$1);
    });
  });

  testWidgets('dot 为 true 时渲染圆点', (tester) async {
    await tester.pumpWidget(
        _wrap(const StatusBadge('一致', tone: BadgeTone.fall, dot: true)));
    expect(find.byKey(const ValueKey('status-badge-dot')), findsOneWidget);
  });

  testWidgets('dot 默认关闭', (tester) async {
    await tester.pumpWidget(_wrap(const StatusBadge('一致')));
    expect(find.byKey(const ValueKey('status-badge-dot')), findsNothing);
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/mono_text.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 等宽 + tabular 数字。所有价格、数量、百分比用它。
class MonoText extends StatelessWidget {
  const MonoText(
    this.text, {
    super.key,
    this.size,
    this.color,
    this.weight,
    this.textAlign,
  });

  final String text;
  final double? size;
  final Color? color;
  final FontWeight? weight;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Text(
      text,
      textAlign: textAlign,
      style: TextStyle(
        fontFamily: 'monospace',
        fontFamilyFallback: const ['SF Mono', 'Consolas', 'Menlo'],
        fontSize: size ?? StockCalType.body,
        fontWeight: weight ?? FontWeight.w600,
        color: color ?? t.ink,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}
```

```dart
// lib/widgets/design/status_badge.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 徽章色调。
///
/// [rise] / [fall] 表达行情方向（红涨绿跌）；
/// [profit] / [loss] 表达损益金额（绿盈红亏）。两者极性相反，勿混用。
enum BadgeTone { neutral, accent, amber, rise, fall, profit, loss }

/// 小徽章。还原原型的 `.panel-note` / `.demo-tag` / `.trade-badge`
/// / `.history-status` / `.status-dot`。
///
/// 命名为 StatusBadge 而非 Badge，以避免与 material.Badge 冲突。
class StatusBadge extends StatelessWidget {
  const StatusBadge(
    this.label, {
    super.key,
    this.tone = BadgeTone.neutral,
    this.dot = false,
    this.mono = false,
  });

  final String label;
  final BadgeTone tone;

  /// 是否在文字前渲染一个带光晕的圆点（还原 `.status-dot`）。
  final bool dot;

  /// 是否用等宽字（还原 `.rule-card-head span` 的规则编号）。
  final bool mono;

  (Color fg, Color bg) _colors(StockCalTokens t) => switch (tone) {
        BadgeTone.neutral => (t.faint, t.surfaceInset),
        BadgeTone.accent => (t.accent, t.accentSoft),
        BadgeTone.amber => (t.amber, t.amberSoft),
        BadgeTone.rise => (t.rise, t.riseSoft),
        BadgeTone.fall => (t.fall, t.fallSoft),
        BadgeTone.profit => (t.profit, t.profitSoft),
        BadgeTone.loss => (t.loss, t.lossSoft),
      };

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final (fg, bg) = _colors(t);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(StockCalRadii.chip),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              key: const ValueKey('status-badge-dot'),
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: fg,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: bg, spreadRadius: 3),
                ],
              ),
            ),
            const SizedBox(width: 7),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: StockCalType.eyebrow,
              fontWeight: FontWeight.w700,
              color: fg,
              fontFamily: mono ? 'monospace' : null,
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/ && flutter analyze`
Expected: PASS，0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/mono_text.dart lib/widgets/design/status_badge.dart \
        test/widgets/design/mono_text_test.dart test/widgets/design/status_badge_test.dart
git commit -m "feat(design): add MonoText and StatusBadge primitives"
```

---

### Task 4: SectionHeading + PanelCard

**Files:**
- Create: `lib/widgets/design/section_heading.dart`, `lib/widgets/design/panel_card.dart`
- Test: `test/widgets/design/section_heading_test.dart`, `test/widgets/design/panel_card_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`、`StockCalType`、`StockCalRadii`
- Produces: `SectionHeading({required String eyebrow, required String title, Widget? trailing})`；`PanelCard({required Widget child, EdgeInsets padding})`

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/section_heading_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/section_heading.dart';
import 'package:stockcal/widgets/design/status_badge.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: child),
    );

void main() {
  final t = StockCalTokens.light();

  testWidgets('eyebrow 大写、带字距、取 token 色', (tester) async {
    await tester.pumpWidget(
        _wrap(const SectionHeading(eyebrow: '组合视角 · 多股票盈亏', title: '组合总览')));
    final style = tester.widget<Text>(find.text('组合视角 · 多股票盈亏')).style!;
    expect(style.fontSize, StockCalType.eyebrow);
    expect(style.letterSpacing, StockCalType.eyebrowSpacing);
    expect(style.fontWeight, FontWeight.w800);
    expect(style.color, t.eyebrowInk);
  });

  testWidgets('title 取 h2 字号与 ink 色', (tester) async {
    await tester.pumpWidget(
        _wrap(const SectionHeading(eyebrow: 'A', title: '组合总览')));
    final style = tester.widget<Text>(find.text('组合总览')).style!;
    expect(style.fontSize, StockCalType.h2);
    expect(style.color, t.ink);
  });

  testWidgets('trailing 渲染在尾部', (tester) async {
    await tester.pumpWidget(_wrap(const SectionHeading(
      eyebrow: 'A',
      title: 'B',
      trailing: StatusBadge('演示持仓 · 非真实账户'),
    )));
    expect(find.byType(StatusBadge), findsOneWidget);
  });

  testWidgets('无 trailing 时不占位', (tester) async {
    await tester
        .pumpWidget(_wrap(const SectionHeading(eyebrow: 'A', title: 'B')));
    expect(find.byType(StatusBadge), findsNothing);
    expect(find.byType(Spacer), findsNothing);
  });
}
```

```dart
// test/widgets/design/panel_card_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/panel_card.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.light}) =>
    MaterialApp(
      theme: ThemeData(extensions: [
        brightness == Brightness.light
            ? StockCalTokens.light()
            : StockCalTokens.dark(),
      ]),
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('边框 1px、圆角 11、背景取 surface', (tester) async {
    await tester.pumpWidget(_wrap(const PanelCard(child: Text('x'))));
    final deco = tester
        .widget<Container>(find.descendant(
          of: find.byType(PanelCard),
          matching: find.byType(Container),
        ))
        .decoration! as BoxDecoration;
    final t = StockCalTokens.light();
    expect(deco.color, t.surface);
    expect(deco.border!.top.width, StockCalRadii.hairline);
    expect(deco.border!.top.color, t.line);
    expect(deco.borderRadius,
        BorderRadius.circular(StockCalRadii.panel));
    expect(deco.boxShadow, t.panelShadow);
  });

  testWidgets('深色下取深色 token，不硬编码', (tester) async {
    await tester.pumpWidget(
        _wrap(const PanelCard(child: Text('x')), brightness: Brightness.dark));
    final deco = tester
        .widget<Container>(find.descendant(
          of: find.byType(PanelCard),
          matching: find.byType(Container),
        ))
        .decoration! as BoxDecoration;
    expect(deco.color, StockCalTokens.dark().surface);
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/section_heading_test.dart test/widgets/design/panel_card_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/section_heading.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 区块标题。还原原型 `.section-heading` + `.eyebrow`。
///
/// 左侧为 eyebrow 小标题 + 主标题，右侧为可选插槽（徽章 / 图例 / 状态点）。
class SectionHeading extends StatelessWidget {
  const SectionHeading({
    super.key,
    required this.eyebrow,
    required this.title,
    this.trailing,
  });

  final String eyebrow;
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  eyebrow.toUpperCase(),
                  style: TextStyle(
                    fontSize: StockCalType.eyebrow,
                    fontWeight: FontWeight.w800,
                    letterSpacing: StockCalType.eyebrowSpacing,
                    color: t.eyebrowInk,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: StockCalType.h2,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.36,
                    color: t.ink,
                  ),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: 18),
            trailing!,
          ],
        ],
      ),
    );
  }
}
```

```dart
// lib/widgets/design/panel_card.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 面板容器。还原原型 `.panel`。
class PanelCard extends StatelessWidget {
  const PanelCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(17),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: t.surface,
        border: Border.all(color: t.line, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.panel),
        boxShadow: t.panelShadow,
      ),
      child: child,
    );
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/ && flutter analyze`
Expected: PASS，0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/section_heading.dart lib/widgets/design/panel_card.dart \
        test/widgets/design/section_heading_test.dart test/widgets/design/panel_card_test.dart
git commit -m "feat(design): add SectionHeading and PanelCard"
```

---

### Task 5: MetricStrip

**Files:**
- Create: `lib/widgets/design/metric_strip.dart`
- Test: `test/widgets/design/metric_strip_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`、`MonoText`
- Produces: `enum MetricTone { neutral, profit, loss, risk, accent }`；`MetricCell({required String label, required String value, String? unit, MetricTone tone})`；`MetricStrip({required List<MetricCell> cells, int columns, int narrowColumns, double narrowBreakpoint})`

**响应式规则**（还原原型断点）：容器宽度 < `narrowBreakpoint`（默认 640）时列数降为 `narrowColumns`（默认 2）；每行不足列数时，末格占满剩余宽度（还原 `grid-column: span 2`）。断点判定用 `LayoutBuilder` 的容器约束，**不用** `MediaQuery`，以便组件嵌在任意容器内都正确。

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/metric_strip_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/metric_strip.dart';

Widget _wrap(Widget child, {double width = 1200}) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

const _six = [
  MetricCell(label: '持仓股票', value: '3', unit: '只'),
  MetricCell(label: '总投入', value: '78570.00', unit: '元'),
  MetricCell(label: '当前市值', value: '79916.00', unit: '元'),
  MetricCell(
      label: '总浮动盈亏', value: '+1346.00', unit: '元', tone: MetricTone.profit),
  MetricCell(label: '已实现盈亏', value: '+84.00', unit: '元'),
  MetricCell(
      label: '组合收益率', value: '+1.82%', unit: '浮动 + 已实现',
      tone: MetricTone.profit),
];

void main() {
  final t = StockCalTokens.light();

  testWidgets('渲染全部格子的标签、数值、单位', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six)));
    expect(find.text('持仓股票'), findsOneWidget);
    expect(find.text('78570.00'), findsOneWidget);
    expect(find.text('浮动 + 已实现'), findsOneWidget);
  });

  testWidgets('宽屏 6 列排成一行', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six)));
    expect(find.byType(Row), findsNWidgets(1 + 6));
    final rowY = tester.getTopLeft(find.text('持仓股票')).dy;
    expect(tester.getTopLeft(find.text('组合收益率')).dy, rowY,
        reason: '6 格应同在一行');
  });

  testWidgets('窄屏塌为 2 列', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six), width: 420));
    final first = tester.getTopLeft(find.text('持仓股票')).dy;
    final second = tester.getTopLeft(find.text('总投入')).dy;
    final third = tester.getTopLeft(find.text('当前市值')).dy;
    expect(second, first, reason: '前两格同行');
    expect(third, greaterThan(first), reason: '第三格换行');
  });

  testWidgets('末行不足列数时末格占满剩余宽度', (tester) async {
    const five = [
      MetricCell(label: '累计盈亏', value: '+552.00', unit: '元'),
      MetricCell(label: '盈利天数', value: '4 / 5', unit: '交易日'),
      MetricCell(label: '交易次数', value: '12', unit: '买卖合计'),
      MetricCell(label: '平均单笔', value: '46.00', unit: '元'),
      MetricCell(label: '执行偏差', value: '16.7%', unit: '未按计划'),
    ];
    await tester.pumpWidget(_wrap(const MetricStrip(cells: five), width: 420));
    // 2 列 × 3 行，末格独占一行且宽度接近整行
    final lastWidth = tester.getSize(find.ancestor(
      of: find.text('执行偏差'),
      matching: find.byType(MetricTile),
    )).width;
    final firstWidth = tester.getSize(find.ancestor(
      of: find.text('累计盈亏'),
      matching: find.byType(MetricTile),
    )).width;
    expect(lastWidth, greaterThan(firstWidth * 1.8));
  });

  testWidgets('tone 决定数值取色，全部来自 token', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: [
      MetricCell(label: 'a', value: '1', tone: MetricTone.neutral),
      MetricCell(label: 'b', value: '2', tone: MetricTone.profit),
      MetricCell(label: 'c', value: '3', tone: MetricTone.loss),
      MetricCell(label: 'd', value: '4', tone: MetricTone.risk),
      MetricCell(label: 'e', value: '5', tone: MetricTone.accent),
    ])));
    Color colorOf(String v) =>
        tester.widget<Text>(find.text(v)).style!.color!;
    expect(colorOf('1'), t.ink);
    expect(colorOf('2'), t.profit);
    expect(colorOf('3'), t.loss);
    expect(colorOf('4'), t.loss);
    expect(colorOf('5'), t.accent);
  });

  testWidgets('格子背景与边框取 token', (tester) async {
    await tester.pumpWidget(_wrap(const MetricStrip(cells: _six)));
    final deco = tester
        .widget<Container>(find.descendant(
          of: find.byType(MetricTile).first,
          matching: find.byType(Container),
        ))
        .decoration! as BoxDecoration;
    expect(deco.color, t.surfaceSunken);
    expect(deco.border!.top.color, t.tileLine);
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/metric_strip_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/metric_strip.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import 'mono_text.dart';

/// 指标格色调。
///
/// [profit] / [loss] 用于损益金额（绿盈红亏）；[risk] 为风险提示（同 loss 色）。
enum MetricTone { neutral, profit, loss, risk, accent }

/// 一个指标格的数据。
@immutable
class MetricCell {
  const MetricCell({
    required this.label,
    required this.value,
    this.unit,
    this.tone = MetricTone.neutral,
  });

  final String label;
  final String value;
  final String? unit;
  final MetricTone tone;
}

/// 指标条。还原原型 `.portfolio-metrics` ≡ `.stats-metrics` ≡ `.backtest-metrics`。
///
/// 宽屏按 [columns] 列排列；容器宽度小于 [narrowBreakpoint] 时降为
/// [narrowColumns] 列。每行不足列数时末格占满剩余宽度。
class MetricStrip extends StatelessWidget {
  const MetricStrip({
    super.key,
    required this.cells,
    this.columns = 6,
    this.narrowColumns = 2,
    this.narrowBreakpoint = 640,
  });

  final List<MetricCell> cells;
  final int columns;
  final int narrowColumns;
  final double narrowBreakpoint;

  static const double _gap = 9;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cols = constraints.maxWidth < narrowBreakpoint
            ? narrowColumns
            : columns;
        final rows = <Widget>[];
        var i = 0;
        while (i < cells.length) {
          final take = (cells.length - i) < cols ? cells.length - i : cols;
          final slice = cells.sublist(i, i + take);
          rows.add(Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < slice.length; j++) ...[
                if (j > 0) const SizedBox(width: _gap),
                Expanded(
                  // 末行不足列数时，末格吃掉剩余列宽
                  flex: (j == slice.length - 1) ? cols - take + 1 : 1,
                  child: MetricTile(cell: slice[j]),
                ),
              ],
            ],
          ));
          i += take;
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var k = 0; k < rows.length; k++) ...[
              if (k > 0) const SizedBox(height: _gap),
              rows[k],
            ],
          ],
        );
      },
    );
  }
}

/// 单个指标格。公开以便测试定位；业务代码请用 [MetricStrip]。
class MetricTile extends StatelessWidget {
  const MetricTile({super.key, required this.cell});

  final MetricCell cell;

  Color _valueColor(StockCalTokens t) => switch (cell.tone) {
        MetricTone.neutral => t.ink,
        MetricTone.profit => t.profit,
        MetricTone.loss => t.loss,
        MetricTone.risk => t.loss,
        MetricTone.accent => t.accent,
      };

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 70),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: t.surfaceSunken,
        border: Border.all(color: t.tileLine, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.tile),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            cell.label,
            style: TextStyle(fontSize: StockCalType.eyebrow, color: t.faint),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: MonoText(
                  cell.value,
                  size: StockCalType.metric,
                  weight: FontWeight.w700,
                  color: _valueColor(t),
                ),
              ),
              if (cell.unit != null) ...[
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    cell.unit!,
                    style: TextStyle(
                      fontSize: StockCalType.eyebrow,
                      color: t.faint,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/metric_strip_test.dart && flutter analyze`
Expected: PASS，0 issue

若「宽屏 6 列排成一行」的 `findsNWidgets` 计数因实现细节不符，以**同行 y 坐标相等**这一断言为准，调整计数断言而非改布局。

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/metric_strip.dart test/widgets/design/metric_strip_test.dart
git commit -m "feat(design): add responsive MetricStrip"
```

---

### Task 6: LedgerTable

**Files:**
- Create: `lib/widgets/design/ledger_table.dart`
- Test: `test/widgets/design/ledger_table_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`
- Produces: `LedgerColumn(String label, int flex)`；`LedgerRow({required List<Widget> cells, VoidCallback? onTap})`；`LedgerTable({required List<LedgerColumn> columns, required List<LedgerRow> rows})`

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/ledger_table_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/ledger_table.dart';

Widget _wrap(Widget child, {double width = 900}) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

final _columns = const [
  LedgerColumn('股票', 12),
  LedgerColumn('持仓/成本', 10),
  LedgerColumn('浮动盈亏', 9),
];

void main() {
  final t = StockCalTokens.light();

  testWidgets('渲染表头与行', (tester) async {
    await tester.pumpWidget(_wrap(LedgerTable(
      columns: _columns,
      rows: const [
        LedgerRow(cells: [Text('华芯动力'), Text('1500 股'), Text('+1170.00')]),
      ],
    )));
    expect(find.text('股票'), findsOneWidget);
    expect(find.text('华芯动力'), findsOneWidget);
  });

  testWidgets('表头背景取 surfaceHeader', (tester) async {
    await tester.pumpWidget(_wrap(LedgerTable(
      columns: _columns,
      rows: const [
        LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
      ],
    )));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('ledger-head')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.surfaceHeader);
  });

  testWidgets('列宽按 flex 权重分配', (tester) async {
    await tester.pumpWidget(_wrap(LedgerTable(
      columns: _columns,
      rows: const [
        LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
      ],
    )));
    final w1 = tester.getSize(find.text('股票')).width;
    final w3 = tester.getSize(find.text('浮动盈亏')).width;
    expect(w1, greaterThan(w3), reason: 'flex 12 应宽于 flex 9');
  });

  testWidgets('行点击触发回调', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(_wrap(LedgerTable(
      columns: _columns,
      rows: [
        LedgerRow(
          cells: const [Text('a'), Text('b'), Text('c')],
          onTap: () => tapped++,
        ),
      ],
    )));
    await tester.tap(find.text('a'));
    await tester.pump();
    expect(tapped, 1);
  });

  testWidgets('无 onTap 的行不可点', (tester) async {
    await tester.pumpWidget(_wrap(LedgerTable(
      columns: _columns,
      rows: const [
        LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
      ],
    )));
    expect(
      find.descendant(
          of: find.byType(LedgerTable), matching: find.byType(InkWell)),
      findsNothing,
    );
  });

  testWidgets('容器边框与圆角取 token', (tester) async {
    await tester.pumpWidget(_wrap(LedgerTable(
      columns: _columns,
      rows: const [
        LedgerRow(cells: [Text('a'), Text('b'), Text('c')]),
      ],
    )));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('ledger-shell')))
        .decoration! as BoxDecoration;
    expect(deco.border!.top.color, t.tileLine);
    expect(deco.borderRadius, BorderRadius.circular(StockCalRadii.button));
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/ledger_table_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/ledger_table.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 表格列定义。[flex] 为相对宽度权重，还原原型的 `grid-template-columns` 比例
/// （如 `1.2fr 1fr .9fr` 写成 12 / 10 / 9）。
@immutable
class LedgerColumn {
  const LedgerColumn(this.label, this.flex);

  final String label;
  final int flex;
}

/// 表格一行。[cells] 长度须与列数一致。
@immutable
class LedgerRow {
  const LedgerRow({required this.cells, this.onTap});

  final List<Widget> cells;
  final VoidCallback? onTap;
}

/// 账本式表格。还原原型 `.portfolio-table` ≡ `.backtest-table`。
class LedgerTable extends StatelessWidget {
  const LedgerTable({
    super.key,
    required this.columns,
    required this.rows,
  });

  final List<LedgerColumn> columns;
  final List<LedgerRow> rows;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Container(
      key: const ValueKey('ledger-shell'),
      decoration: BoxDecoration(
        border: Border.all(color: t.tileLine, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.button),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            key: const ValueKey('ledger-head'),
            decoration: BoxDecoration(color: t.surfaceHeader),
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
            child: Row(
              children: [
                for (var i = 0; i < columns.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    flex: columns[i].flex,
                    child: Text(
                      columns[i].label,
                      style: TextStyle(
                        fontSize: StockCalType.eyebrow,
                        color: t.faint,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          for (var r = 0; r < rows.length; r++)
            _LedgerRowView(
              row: rows[r],
              columns: columns,
              showTopBorder: true,
            ),
        ],
      ),
    );
  }
}

class _LedgerRowView extends StatelessWidget {
  const _LedgerRowView({
    required this.row,
    required this.columns,
    required this.showTopBorder,
  });

  final LedgerRow row;
  final List<LedgerColumn> columns;
  final bool showTopBorder;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final content = Container(
      decoration: BoxDecoration(
        color: t.surface,
        border: showTopBorder
            ? Border(top: BorderSide(color: t.softLine, width: 1))
            : null,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      child: Row(
        children: [
          for (var i = 0; i < columns.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              flex: columns[i].flex,
              child: i < row.cells.length ? row.cells[i] : const SizedBox(),
            ),
          ],
        ],
      ),
    );
    if (row.onTap == null) return content;
    return InkWell(onTap: row.onTap, child: content);
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/ledger_table_test.dart && flutter analyze`
Expected: PASS，0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/ledger_table.dart test/widgets/design/ledger_table_test.dart
git commit -m "feat(design): add LedgerTable"
```

---

### Task 7: SegTabs

**Files:**
- Create: `lib/widgets/design/seg_tabs.dart`
- Test: `test/widgets/design/seg_tabs_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`
- Produces: `enum SegTabsVariant { pill, chip, duo }`；`SegTabs({required List<String> labels, required int selected, required ValueChanged<int> onSelected, SegTabsVariant variant})`

**三变体对应原型**：`pill` = `.cycle-tabs`（槽底 `surfaceInset`，选中白底）；`chip` = `.period-switches`（白底细边，选中 `accentSoft` 底 + `accent` 字）；`duo` = `.trade-side-tabs`（两格，index 0 取 profit 色系、index 1 取 loss 色系）。

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/seg_tabs_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/seg_tabs.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: Center(child: child)),
    );

BoxDecoration _segDeco(WidgetTester tester, String label) => tester
    .widget<Container>(find.ancestor(
      of: find.text(label),
      matching: find.byKey(const ValueKey('seg-tab-item')),
    ))
    .decoration! as BoxDecoration;

void main() {
  final t = StockCalTokens.light();

  testWidgets('pill：选中白底，未选透明', (tester) async {
    await tester.pumpWidget(_wrap(SegTabs(
      labels: const ['短线', '波段', '中长线'],
      selected: 0,
      onSelected: (_) {},
    )));
    expect(_segDeco(tester, '短线').color, t.surface);
    expect(_segDeco(tester, '波段').color, Colors.transparent);
  });

  testWidgets('pill：槽底取 surfaceInset', (tester) async {
    await tester.pumpWidget(_wrap(SegTabs(
      labels: const ['短线', '波段'],
      selected: 0,
      onSelected: (_) {},
    )));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('seg-tab-track')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.surfaceInset);
  });

  testWidgets('chip：选中取 accentSoft 底与 accent 字', (tester) async {
    await tester.pumpWidget(_wrap(SegTabs(
      labels: const ['日线', '周线', '月线'],
      selected: 1,
      onSelected: (_) {},
      variant: SegTabsVariant.chip,
    )));
    expect(_segDeco(tester, '周线').color, t.accentSoft);
    expect(tester.widget<Text>(find.text('周线')).style!.color, t.accent);
    expect(tester.widget<Text>(find.text('日线')).style!.color, t.muted);
  });

  testWidgets('duo：index 0 选中取 profit 色系，index 1 取 loss 色系',
      (tester) async {
    await tester.pumpWidget(_wrap(SegTabs(
      labels: const ['买入', '卖出'],
      selected: 0,
      onSelected: (_) {},
      variant: SegTabsVariant.duo,
    )));
    expect(_segDeco(tester, '买入').color, t.profitSoft);
    expect(tester.widget<Text>(find.text('买入')).style!.color, t.profit);

    await tester.pumpWidget(_wrap(SegTabs(
      labels: const ['买入', '卖出'],
      selected: 1,
      onSelected: (_) {},
      variant: SegTabsVariant.duo,
    )));
    expect(_segDeco(tester, '卖出').color, t.lossSoft);
    expect(tester.widget<Text>(find.text('卖出')).style!.color, t.loss);
  });

  testWidgets('点击回调返回 index', (tester) async {
    int? got;
    await tester.pumpWidget(_wrap(SegTabs(
      labels: const ['短线', '波段', '中长线'],
      selected: 0,
      onSelected: (i) => got = i,
    )));
    await tester.tap(find.text('中长线'));
    await tester.pump();
    expect(got, 2);
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/seg_tabs_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/seg_tabs.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 分段切换的三种视觉变体。
///
/// - [pill]：原型 `.cycle-tabs`。槽底 + 选中白底浮起。用于操作周期、AI 页签。
/// - [chip]：原型 `.period-switches`。白底细边，选中蓝底蓝字。用于 K 线周期。
/// - [duo]：原型 `.trade-side-tabs`。两格，买绿卖红。
enum SegTabsVariant { pill, chip, duo }

/// 分段切换。
class SegTabs extends StatelessWidget {
  const SegTabs({
    super.key,
    required this.labels,
    required this.selected,
    required this.onSelected,
    this.variant = SegTabsVariant.pill,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelected;
  final SegTabsVariant variant;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final items = [
      for (var i = 0; i < labels.length; i++)
        _item(context, t, i, labels[i]),
    ];

    if (variant == SegTabsVariant.duo) {
      return Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 5),
            Expanded(child: items[i]),
          ],
        ],
      );
    }

    if (variant == SegTabsVariant.chip) {
      return Wrap(spacing: 5, runSpacing: 5, children: items);
    }

    return Container(
      key: const ValueKey('seg-tab-track'),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: t.surfaceInset,
        border: Border.all(color: t.line, width: StockCalRadii.hairline),
        borderRadius: BorderRadius.circular(StockCalRadii.card),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 2),
            items[i],
          ],
        ],
      ),
    );
  }

  Widget _item(
    BuildContext context,
    StockCalTokens t,
    int index,
    String label,
  ) {
    final active = index == selected;
    late final Color bg;
    late final Color fg;
    late final Color? border;

    switch (variant) {
      case SegTabsVariant.pill:
        bg = active ? t.surface : Colors.transparent;
        fg = active ? t.ink : t.muted;
        border = null;
      case SegTabsVariant.chip:
        bg = active ? t.accentSoft : t.surface;
        fg = active ? t.accent : t.muted;
        border = active ? t.accent : t.tileLine;
      case SegTabsVariant.duo:
        final isBuy = index == 0;
        bg = active
            ? (isBuy ? t.profitSoft : t.lossSoft)
            : t.surface;
        fg = active ? (isBuy ? t.profit : t.loss) : t.muted;
        border = active ? (isBuy ? t.profit : t.loss) : t.tileLine;
    }

    return GestureDetector(
      onTap: () => onSelected(index),
      child: Container(
        key: const ValueKey('seg-tab-item'),
        alignment: Alignment.center,
        constraints: variant == SegTabsVariant.pill
            ? const BoxConstraints(minWidth: 58)
            : const BoxConstraints(),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: bg,
          border: border == null
              ? null
              : Border.all(color: border, width: StockCalRadii.hairline),
          borderRadius: BorderRadius.circular(
            variant == SegTabsVariant.pill
                ? StockCalRadii.tile
                : StockCalRadii.chip,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: StockCalType.bodyLg,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: fg,
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/seg_tabs_test.dart && flutter analyze`
Expected: PASS，0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/seg_tabs.dart test/widgets/design/seg_tabs_test.dart
git commit -m "feat(design): add SegTabs with pill/chip/duo variants"
```

---

### Task 8: ScoreBar

**Files:**
- Create: `lib/widgets/design/score_bar.dart`
- Test: `test/widgets/design/score_bar_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`、`MonoText`
- Produces: `enum ScoreBarVariant { bar, gauge }`；`enum ScoreTone { accent, fall, amber, rise }`；`ScoreBar({required double value, ScoreBarVariant variant, ScoreTone tone, bool showValue})`

**原型行为**：
- `bar`（`.mode-score`）：一条渐变条，**宽度 = value%**（原型 DOM 用内联 `style="width:86%"`），右侧跟 mono 数字。渐变起点按 tone 取色，终点为该色的浅化。
- `gauge`（`.gauge-track`）：满宽 6px 三段渐变 `#53be98 → #e8e9ee 50% → #f26b78`，游标是一条 2px 的 ink 竖线，位于 value% 处。

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/score_bar_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/score_bar.dart';

Widget _wrap(Widget child, {double width = 300}) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

void main() {
  final t = StockCalTokens.light();

  testWidgets('bar：条宽为容器的 value%', (tester) async {
    await tester.pumpWidget(_wrap(
      const ScoreBar(value: 50, showValue: false),
      width: 200,
    ));
    final fill = tester.getSize(find.byKey(const ValueKey('score-bar-fill')));
    expect(fill.width, closeTo(100, 1));
  });

  testWidgets('bar：显示数值', (tester) async {
    await tester.pumpWidget(_wrap(const ScoreBar(value: 86)));
    expect(find.text('86'), findsOneWidget);
  });

  testWidgets('bar：tone 决定渐变起点色，取自 token', (tester) async {
    for (final (tone, expected) in [
      (ScoreTone.accent, t.accent),
      (ScoreTone.fall, t.fall),
      (ScoreTone.amber, t.amber),
      (ScoreTone.rise, t.rise),
    ]) {
      await tester.pumpWidget(_wrap(ScoreBar(value: 60, tone: tone)));
      final deco = tester
          .widget<Container>(find.byKey(const ValueKey('score-bar-fill')))
          .decoration! as BoxDecoration;
      expect((deco.gradient! as LinearGradient).colors.first, expected);
    }
  });

  testWidgets('gauge：游标位于 value%', (tester) async {
    await tester.pumpWidget(_wrap(
      const ScoreBar(value: 64, variant: ScoreBarVariant.gauge),
      width: 200,
    ));
    final marker =
        tester.getTopLeft(find.byKey(const ValueKey('score-gauge-marker')));
    final track =
        tester.getTopLeft(find.byKey(const ValueKey('score-gauge-track')));
    expect(marker.dx - track.dx, closeTo(128, 2));
  });

  testWidgets('value 超界被夹到 0..100', (tester) async {
    await tester.pumpWidget(_wrap(
      const ScoreBar(value: 150, showValue: false),
      width: 200,
    ));
    final fill = tester.getSize(find.byKey(const ValueKey('score-bar-fill')));
    expect(fill.width, closeTo(200, 1));

    await tester.pumpWidget(_wrap(
      const ScoreBar(value: -20, showValue: false),
      width: 200,
    ));
    final zero = tester.getSize(find.byKey(const ValueKey('score-bar-fill')));
    expect(zero.width, closeTo(0, 1));
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/score_bar_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/score_bar.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import 'mono_text.dart';

/// 打分条形态。
///
/// - [bar]：原型 `.mode-score`，条宽 = 分值百分比，右侧跟数字。
/// - [gauge]：原型 `.gauge-track`，满宽三段渐变 + 游标，用于方向强度。
enum ScoreBarVariant { bar, gauge }

/// 打分条色调。对应原型 `.mode-option` 的 rise / fall / amber 分档。
enum ScoreTone { accent, fall, amber, rise }

/// 打分条 / 强度仪表。
class ScoreBar extends StatelessWidget {
  const ScoreBar({
    super.key,
    required this.value,
    this.variant = ScoreBarVariant.bar,
    this.tone = ScoreTone.accent,
    this.showValue = true,
  });

  /// 0–100。超界自动夹取。
  final double value;
  final ScoreBarVariant variant;
  final ScoreTone tone;
  final bool showValue;

  double get _ratio => (value.clamp(0, 100)) / 100;

  Color _toneColor(StockCalTokens t) => switch (tone) {
        ScoreTone.accent => t.accent,
        ScoreTone.fall => t.fall,
        ScoreTone.amber => t.amber,
        ScoreTone.rise => t.rise,
      };

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    if (variant == ScoreBarVariant.gauge) return _gauge(t);
    return _bar(t);
  }

  Widget _bar(StockCalTokens t) {
    final base = _toneColor(t);
    final track = LayoutBuilder(
      builder: (context, c) => Align(
        alignment: Alignment.centerLeft,
        child: Container(
          key: const ValueKey('score-bar-fill'),
          width: c.maxWidth * _ratio,
          height: 4,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [base, Color.lerp(base, Colors.white, 0.62)!],
            ),
            borderRadius: BorderRadius.circular(99),
          ),
        ),
      ),
    );
    if (!showValue) return track;
    return Row(
      children: [
        Expanded(child: track),
        const SizedBox(width: 8),
        MonoText(
          value.clamp(0, 100).round().toString(),
          size: StockCalType.body,
          weight: FontWeight.w700,
          color: t.muted,
        ),
      ],
    );
  }

  Widget _gauge(StockCalTokens t) {
    return LayoutBuilder(
      builder: (context, c) => Stack(
        children: [
          Container(
            key: const ValueKey('score-gauge-track'),
            height: 6,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [t.fall, t.surfaceInset, t.rise],
                stops: const [0, 0.5, 1],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          Positioned(
            left: (c.maxWidth * _ratio - 1).clamp(0, c.maxWidth - 2),
            child: Container(
              key: const ValueKey('score-gauge-marker'),
              width: 2,
              height: 6,
              color: t.ink,
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/score_bar_test.dart && flutter analyze`
Expected: PASS，0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/score_bar.dart test/widgets/design/score_bar_test.dart
git commit -m "feat(design): add ScoreBar with bar and gauge variants"
```

---

### Task 9: SwitchPill + AppButton

**Files:**
- Create: `lib/widgets/design/switch_pill.dart`, `lib/widgets/design/app_button.dart`
- Test: `test/widgets/design/switch_pill_test.dart`, `test/widgets/design/app_button_test.dart`

**Interfaces:**
- Consumes: `StockCalTokens`
- Produces: `SwitchPill({required bool value, required ValueChanged<bool> onChanged, String? semanticLabel})`；`enum AppButtonVariant { primary, ghost }`；`AppButton({required String label, VoidCallback? onPressed, AppButtonVariant variant})`

- [ ] **Step 1: 写失败测试**

```dart
// test/widgets/design/switch_pill_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/switch_pill.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  final t = StockCalTokens.light();

  testWidgets('开启时轨道取 accent', (tester) async {
    await tester
        .pumpWidget(_wrap(SwitchPill(value: true, onChanged: (_) {})));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('switch-track')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.accent);
  });

  testWidgets('关闭时轨道取 tileLine', (tester) async {
    await tester
        .pumpWidget(_wrap(SwitchPill(value: false, onChanged: (_) {})));
    final deco = tester
        .widget<Container>(find.byKey(const ValueKey('switch-track')))
        .decoration! as BoxDecoration;
    expect(deco.color, t.tileLine);
  });

  testWidgets('钮位移 13px', (tester) async {
    await tester
        .pumpWidget(_wrap(SwitchPill(value: false, onChanged: (_) {})));
    final off =
        tester.getTopLeft(find.byKey(const ValueKey('switch-knob'))).dx;
    await tester.pumpWidget(_wrap(SwitchPill(value: true, onChanged: (_) {})));
    await tester.pumpAndSettle();
    final on = tester.getTopLeft(find.byKey(const ValueKey('switch-knob'))).dx;
    expect(on - off, closeTo(13, 0.5));
  });

  testWidgets('点击回调取反值', (tester) async {
    bool? got;
    await tester
        .pumpWidget(_wrap(SwitchPill(value: false, onChanged: (v) => got = v)));
    await tester.tap(find.byType(SwitchPill));
    await tester.pump();
    expect(got, isTrue);
  });
}
```

```dart
// test/widgets/design/app_button_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/design_tokens.dart';
import 'package:stockcal/widgets/design/app_button.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [StockCalTokens.light()]),
      home: Scaffold(body: Center(child: child)),
    );

BoxDecoration _deco(WidgetTester tester) => tester
    .widget<Container>(find.byKey(const ValueKey('app-button-box')))
    .decoration! as BoxDecoration;

void main() {
  final t = StockCalTokens.light();

  testWidgets('primary：accent 底、白字', (tester) async {
    await tester
        .pumpWidget(_wrap(AppButton(label: '保存交易记录', onPressed: () {})));
    expect(_deco(tester).color, t.accent);
    expect(tester.widget<Text>(find.text('保存交易记录')).style!.color,
        Colors.white);
  });

  testWidgets('ghost：surface 底、line 边、muted 字', (tester) async {
    await tester.pumpWidget(_wrap(AppButton(
      label: '恢复全部调整',
      onPressed: () {},
      variant: AppButtonVariant.ghost,
    )));
    expect(_deco(tester).color, t.surface);
    expect(_deco(tester).border!.top.color, t.line);
    expect(tester.widget<Text>(find.text('恢复全部调整')).style!.color, t.muted);
  });

  testWidgets('最小高度 36', (tester) async {
    await tester.pumpWidget(_wrap(AppButton(label: 'x', onPressed: () {})));
    expect(tester.getSize(find.byKey(const ValueKey('app-button-box'))).height,
        greaterThanOrEqualTo(36));
  });

  testWidgets('onPressed 为 null 时不触发且降透明度', (tester) async {
    await tester.pumpWidget(_wrap(const AppButton(label: '停用')));
    await tester.tap(find.text('停用'));
    await tester.pump();
    final opacity =
        tester.widget<Opacity>(find.byKey(const ValueKey('app-button-op')));
    expect(opacity.opacity, 0.45);
  });

  testWidgets('点击触发回调', (tester) async {
    var n = 0;
    await tester.pumpWidget(_wrap(AppButton(label: '点我', onPressed: () => n++)));
    await tester.tap(find.text('点我'));
    await tester.pump();
    expect(n, 1);
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/widgets/design/switch_pill_test.dart test/widgets/design/app_button_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 实现**

```dart
// lib/widgets/design/switch_pill.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 小开关。还原原型 `.switch`（轨 30×17，钮 11，位移 13）。
class SwitchPill extends StatelessWidget {
  const SwitchPill({
    super.key,
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool> onChanged;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Semantics(
      label: semanticLabel,
      toggled: value,
      button: true,
      child: GestureDetector(
        onTap: () => onChanged(!value),
        child: Container(
          key: const ValueKey('switch-track'),
          width: 30,
          height: 17,
          decoration: BoxDecoration(
            color: value ? t.accent : t.tileLine,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Stack(
            children: [
              AnimatedPositioned(
                duration: const Duration(milliseconds: 150),
                left: value ? 16 : 3,
                top: 3,
                child: Container(
                  key: const ValueKey('switch-knob'),
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    color: t.surface,
                    shape: BoxShape.circle,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x381F2B44),
                        blurRadius: 3,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

> 注：`switch_pill.dart` 中的 `Color(0x381F2B44)` 是**阴影**而非配色 token，属 Global Constraints 中「颜色字面量只许出现在 design_tokens.dart」的例外。为保持约束可机检，将该阴影提到 token：在 Task 1 的 `StockCalTokens` 中已有 `panelShadow`，此处改用 `t.panelShadow` 即可，**不要**保留字面量。实现时请写成 `boxShadow: t.panelShadow`。

```dart
// lib/widgets/design/app_button.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 按钮变体。还原原型 `.button.primary` / `.button.ghost`。
enum AppButtonVariant { primary, ghost }

/// 按钮。
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final primary = variant == AppButtonVariant.primary;
    final enabled = onPressed != null;

    return Opacity(
      key: const ValueKey('app-button-op'),
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          key: const ValueKey('app-button-box'),
          constraints: const BoxConstraints(minHeight: 36),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: primary ? t.accent : t.surface,
            border: primary
                ? null
                : Border.all(color: t.line, width: StockCalRadii.hairline),
            borderRadius: BorderRadius.circular(StockCalRadii.button),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: StockCalType.body,
              fontWeight: FontWeight.w700,
              color: primary ? Colors.white : t.muted,
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `flutter test test/widgets/design/ && flutter analyze`
Expected: PASS，0 issue

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/design/switch_pill.dart lib/widgets/design/app_button.dart \
        test/widgets/design/switch_pill_test.dart test/widgets/design/app_button_test.dart
git commit -m "feat(design): add SwitchPill and AppButton"
```

---

### Task 10: barrel 导出 + 组件画廊

**Files:**
- Create: `lib/widgets/design.dart`, `lib/features/dev/design_gallery_screen.dart`
- Test: `test/features/dev/design_gallery_screen_test.dart`
- Modify: `lib/features/admin/settings_admin_workspace.dart`（仅加入口）

**Interfaces:**
- Consumes: 全部十个组件
- Produces: `package:stockcal/widgets/design.dart` barrel；`DesignGalleryScreen()`

- [ ] **Step 1: 写失败测试**

```dart
// test/features/dev/design_gallery_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/dev/design_gallery_screen.dart';
import 'package:stockcal/theme/stockcal_theme.dart';
import 'package:stockcal/widgets/design.dart';

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets('画廊在 $brightness 下渲染全部组件且不溢出', (tester) async {
      tester.view.physicalSize = const Size(1400, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(MaterialApp(
        theme: buildStockCalTheme(brightness),
        home: const DesignGalleryScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(SectionHeading), findsWidgets);
      expect(find.byType(PanelCard), findsWidgets);
      expect(find.byType(MetricStrip), findsWidgets);
      expect(find.byType(LedgerTable), findsWidgets);
      expect(find.byType(SegTabs), findsWidgets);
      expect(find.byType(ScoreBar), findsWidgets);
      expect(find.byType(StatusBadge), findsWidgets);
      expect(find.byType(SwitchPill), findsWidgets);
      expect(find.byType(AppButton), findsWidgets);
      expect(find.byType(MonoText), findsWidgets);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('画廊里的开关与分段可交互', (tester) async {
    tester.view.physicalSize = const Size(1400, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.light),
      home: const DesignGalleryScreen(),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(SwitchPill).first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
```

- [ ] **Step 2: 运行确认失败**

Run: `flutter test test/features/dev/design_gallery_screen_test.dart`
Expected: FAIL —— URI 不存在

- [ ] **Step 3: 写 barrel**

```dart
// lib/widgets/design.dart
export 'design/app_button.dart';
export 'design/ledger_table.dart';
export 'design/metric_strip.dart';
export 'design/mono_text.dart';
export 'design/panel_card.dart';
export 'design/score_bar.dart';
export 'design/section_heading.dart';
export 'design/seg_tabs.dart';
export 'design/status_badge.dart';
export 'design/switch_pill.dart';
```

- [ ] **Step 4: 写画廊**

`DesignGalleryScreen` 为 `StatefulWidget`（分段与开关需要本地状态）。逐组件分节展示，每节用 `SectionHeading` 起头。窄/宽两种约束下的 `MetricStrip` 各展示一次。

```dart
// lib/features/dev/design_gallery_screen.dart
import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';
import '../../widgets/design.dart';

/// 组件画廊。仅供开发期对照原型核对还原度，不进主导航。
class DesignGalleryScreen extends StatefulWidget {
  const DesignGalleryScreen({super.key});

  @override
  State<DesignGalleryScreen> createState() => _DesignGalleryScreenState();
}

class _DesignGalleryScreenState extends State<DesignGalleryScreen> {
  int _cycle = 0;
  int _period = 0;
  int _side = 0;
  bool _switchA = true;
  bool _switchB = false;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('组件画廊')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '指标条',
            trailing: StatusBadge('MetricStrip'),
          ),
          const MetricStrip(cells: [
            MetricCell(label: '持仓股票', value: '3', unit: '只'),
            MetricCell(label: '总投入', value: '78570.00', unit: '元'),
            MetricCell(label: '当前市值', value: '79916.00', unit: '元'),
            MetricCell(
                label: '总浮动盈亏',
                value: '+1346.00',
                unit: '元',
                tone: MetricTone.profit),
            MetricCell(label: '已实现盈亏', value: '+84.00', unit: '元'),
            MetricCell(
                label: '组合收益率',
                value: '+1.82%',
                unit: '浮动 + 已实现',
                tone: MetricTone.profit),
          ]),
          const SizedBox(height: 12),
          Text('窄约束（塌为 2 列，末格跨满）',
              style: TextStyle(fontSize: StockCalType.eyebrow, color: t.faint)),
          const SizedBox(height: 6),
          SizedBox(
            width: 380,
            child: const MetricStrip(
              columns: 5,
              cells: [
                MetricCell(label: '累计盈亏', value: '+552.00', unit: '元'),
                MetricCell(label: '盈利天数', value: '4 / 5', unit: '交易日'),
                MetricCell(label: '交易次数', value: '12', unit: '买卖合计'),
                MetricCell(label: '平均单笔', value: '46.00', unit: '元'),
                MetricCell(
                    label: '执行偏差',
                    value: '16.7%',
                    unit: '未按计划',
                    tone: MetricTone.risk),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '账本表格',
            trailing: StatusBadge('LedgerTable'),
          ),
          LedgerTable(
            columns: const [
              LedgerColumn('股票', 12),
              LedgerColumn('持仓/成本', 10),
              LedgerColumn('浮动盈亏', 9),
              LedgerColumn('', 9),
            ],
            rows: [
              LedgerRow(
                onTap: () {},
                cells: [
                  const Text('华芯动力'),
                  const MonoText('1500 股'),
                  MonoText('+1170.00', color: t.profit),
                  Text('查看详情 →',
                      style: TextStyle(
                          fontSize: StockCalType.eyebrow, color: t.accent)),
                ],
              ),
              LedgerRow(
                onTap: () {},
                cells: [
                  const Text('新能材料'),
                  const MonoText('600 股'),
                  MonoText('-288.00', color: t.loss),
                  Text('查看详情 →',
                      style: TextStyle(
                          fontSize: StockCalType.eyebrow, color: t.accent)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '分段切换',
            trailing: StatusBadge('SegTabs'),
          ),
          PanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('pill · 操作周期',
                    style: TextStyle(
                        fontSize: StockCalType.eyebrow, color: t.faint)),
                const SizedBox(height: 6),
                SegTabs(
                  labels: const ['短线', '波段', '中长线'],
                  selected: _cycle,
                  onSelected: (i) => setState(() => _cycle = i),
                ),
                const SizedBox(height: 16),
                Text('chip · K线周期',
                    style: TextStyle(
                        fontSize: StockCalType.eyebrow, color: t.faint)),
                const SizedBox(height: 6),
                SegTabs(
                  labels: const ['日线', '周线', '月线'],
                  selected: _period,
                  variant: SegTabsVariant.chip,
                  onSelected: (i) => setState(() => _period = i),
                ),
                const SizedBox(height: 16),
                Text('duo · 交易方向',
                    style: TextStyle(
                        fontSize: StockCalType.eyebrow, color: t.faint)),
                const SizedBox(height: 6),
                SizedBox(
                  width: 260,
                  child: SegTabs(
                    labels: const ['买入', '卖出'],
                    selected: _side,
                    variant: SegTabsVariant.duo,
                    onSelected: (i) => setState(() => _side = i),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '打分条与强度仪表',
            trailing: StatusBadge('ScoreBar'),
          ),
          PanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (label, v, tone) in [
                  ('主策略', 86.0, ScoreTone.accent),
                  ('备选', 74.0, ScoreTone.accent),
                  ('风控', 61.0, ScoreTone.amber),
                  ('警戒', 39.0, ScoreTone.fall),
                ]) ...[
                  Text(label,
                      style: TextStyle(
                          fontSize: StockCalType.eyebrow, color: t.faint)),
                  const SizedBox(height: 4),
                  ScoreBar(value: v, tone: tone),
                  const SizedBox(height: 12),
                ],
                const SizedBox(height: 4),
                Text('gauge · 方向强度 64/100',
                    style: TextStyle(
                        fontSize: StockCalType.eyebrow, color: t.faint)),
                const SizedBox(height: 8),
                const ScoreBar(value: 64, variant: ScoreBarVariant.gauge),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '徽章',
            trailing: StatusBadge('StatusBadge'),
          ),
          const Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge('演示数据'),
              StatusBadge('DEMO', tone: BadgeTone.amber),
              StatusBadge('R-07', tone: BadgeTone.amber, mono: true),
              StatusBadge('上涨关键区', tone: BadgeTone.rise),
              StatusBadge('下跌支撑区', tone: BadgeTone.fall),
              StatusBadge('买入', tone: BadgeTone.profit),
              StatusBadge('卖出', tone: BadgeTone.loss),
              StatusBadge('一致', tone: BadgeTone.fall, dot: true),
              StatusBadge('待复盘', tone: BadgeTone.accent),
            ],
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '开关与按钮',
            trailing: StatusBadge('SwitchPill / AppButton'),
          ),
          PanelCard(
            child: Row(
              children: [
                SwitchPill(
                  value: _switchA,
                  semanticLabel: '停用规则 R-07',
                  onChanged: (v) => setState(() => _switchA = v),
                ),
                const SizedBox(width: 16),
                SwitchPill(
                  value: _switchB,
                  semanticLabel: '停用规则 R-03',
                  onChanged: (v) => setState(() => _switchB = v),
                ),
                const SizedBox(width: 24),
                AppButton(label: '保存交易记录', onPressed: () {}),
                const SizedBox(width: 8),
                AppButton(
                  label: '恢复全部调整',
                  variant: AppButtonVariant.ghost,
                  onPressed: () {},
                ),
                const SizedBox(width: 8),
                const AppButton(label: '已停用'),
              ],
            ),
          ),
          const SizedBox(height: 32),

          const SectionHeading(
            eyebrow: '设计系统 · Phase 0',
            title: '等宽数字',
            trailing: StatusBadge('MonoText'),
          ),
          PanelCard(
            child: Row(
              children: [
                const MonoText('32.68', size: StockCalType.metricLg),
                const SizedBox(width: 16),
                MonoText('+0.86', color: t.rise),
                const SizedBox(width: 16),
                MonoText('-288.00', color: t.loss),
                const SizedBox(width: 16),
                MonoText('11111.11', color: t.muted),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `flutter test test/features/dev/design_gallery_screen_test.dart && flutter analyze`
Expected: PASS，0 issue

若渲染溢出（`takeException` 非空），修画廊的布局约束，**不要**改组件实现。

- [ ] **Step 6: 加设置入口**

在 `lib/features/admin/settings_admin_workspace.dart` 中现有设置项列表里追加一项，跳转 `DesignGalleryScreen`。先读该文件确认既有列表项的写法，照其惯例插入，形如：

```dart
ListTile(
  leading: const Icon(Icons.palette_outlined),
  title: const Text('组件画廊'),
  subtitle: const Text('开发期对照原型核对组件还原度'),
  onTap: () => Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const DesignGalleryScreen()),
  ),
),
```

- [ ] **Step 7: 运行全量测试**

Run: `flutter test && flutter analyze`
Expected: 全绿，0 issue

- [ ] **Step 8: 提交**

```bash
git add lib/widgets/design.dart lib/features/dev/design_gallery_screen.dart \
        lib/features/admin/settings_admin_workspace.dart \
        test/features/dev/design_gallery_screen_test.dart
git commit -m "feat(design): add barrel export and dev component gallery"
```

---

### Task 11: 验收与推送

**Files:** 无新增；仅验证与文档更新

- [ ] **Step 1: 机检「组件不含颜色字面量」**

```bash
grep -n '0x[Ff][Ff]' lib/widgets/design/*.dart lib/widgets/design.dart lib/features/dev/design_gallery_screen.dart
```

Expected: 无输出。有输出即为缺陷——把该颜色提到 `design_tokens.dart` 再引用。

- [ ] **Step 2: 全量测试与静态分析**

```bash
flutter test
flutter analyze
```

Expected: 测试全绿（原 179 + 本期新增）；analyze 0 issue。

**若有既有测试失败**：区分两类。断言旧青色取值的 → 更新断言。断言布局或行为的 → 说明改坏了，修实现。**不得**为让测试通过而删除或跳过测试。

- [ ] **Step 3: Web 构建冒烟**

```bash
flutter build web --release
```

Expected: 构建成功。

- [ ] **Step 4: 更新验收记录**

在 `docs/handoff/2026-08-14-stockcal-current-status.md` 末尾追加本次实际运行结果（测试数、analyze 结果、构建结果），标注日期 2026-08-24。数字以本次实际输出为准。

- [ ] **Step 5: 提交并推送**

```bash
git add docs/handoff/2026-08-14-stockcal-current-status.md
git commit -m "docs: record design-system phase 0 verification results"
git push -u origin agent/local-first-watchlist
```

---

## Self-Review

**1. Spec coverage**

| Spec 章节 | 覆盖 task |
|---|---|
| 一、Token 层（颜色 / 形 / 字号阶 / 深色） | Task 1 |
| 二、组件库 10 个 | Task 3–9 |
| 二、响应式（MetricStrip / LedgerTable） | Task 5、Task 6 |
| 三、`StockCalColors` 兼容层 | Task 2 |
| 三、`display.dart` 语义不变 + 新增两函数 | Task 2 |
| 三、`stockcal_theme.dart` 从 token 推导 | Task 2 |
| 四、组件画廊 + 设置入口 | Task 10 |
| 五、Token 契约测试 | Task 1 |
| 五、组件测试（取色断言写法） | Task 3–9 各自 Step 1 |
| 五、既有两测试更新 | Task 2 |
| 六、验收四项 | Task 11 |

无遗漏。

**2. 与 spec 的两处偏差，已在计划内处理**

- spec 的文件清单写 `lib/widgets/design/badge.dart`，实际须为 `status_badge.dart`（`Badge` 与 `material.Badge` 冲突）。已在 Global Constraints 与 Task 3 注明。
- spec 未列 `MetricTile` / `LedgerColumn` / `LedgerRow` 等公开辅助类型，属实现细节，已在各 task 的 Interfaces 块给出确切签名。

**3. 类型一致性**

`StockCalTokens.of` / `StockCalRadii.hairline` / `StockCalType.eyebrowSpacing` / `MetricTone` / `BadgeTone` / `SegTabsVariant` / `ScoreTone` / `ScoreBarVariant` / `AppButtonVariant` 在定义处与使用处名称一致，已逐一核对。`SwitchPill` 实现中原写有字面量阴影，已在 Task 9 Step 3 明确要求改用 `t.panelShadow`，与 Task 11 Step 1 的机检一致。
