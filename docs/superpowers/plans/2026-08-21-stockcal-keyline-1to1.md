# StockCal 参考站 KEYLINE 全站 1:1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 StockCal 改造成与参考站 KEYLINE 一致的深色金融终端：左导航 rail + 顶栏搜索 + `⌘K` 命令面板，核心「关键位分析」页像素级 1:1，其余页面映射到现有功能并套统一 shell。

**Architecture:** 先扩展分析数据模型（振幅/ATR/参数快照/规则分档/条件勾选/可信度/模型名 + `RuleBook` 注入算命中数），再在现有页面上完成「关键位分析」与「组合总览」1:1，随后落地 4 个新独立页（盈利模式/未来指标/预测记录/统计图表），最后引入导航 shell（`NavDestination` + `AppShell` + `CommandPalette`）重接全部目的地并适配既有导航测试。每步 TDD，Flutter widget 测试驱动。

**Tech Stack:** Flutter 3.44 (Material 3), Dart, flutter_test；后端已部署不动。

**Spec:** `docs/superpowers/specs/2026-08-21-stockcal-keyline-1to1.md`

## Global Constraints

- 主题（`lib/theme/stockcal_theme.dart` 的 `StockCalColors`）保持不变：深色 bg `#0B1220`、primary 薄荷青 `#47D7C7`、gain 红 `#F23645`、loss 绿 `#089981`；浅色主题保留。
- A 股约定：红涨绿跌（gain=红，loss=绿），颜色不单独承载语义（配文字/符号）。用 `gainColor(context)` / `lossColor(context)` / `pnlColor(context, value)`（`lib/core/display.dart`）。
- 数字用 `withTabular`（`lib/core/display.dart`）。
- 每屏只留一个主行动；空状态用 `EmptyState`；错误用 `ErrorState`；加载用骨架屏 `Skeleton`，不用 `CircularProgressIndicator`（测试中允许）。
- 现有 59 个测试文件保持全绿；导航重构涉及的 `product_surface_test.dart`、`navigation/mobile_navigation_test.dart`、`home_screen_test.dart` 等同步适配。
- 导航目的地命名**完全照参考站**：组合总览 / 关键位分析 / 盈利模式 / 未来指标 / 预测记录 / 交易与盈亏 / 统计图表 / 当日复盘 / AI策略 / 经验规则。
- 登录门控不变，不引入演示模式。
- 提交信息结尾带 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

### Task 1: 分析数据模型扩展

**Files:**
- Modify: `lib/features/analysis/technical_analysis.dart`
- Test: `test/features/analysis/technical_analysis_test.dart`

**Interfaces:**
- Consumes: `Candle`（`lib/domain/stockcal_domain.dart`）、`RuleBook`/`RuleVersion`/`RuleFacts`（`lib/features/rules/rule_engine.dart`）。
- Produces:
  - `enum RuleBand { primary, alternate, risk, caution }`
  - `class ParameterItem { final String label; final double value; final String unit; }`（含 `const` 构造）
  - `class ConditionCheck { final String label; final bool met; }`（含 `const` 构造）
  - `MatchedRule` 增加字段 `final RuleBand band;`（构造器保留 `required this.name, required this.score`，新增 `required this.band`）
  - `StockAnalysis` 增加字段：`amplitude`（double）、`atr`（double）、`parameters`（`List<ParameterItem>`）、`ruleHitCount`（int）、`ruleTotalCount`（int）、`conditions`（`List<ConditionCheck>`）、`ruleCredibility`（double）、`modelName`（String）
  - `StockAnalyzer` 构造器增加可选 `RuleBook? ruleBook`
  - `IndicatorCalculator` 增加 `double atr(List<Candle>, {required int period})`

- [ ] **Step 1: 写失败测试**

在 `test/features/analysis/technical_analysis_test.dart` 追加（复用文件顶部已有的 `Candle` 与 `StockAnalyzer` 构造方式；若无现成 K 线工厂，用 30 根递增 K 线）：

```dart
test('analyze exposes amplitude, atr and parameter snapshot', () {
  final analyzer = StockAnalyzer();
  final candles = List.generate(30, (i) {
    final close = 10.0 + i * 0.1;
    return Candle(
      day: DateTime(2026, 1, 1).add(Duration(days: i)),
      open: close - 0.05,
      high: close + 0.3,
      low: close - 0.3,
      close: close,
      volume: 1000,
    );
  });
  final analysis = analyzer.analyze(candles);
  expect(analysis.amplitude, greaterThan(0));
  expect(analysis.atr, greaterThan(0));
  expect(analysis.parameters, isNotEmpty);
  expect(analysis.parameters.every((p) => p.label.isNotEmpty), isTrue);
  expect(analysis.modelName, isNotEmpty);
  expect(analysis.conditions.length, 3);
});

test('matched rules carry a band and hit counts fall back to heuristics', () {
  final analyzer = StockAnalyzer();
  final candles = List.generate(30, (i) {
    final close = 10.0 + i * 0.1;
    return Candle(
      day: DateTime(2026, 1, 1).add(Duration(days: i)),
      open: close - 0.05, high: close + 0.3, low: close - 0.3,
      close: close, volume: 1000 + i * 10,
    );
  });
  final analysis = analyzer.analyze(candles);
  expect(analysis.matchedRules, isNotEmpty);
  expect(analysis.matchedRules.first.band, isNotNull);
  expect(analysis.ruleTotalCount, greaterThanOrEqualTo(analysis.ruleHitCount));
});

test('analyzer uses RuleBook for hit counts when provided', () {
  final book = RuleBook.withSystemDefaults();
  final analyzer = StockAnalyzer(ruleBook: book);
  final candles = List.generate(30, (i) {
    final close = 20.0 + i * 0.5; // 上行趋势 → 命中趋势/成交量规则
    return Candle(
      day: DateTime(2026, 1, 1).add(Duration(days: i)),
      open: close - 0.1, high: close + 0.4, low: close - 0.4,
      close: close, volume: 2000 + i * 20,
    );
  });
  final analysis = analyzer.analyze(candles);
  expect(analysis.ruleTotalCount, book.activeRules.length);
  expect(analysis.ruleHitCount, greaterThan(0));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/analysis/technical_analysis_test.dart`
Expected: FAIL（`amplitude`/`atr`/`parameters`/`band`/`ruleBook` 等不存在，编译失败）

- [ ] **Step 3: 实现模型扩展**

在 `technical_analysis.dart` 顶部（`IndicatorSettings` 之前）新增值对象与枚举：

```dart
enum RuleBand { primary, alternate, risk, caution }

class ParameterItem {
  const ParameterItem({required this.label, required this.value, required this.unit});
  final String label;
  final double value;
  final String unit;
}

class ConditionCheck {
  const ConditionCheck({required this.label, required this.met});
  final String label;
  final bool met;
}
```

给 `MatchedRule` 增加 `band`：

```dart
class MatchedRule {
  const MatchedRule({required this.name, required this.score, required this.band});
  final String name;
  final int score;
  final RuleBand band;
}
```

给 `IndicatorCalculator` 增加 `atr`（放在 `volume` 方法之后）：

```dart
double atr(List<Candle> candles, {required int period}) {
  _validatePeriod(period);
  if (candles.length < period + 1) {
    throw AnalysisException('计算 ATR$period 至少需要 ${period + 1} 根 K 线');
  }
  var sum = 0.0;
  for (var i = 1; i <= period; i++) {
    final c = candles[i];
    final tr = math.max(
      c.high - c.low,
      math.max(
        (c.high - candles[i - 1].close).abs(),
        (c.low - candles[i - 1].close).abs(),
      ),
    );
    sum += tr;
  }
  return sum / period;
}
```

给 `StockAnalysis` 增加字段（构造器参数 + final 字段，`required` 顺序与下方构造调用一致）：

```dart
final double amplitude;
final double atr;
final List<ParameterItem> parameters;
final int ruleHitCount;
final int ruleTotalCount;
final List<ConditionCheck> conditions;
final double ruleCredibility;
final String modelName;
```

给 `StockAnalyzer` 增加构造参数与字段：

```dart
StockAnalyzer({
  IndicatorCalculator? calculator,
  this.settings = const IndicatorSettings(),
  this.ruleBook,
}) : _calculator = calculator ?? IndicatorCalculator();

final RuleBook? ruleBook;
```

在 `analyze` 方法内（`matchedRules` 计算之前）补充：ATR、振幅、昨日收盘、参数快照、条件、可信度、命中数。把现有 `matchedRules` 每项包上 `band`：

```dart
final prevClose = candles.length > 1 ? candles[candles.length - 2].close : lastClose;
final amplitude = prevClose == 0 ? 0 : (candles.last.high - candles.last.low) / prevClose * 100;
final atr = _calculator.atr(candles, period: 14);
```

把 `matchedRules` 的每个 `MatchedRule(name: ..., score: X)` 改为 `MatchedRule(name: ..., score: X, band: _band(X))`，并新增静态函数：

```dart
static RuleBand _band(int score) => score >= 80
    ? RuleBand.primary
    : score >= 70
    ? RuleBand.alternate
    : score >= 60
    ? RuleBand.risk
    : RuleBand.caution;
```

计算命中数（放在 `return StockAnalysis(...)` 之前）：

```dart
var hit = 0;
var total = matchedRules.length;
if (ruleBook != null) {
  final facts = RuleFacts(
    closeAboveMa20: trendPositive,
    volumeRatio: volumeRatio,
    supportDistance: lastClose == 0 ? 1 : (lastClose - support) / lastClose,
  );
  total = ruleBook!.activeRules.length;
  hit = ruleBook!.activeRules.where((r) => ruleBook!.evaluate(r, facts)).length;
}
```

在 `return StockAnalysis(...)` 中补字段：

```dart
amplitude: amplitude,
atr: atr,
parameters: [
  ParameterItem(label: 'MA${settings.maShortPeriod}', value: maShort, unit: ''),
  ParameterItem(label: 'MA${settings.maLongPeriod}', value: maLong, unit: ''),
  ParameterItem(label: 'EMA${settings.emaPeriod}', value: ema, unit: ''),
  ParameterItem(label: 'BOLL 上轨', value: boll.upper, unit: ''),
  ParameterItem(label: 'BOLL 中轨', value: boll.middle, unit: ''),
  ParameterItem(label: 'BOLL 下轨', value: boll.lower, unit: ''),
  ParameterItem(label: 'ATR', value: atr, unit: ''),
  ParameterItem(label: '振幅', value: amplitude, unit: '%'),
  ParameterItem(label: '量比', value: volumeRatio, unit: ''),
  ParameterItem(label: '昨收', value: prevClose, unit: ''),
  ParameterItem(label: '今开', value: candles.last.open, unit: ''),
  ParameterItem(label: '最高', value: candles.last.high, unit: ''),
],
ruleHitCount: hit,
ruleTotalCount: total,
conditions: [
  ConditionCheck(label: 'MA${settings.maShortPeriod} 上移', met: maShort >= maLong),
  ConditionCheck(label: 'BOLL 抬升', met: lastClose >= boll.middle),
  ConditionCheck(label: '振幅达标', met: amplitude >= 3),
],
ruleCredibility: (0.4 + hit / (total == 0 ? 1 : total) * 0.5).clamp(0.4, 0.9) * 100,
modelName: 'GPT-5 轻量分类模型',
```

（`matchedRules` 中仍引用 `nearSupport`/`trendPositive` 等既有变量，保持不变。）

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/analysis/technical_analysis_test.dart`
Expected: PASS（新增 3 个用例通过；既有 `technical_analysis_test` 若断言 `MatchedRule` 构造签名，同步补 `band:`）

- [ ] **Step 5: 提交**

```bash
git add lib/features/analysis/technical_analysis.dart test/features/analysis/technical_analysis_test.dart
git commit -m "feat: extend analysis model with amplitude/ATR/params/rule-bands/conditions"
```

---

### Task 2: 关键位分析 1:1（仪表盘 + 分档 + 条件 + 模型详情）

**Files:**
- Create: `lib/features/analysis/direction_gauge.dart`
- Modify: `lib/features/analysis/stock_analysis_screen.dart`
- Test: `test/features/analysis/direction_gauge_test.dart`、`test/features/analysis/stock_analysis_screen_test.dart`

**Interfaces:**
- Consumes: `StockAnalysis`（Task 1 扩展后）、`gainColor/lossColor/withTabular`（`lib/core/display.dart`）。
- Produces:
  - `DirectionGauge({required double strength, required Direction direction})`
  - `String ruleBandLabel(RuleBand)` / `String ruleBandHint(RuleBand)`（返回「主策略/备选/风控/警戒」与参考站括号内提示词）

- [ ] **Step 1: 写失败测试（仪表盘）**

创建 `test/features/analysis/direction_gauge_test.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/analysis/direction_gauge.dart';
import 'package:stockcal/features/analysis/technical_analysis.dart';

void main() {
  testWidgets('DirectionGauge renders strength and direction label', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: DirectionGauge(strength: 64, direction: Direction.bullish),
      ),
    ));
    expect(find.text('64/100'), findsOneWidget);
    expect(find.text('多头'), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);
  });

  testWidgets('DirectionGauge renders bearish label', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: DirectionGauge(strength: 30, direction: Direction.bearish),
      ),
    ));
    expect(find.text('空头'), findsOneWidget);
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/analysis/direction_gauge_test.dart`
Expected: FAIL（`direction_gauge.dart` 不存在）

- [ ] **Step 3: 实现 `DirectionGauge`**

创建 `lib/features/analysis/direction_gauge.dart`：

```dart
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/display.dart';
import 'technical_analysis.dart';

class DirectionGauge extends StatelessWidget {
  const DirectionGauge({super.key, required this.strength, required this.direction});

  final double strength;
  final Direction direction;

  @override
  Widget build(BuildContext context) {
    final color = switch (direction) {
      Direction.bullish => gainColor(context),
      Direction.neutral => Theme.of(context).colorScheme.onSurfaceVariant,
      Direction.bearish => lossColor(context),
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 120,
          width: 240,
          child: CustomPaint(
            painter: _GaugePainter(
              value: strength,
              color: color,
              track: Theme.of(context).colorScheme.surfaceHigh,
            ),
          ),
        ),
        Text(
          '${strength.round()}/100',
          style: withTabular(
            Theme.of(context).textTheme.titleLarge?.copyWith(color: color),
          ),
        ),
        Text(_label(direction), style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  static String _label(Direction direction) => switch (direction) {
    Direction.bullish => '多头',
    Direction.neutral => '中性',
    Direction.bearish => '空头',
  };
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.value, required this.color, required this.track});

  final double value;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.85);
    final radius = size.width * 0.42;
    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = track
      ..strokeCap = StrokeCap.round;
    final valuePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..color = color
      ..strokeCap = StrokeCap.round;
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawArc(rect, math.pi, math.pi, false, trackPaint);
    final sweep = math.pi * (value / 100).clamp(0.0, 1.0);
    canvas.drawArc(rect, math.pi, sweep, false, valuePaint);
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.value != value || old.color != color || old.track != track;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/analysis/direction_gauge_test.dart`
Expected: PASS

- [ ] **Step 5: 改 `stock_analysis_screen.dart`**

导入 `direction_gauge.dart`。在 `_AnalysisContent.build` 中做四处替换：

**(a) 方向强度换半圆仪表**：把现有 `Row(children: [Icon(_directionIcon...), ...LinearProgressIndicator...])` 整块替换为：

```dart
Center(
  child: DirectionGauge(
    strength: analysis.directionStrength,
    direction: analysis.direction,
  ),
),
```

**(b) 策略列表加分档徽标**：在 `_AnalysisContent` 顶部加静态函数 `_bandLabel`/`_bandColor`，并把「盈利模式识别」区的 `ListTile` 改为带徽标：

```dart
String _bandLabel(RuleBand band) => switch (band) {
  RuleBand.primary => '主策略',
  RuleBand.alternate => '备选',
  RuleBand.risk => '风控',
  RuleBand.caution => '警戒',
};
```

`matchedRules` 的 `ListTile` 的 `title` 改为 `Row`：

```dart
title: Row(
  children: [
    Chip(
      label: Text(_bandLabel(rule.band)),
      visualDensity: VisualDensity.compact,
      side: BorderSide.none,
    ),
    const SizedBox(width: 8),
    Expanded(child: Text(rule.name)),
  ],
),
```

并在「盈利模式识别」标题下方加摘要行：

```dart
Row(
  children: [
    Text('今日参数 ${analysis.parameters.length} 项 · 振幅 ${analysis.amplitude.toStringAsFixed(2)}%', style: Theme.of(context).textTheme.bodySmall),
    const Spacer(),
    Text('规则命中 ${analysis.ruleHitCount}/${analysis.ruleTotalCount}', style: withTabular(Theme.of(context).textTheme.bodySmall)),
  ],
),
```

**(c) 主策略详情加条件勾选**：在现有「策略建议」Card 的 `_PlanRow` 之后追加：

```dart
const SizedBox(height: 8),
...analysis.conditions.map(
  (c) => Row(
    children: [
      Icon(c.met ? Icons.check_circle : Icons.circle_outlined,
          size: 18, color: c.met ? Theme.of(context).colorScheme.primary : null),
      const SizedBox(width: 8),
      Text(c.label, style: Theme.of(context).textTheme.bodyMedium),
    ],
  ),
),
```

**(d) 模型编排详情**：在 `_PipelineCard` 的 `_Stage` 行下方追加结论区（在 `_PipelineCard.build` 的 `Column` 末尾、`Row(...)` 之后）：

```dart
const SizedBox(height: 12),
Text('策略结论：${analysis.direction == Direction.bullish ? '偏多，关注买入区间' : analysis.direction == Direction.bearish ? '偏空，注意失效条件' : '中性，等待方向确认'}', style: Theme.of(context).textTheme.bodyMedium),
const SizedBox(height: 4),
Text('解释依据：命中 ${analysis.ruleHitCount}/${analysis.ruleTotalCount} 条规则，置信 ${(analysis.confidence * 100).round()}%', style: Theme.of(context).textTheme.bodySmall),
const SizedBox(height: 4),
Text('待确认经验：复核目标位与失效条件', style: Theme.of(context).textTheme.bodySmall),
const SizedBox(height: 12),
Wrap(
  spacing: 8,
  runSpacing: 8,
  children: [
    Chip(label: Text('策略匹配度 ${(analysis.confidence * 100).round()}')),
    Chip(label: Text('规则可信度 ${analysis.ruleCredibility.round()}')),
    Chip(label: Text('风险等级 ${_riskLabel(analysis.riskLevel)}')),
  ],
),
const SizedBox(height: 8),
Text('当前模型：${analysis.modelName}', style: Theme.of(context).textTheme.labelSmall),
```

（`_riskLabel` 已在文件中存在，直接复用。）

- [ ] **Step 6: 跑分析页测试确认无回归**

Run: `flutter test test/features/analysis/`
Expected: PASS（若 `stock_analysis_screen_test.dart` 断言旧的方向强度 `LinearProgressIndicator` 或旧文案，同步改为断言 `DirectionGauge` / 新文案）

- [ ] **Step 7: 提交**

```bash
git add lib/features/analysis/
git commit -m "feat: semicircular direction gauge + strategy bands + conditions + model detail"
```

---

### Task 3: 组合总览 1:1（持仓表格）

**Files:**
- Modify: `lib/features/home/home_screen.dart`（`_Dashboard`）
- Test: `test/features/home/dashboard_test.dart`（新建）

**Interfaces:**
- Consumes: `PortfolioController`（`positions`/`marketValue`/`totalProfit`/`floatingProfit`/`ledger.cashBalance`）、`MetricCard`、`pnlColor`/`withTabular`。
- Produces: `_Dashboard` 增加持仓表格行与「查看详情 →」跳转（`onNavigate` 回调）。

- [ ] **Step 1: 写失败测试**

创建 `test/features/home/dashboard_test.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio_controller.dart';
import 'package:stockcal/features/portfolio/persistent_portfolio_repository.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';

void main() {
  testWidgets('dashboard shows holdings table with 查看详情 row', (tester) async {
    final controller = PortfolioController(
      marketPrices: const {},
      repository: MemoryPortfolioRepository(),
    );
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: SizedBox())));
    // 注：此测试只验证 _Dashboard 的组合总览卡与持仓表文案。
    // 实际渲染需通过 HomeScreen；此处先冒烟 MetricCard 文案。
  });
}
```

> 由于 `_Dashboard` 是 `home_screen.dart` 的私有类，测试改为在 `test/features/home/home_screen_test.dart` 中通过 `HomeScreen` 渲染断言（该文件已存在并构造 HomeScreen）。**Step 1 改为**：在 `home_screen_test.dart` 追加用例断言「组合总览」「持仓股票」与「查看详情」字样在桌面宽度下出现。执行器应按现有 `home_screen_test.dart` 的 HomeScreen 构造方式写该用例（沿用其 `pump` helper），断言：

```dart
expect(find.text('组合总览'), findsOneWidget);
expect(find.text('查看详情'), findsWidgets);
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/home/home_screen_test.dart`
Expected: FAIL（尚无「组合总览」标题与「查看详情」）

- [ ] **Step 3: 实现组合总览**

在 `_Dashboard._content` 中：把标题 `Text('组合总览', ...)` 保留；将现有 `Wrap(... MetricCard 总资产/累计盈亏/浮动盈亏 ...)` 扩展为参考站 6 项（总投入 = `positions` 成本合计、当前市值 = `portfolioController.marketValue`、总浮动盈亏、已实现盈亏 = `ledger.realizedProfit`（若无该 getter 用 `totalProfit - floatingProfit`）、组合收益率 = 总盈亏/总投入×100）：

```dart
Wrap(
  spacing: 12,
  runSpacing: 12,
  children: [
    MetricCard(label: '持仓股票', value: '${positions.length} 只'),
    MetricCard(label: '总投入', value: invested.toStringAsFixed(0)),
    MetricCard(label: '当前市值', value: portfolioController.marketValue.toStringAsFixed(0)),
    MetricCard(label: '总浮动盈亏', value: portfolioController.floatingProfit.toStringAsFixed(0), color: pnlColor(context, portfolioController.floatingProfit)),
    MetricCard(label: '已实现盈亏', value: realized.toStringAsFixed(0), color: pnlColor(context, realized)),
    MetricCard(label: '组合收益率', value: '${(rate * 100).toStringAsFixed(2)}%', color: pnlColor(context, rate)),
  ],
),
```

在 `_content` 顶部计算：

```dart
final invested = positions.fold<double>(0, (sum, p) => sum + p.averageCost * p.quantity);
final realized = portfolioController.totalProfit - portfolioController.floatingProfit;
final rate = invested == 0 ? 0.0 : portfolioController.totalProfit / invested;
```

把现有「持仓与自选」区的 `for (final position in positions) ListTile(...)` 替换为表格行（每行尾「查看详情 →」按钮触发 `onNavigate`）。给 `_Dashboard` 增加 `required this.onNavigate`（`ValueChanged<String>`），`ListTile` 改为：

```dart
ListTile(
  contentPadding: EdgeInsets.zero,
  title: Text('${position.name} ${position.code}'),
  subtitle: Text('持仓 ${position.quantity} · 成本 ${position.averageCost.toStringAsFixed(2)}'),
  trailing: TextButton(
    onPressed: () => onNavigate('trades'),
    child: const Text('查看详情 →'),
  ),
),
```

（`_Dashboard` 构造处：`_MarketWorkspace` 已持有 `onNavigate`，透传给 `_Dashboard`。）

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/home/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/home/home_screen.dart test/features/home/
git commit -m "feat: portfolio overview 1:1 with holdings table"
```

---

### Task 4: 四个新独立页（盈利模式 / 未来指标 / 预测记录 / 统计图表）

**Files:**
- Create: `lib/features/patterns/patterns_workspace.dart`
- Create: `lib/features/future/future_workspace.dart`
- Create: `lib/features/predictions/predictions_workspace.dart`
- Create: `lib/features/charts/statistics_workspace.dart`
- Test: `test/features/patterns/patterns_workspace_test.dart`、`test/features/future/future_workspace_test.dart`、`test/features/charts/statistics_workspace_test.dart`

**Interfaces:**
- Consumes: `StockAnalysis`（Task 1）、`RuleBook`（`activeRules`/`evaluate`）、`RuleFacts`、`PredictionStore`（`lib/features/rules/prediction_store.dart`）、`PersistentPredictionRepository`、`PortfolioController`、`EmptyState`。
- Produces:
  - `PatternsWorkspace({required RuleBook ruleBook, StockAnalysis? analysis})`
  - `FutureWorkspace({required StockAnalysis analysis})`
  - `PredictionsWorkspace({required PredictionStore store})`
  - `StatisticsWorkspace({required PortfolioController portfolio})`

- [ ] **Step 1: 写失败测试**

`patterns_workspace_test.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/patterns/patterns_workspace.dart';
import 'package:stockcal/features/rules/rule_engine.dart';

void main() {
  testWidgets('PatternsWorkspace lists active rules', (tester) async {
    final book = RuleBook.withSystemDefaults();
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: PatternsWorkspace(ruleBook: book)),
    ));
    expect(find.text('盈利模式'), findsOneWidget);
    expect(find.text(book.activeRules.first.name), findsWidgets);
  });
}
```

`future_workspace_test.dart`：构造一个 `StockAnalysis`（复用 `StockAnalyzer().analyze(...)` 或直接传入一个含 `future` 的实例），断言标题「未来指标」与未来日期行出现。

`statistics_workspace_test.dart`：用 `PortfolioController`（内存仓库）断言标题「统计图表」出现。

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/patterns/ test/features/future/ test/features/charts/`
Expected: FAIL（文件不存在）

- [ ] **Step 3: 实现四个页**

`patterns_workspace.dart`（列出 `RuleBook.activeRules` 与命中状态；`analysis == null` 时命中状态为待定）：

```dart
class PatternsWorkspace extends StatelessWidget {
  const PatternsWorkspace({super.key, required this.ruleBook, this.analysis});
  final RuleBook ruleBook;
  final StockAnalysis? analysis;

  @override
  Widget build(BuildContext context) {
    final rules = ruleBook.activeRules;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('盈利模式', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        if (rules.isEmpty)
          const EmptyState(icon: Icons.auto_graph_outlined, title: '暂无规则'),
        for (final rule in rules)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.rule_outlined),
            title: Text(rule.name),
            subtitle: Text('优先级 ${rule.priority}'),
            trailing: analysis == null
                ? const Text('待定')
                : Text(rule.enabled ? '命中' : '停用'),
          ),
      ],
    );
  }
}
```

（需 import `../../widgets/empty_state.dart` 与 `../analysis/technical_analysis.dart`。）

`future_workspace.dart`（三日延伸表格化）：

```dart
class FutureWorkspace extends StatelessWidget {
  const FutureWorkspace({super.key, required this.analysis});
  final StockAnalysis analysis;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('未来指标', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 12),
        for (final point in analysis.future)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text('${point.day.month.toString().padLeft(2, '0')}-${point.day.day.toString().padLeft(2, '0')}'),
            subtitle: Text('MA${analysis.settings.maShortPeriod} ${point.maShort.toStringAsFixed(2)} · MA${analysis.settings.maLongPeriod} ${point.maLong.toStringAsFixed(2)}'),
            trailing: Text('BOLL ${point.bollUpper.toStringAsFixed(2)}', style: withTabular(null)),
          ),
      ],
    );
  }
}
```

`predictions_workspace.dart`：接收 `PredictionStore`（若有 `List<...> predictions` getter 则渲染其列表；无公开列表则渲染 `EmptyState(icon: Icons.history, title: '暂无预测记录')` 占位，执行器以 `prediction_store.dart` 实际公开 API 为准渲染）。**接口以 `prediction_store.dart` 现有 getter 为准**，本计划不臆造其方法名。

`statistics_workspace.dart`：用 `CustomPaint` 或 `Container` 画两条示意图表（收益曲线 = 按日折线、持仓分布 = 水平条），标题「统计图表」。空数据时 `EmptyState(icon: Icons.bar_chart, title: '暂无统计数据')`。

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/patterns/ test/features/future/ test/features/charts/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/patterns/ lib/features/future/ lib/features/predictions/ lib/features/charts/ test/features/patterns/ test/features/future/ test/features/charts/
git commit -m "feat: add patterns/future/predictions/statistics workspace pages"
```

---

### Task 5: 导航 Shell（左 rail + 顶栏 + 命令面板 + drawer）

**Files:**
- Create: `lib/features/navigation/nav_destination.dart`
- Create: `lib/features/navigation/command_palette.dart`
- Create: `lib/features/navigation/app_shell.dart`
- Modify: `lib/features/home/home_screen.dart`
- Test: `test/features/navigation/nav_shell_test.dart`

**Interfaces:**
- Consumes: Task 1–4 产物、`StockCatalog`（`lib/features/market/market_data.dart`）、`SessionController`。
- Produces:
  - `const List<NavDestination> navDestinations`（10 项，命名照参考站）
  - `CommandPalette({required ValueChanged<String> onNavigate, required StockCatalog catalog})`
  - `AppShell({required List<NavDestination> destinations, required String selected, required ValueChanged<String> onSelected, required Widget content, required Widget accountMenu})`

- [ ] **Step 1: 写失败测试**

创建 `test/features/navigation/nav_shell_test.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/navigation/nav_destination.dart';
import 'package:stockcal/features/navigation/app_shell.dart';

void main() {
  test('navDestinations follow reference site naming', () {
    expect(navDestinations.map((d) => d.title).toList(), const [
      '组合总览', '关键位分析', '盈利模式', '未来指标', '预测记录',
      '交易与盈亏', '统计图表', '当日复盘', 'AI策略', '经验规则',
    ]);
  });

  testWidgets('AppShell renders all destinations in the rail', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: AppShell(
        destinations: navDestinations,
        selected: '关键位分析',
        onSelected: (_) {},
        content: const Text('content'),
        accountMenu: const Icon(Icons.account_circle_outlined),
      ),
    ));
    expect(find.text('关键位分析'), findsWidgets);
    expect(find.text('组合总览'), findsOneWidget);
    expect(find.text('content'), findsOneWidget);
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/navigation/nav_shell_test.dart`
Expected: FAIL（文件不存在）

- [ ] **Step 3: 实现 `nav_destination.dart`**

```dart
import 'package:flutter/material.dart';

class NavDestination {
  const NavDestination({required this.key, required this.title, required this.icon});
  final String key;
  final String title;
  final IconData icon;
}

const navDestinations = <NavDestination>[
  NavDestination(key: 'overview', title: '组合总览', icon: Icons.dashboard_outlined),
  NavDestination(key: 'key-levels', title: '关键位分析', icon: Icons.candlestick_chart_outlined),
  NavDestination(key: 'patterns', title: '盈利模式', icon: Icons.auto_graph_outlined),
  NavDestination(key: 'future', title: '未来指标', icon: Icons.insights_outlined),
  NavDestination(key: 'predictions', title: '预测记录', icon: Icons.history),
  NavDestination(key: 'trades', title: '交易与盈亏', icon: Icons.account_balance_wallet_outlined),
  NavDestination(key: 'charts', title: '统计图表', icon: Icons.bar_chart_outlined),
  NavDestination(key: 'review', title: '当日复盘', icon: Icons.rate_review_outlined),
  NavDestination(key: 'ai-strategy', title: 'AI策略', icon: Icons.psychology_outlined),
  NavDestination(key: 'rules', title: '经验规则', icon: Icons.library_books_outlined),
];
```

- [ ] **Step 4: 实现 `command_palette.dart`**

```dart
import 'package:flutter/material.dart';
import '../market/market_data.dart';
import 'nav_destination.dart';

class CommandPalette extends StatefulWidget {
  const CommandPalette({super.key, required this.onNavigate, required this.catalog});
  final ValueChanged<String> onNavigate;
  final StockCatalog catalog;

  @override
  State<CommandPalette> createState() => _CommandPaletteState();
}

class _CommandPaletteState extends State<CommandPalette> {
  String _query = '';
  late Future<List<Security>> _results;

  @override
  void initState() {
    super.initState();
    _results = widget.catalog.search('');
  }

  void _onChanged(String value) {
    setState(() {
      _query = value;
      _results = widget.catalog.search(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final matches = navDestinations
        .where((d) => d.title.contains(_query) || d.key.contains(_query))
        .toList();
    return AlertDialog(
      contentPadding: EdgeInsets.zero,
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                autofocus: true,
                onChanged: _onChanged,
                decoration: const InputDecoration(
                  hintText: '搜索页面或股票…',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final d in matches)
                    ListTile(
                      leading: Icon(d.icon),
                      title: Text(d.title),
                      onTap: () {
                        Navigator.of(context).pop();
                        widget.onNavigate(d.key);
                      },
                    ),
                  FutureBuilder<List<Security>>(
                    future: _results,
                    builder: (context, snapshot) {
                      if (!snapshot.hasData) return const SizedBox.shrink();
                      return Column(
                        children: [
                          for (final s in snapshot.data!.take(8))
                            ListTile(
                              leading: const Icon(Icons.candlestick_chart_outlined),
                              title: Text(s.name),
                              subtitle: Text(s.code),
                              onTap: () {
                                Navigator.of(context).pop();
                                widget.onNavigate('key-levels');
                              },
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: 实现 `app_shell.dart`**

```dart
import 'package:flutter/material.dart';
import 'nav_destination.dart';

class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.destinations,
    required this.selected,
    required this.onSelected,
    required this.content,
    required this.accountMenu,
  });

  final List<NavDestination> destinations;
  final String selected;
  final ValueChanged<String> onSelected;
  final Widget content;
  final Widget accountMenu;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    if (wide) {
      return Row(
        children: [
          _Rail(
            destinations: destinations,
            selected: selected,
            onSelected: onSelected,
          ),
          Expanded(child: content),
        ],
      );
    }
    return Scaffold(
      drawer: Drawer(
        child: ListView(
          children: [
            for (final d in destinations)
              ListTile(
                leading: Icon(d.icon),
                title: Text(d.title),
                selected: selected == d.key,
                onTap: () {
                  Navigator.of(context).pop();
                  onSelected(d.key);
                },
              ),
          ],
        ),
      ),
      appBar: AppBar(title: Text(_title), actions: [accountMenu]),
      body: content,
    );
  }

  String get _title =>
      destinations.firstWhere((d) => d.key == selected, orElse: () => destinations.first).title;
}

class _Rail extends StatelessWidget {
  const _Rail({required this.destinations, required this.selected, required this.onSelected});
  final List<NavDestination> destinations;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 224,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 8),
          children: [
            for (final d in destinations)
              ListTile(
                dense: true,
                leading: Icon(d.icon, size: 21),
                title: Text(d.title),
                selected: selected == d.key,
                onTap: () => onSelected(d.key),
              ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 6: 重接 `home_screen.dart`**

在 `_HomeScreenState`：`_selected` 初值改为 `'overview'`；新增 `String _commandPaletteOpen` 无关状态，用 `showDialog` 打开 `CommandPalette`。`build` 改为：

```dart
return AppShell(
  destinations: navDestinations,
  selected: _selected,
  onSelected: (key) => setState(() => _selected = key),
  accountMenu: PopupMenuButton<String>(
    icon: const Icon(Icons.account_circle_outlined),
    onSelected: (v) => setState(() => _selected = v),
    itemBuilder: (_) => const [
      PopupMenuItem(value: 'account', child: Text('账户同步')),
      PopupMenuItem(value: 'settings', child: Text('设置')),
      PopupMenuItem(value: 'admin', child: Text('管理后台')),
    ],
  ),
  content: _Workspace(
    module: _selected,
    // ... 原有参数透传，onNavigate 改签名仍为 (String) => setState(() => _selected = ...)
  ),
);
```

`_Workspace` 增加按新 key 的分支（在现有 `module == ...` 判断处新增/替换）：

```dart
if (module == 'overview') { /* 组合总览：_MarketWorkspace 或 _Dashboard 直出 */ }
if (module == 'key-levels') { return StockAnalysisScreen(...); }
if (module == 'patterns') { return PatternsWorkspace(ruleBook: ruleBook, analysis: stockAnalysisController.analysis); }
if (module == 'future') { final a = stockAnalysisController.analysis; return a == null ? const EmptyState(icon: Icons.insights_outlined, title: '请先加载行情') : FutureWorkspace(analysis: a); }
if (module == 'predictions') { return PredictionsWorkspace(...); }
if (module == 'trades') { return PortfolioScreen(controller: portfolioController); }
if (module == 'charts') { return StatisticsWorkspace(portfolio: portfolioController); }
if (module == 'review') { return ReviewWorkspace(...); }
if (module == 'ai-strategy') { return StockAnalysisScreen(...); }
if (module == 'rules') { return KnowledgeWorkspace(controller: knowledgeController); }
```

同时保留原「账户同步 / 设置后台 / 管理后台 / 专业K线 / 规则回测 / 自选」分支（这些从顶栏账户菜单与 `onNavigate` 可达），`module` 字符串继续沿用原 key（`account`→`账户同步`、`settings`→`设置后台`、`admin`→`管理后台`），在 `_Workspace` 内做一层映射：

```dart
final target = switch (module) {
  'account' => '账户同步',
  'settings' => '设置后台',
  'admin' => '管理后台',
  _ => module,
};
```

（执行器需对照 `home_screen.dart` 现有 switch 逐一改，保留 `专业K线`/`规则回测` 的 `_MarketSnapshotLoader` 分支不变。）

- [ ] **Step 7: 跑 shell 测试确认通过**

Run: `flutter test test/features/navigation/nav_shell_test.dart`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add lib/features/navigation/ lib/features/home/home_screen.dart test/features/navigation/
git commit -m "feat: navigation shell with left rail, top bar, command palette and drawer"
```

---

### Task 6: 顶栏账户菜单 + 登录门控收尾

**Files:**
- Modify: `lib/features/home/home_screen.dart`
- Test: `test/features/home/login_prompt_test.dart`（适配）

**Interfaces:**
- Consumes: `SessionController`（`session?.isSignedIn`）、`AppShell.accountMenu`。
- Produces: 未登录时顶栏账户菜单显示「登录」入口跳转 `账户同步`；已登录显示账户同步/设置/管理后台/退出。

- [ ] **Step 1: 写失败测试**

在 `login_prompt_test.dart` 追加：未登录时 `PopupMenuButton` 存在且打开后含「登录」。

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/home/login_prompt_test.dart`
Expected: FAIL（账户菜单尚无登录态分支）

- [ ] **Step 3: 实现**

`_HomeScreenState.build` 的 `accountMenu` 改为读取 `_sessionController`（已存在）：

```dart
accountMenu: ListenableBuilder(
  listenable: _sessionController,
  builder: (context, _) {
    final signedIn = _sessionController.session?.isSignedIn == true;
    return PopupMenuButton<String>(
      icon: const Icon(Icons.account_circle_outlined),
      onSelected: (v) => setState(() => _selected = v),
      itemBuilder: (_) => signedIn
          ? const [
              PopupMenuItem(value: 'account', child: Text('账户同步')),
              PopupMenuItem(value: 'settings', child: Text('设置')),
              PopupMenuItem(value: 'admin', child: Text('管理后台')),
              PopupMenuItem(value: 'logout', child: Text('退出登录')),
            ]
          : const [
              PopupMenuItem(value: 'account', child: Text('登录')),
            ],
    );
  },
),
```

（`logout` 分支在 `_Workspace`/`onSelected` 中处理：调用 `_sessionController.signOut()` 后停留在 overview；执行器按 `session.dart` 现有退出 API 调用。）

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/home/login_prompt_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/home/home_screen.dart test/features/home/login_prompt_test.dart
git commit -m "feat: login-gated shell account menu"
```

---

### Task 7: 回归适配 + 全量验证

**Files:**
- Modify: `test/features/product_surface_test.dart`、`test/features/navigation/mobile_navigation_test.dart`、`test/features/home/home_screen_test.dart`（及任何断言旧 4-tab / 旧模块字符串的测试）

**Interfaces:**
- Consumes: 全部前序任务。

- [ ] **Step 1: 跑全量测试定位失败**

Run: `flutter test`
Expected: 若干导航/首页测试失败（断言旧的 `行情/自选/组合/我的` 4-tab 或旧模块 key）

- [ ] **Step 2: 逐项适配**

对照失败输出，把断言改为新目的地命名与 `AppShell` 结构：
- `product_surface_test.dart`：断言改为 `navDestinations` 的 10 项标题渲染。
- `mobile_navigation_test.dart`：断言改为移动端 `Drawer` 内含 10 项。
- `home_screen_test.dart`：断言首页默认 `overview`（组合总览）。

- [ ] **Step 3: 跑全量测试确认全绿**

Run: `flutter test`
Expected: 全 PASS（59 文件）

- [ ] **Step 4: 静态分析 + Web 构建验收**

Run: `flutter analyze` 与 `flutter build web --release`
Expected: 无错误；构建成功。

- [ ] **Step 5: 提交**

```bash
git add test/
git commit -m "test: adapt navigation tests to KEYLINE shell"
```

---

## Self-Review 备注

- **Spec 覆盖**：九节 spec 逐项映射 —— 一(导航 shell)→Task 5/6；二(数据模型)→Task 1；三(关键位分析)→Task 2；四(组合总览)→Task 3；五(其余 8 页)→Task 4；六(错误处理)→贯穿各 Task 用 `EmptyState`/`ErrorState`；七(测试)→各 Task + Task 7；九(阶段提交)→各 Task 的 Step 5/7/8。
- **类型一致性**：`MatchedRule.band`、`StockAnalysis.amplitude/atr/parameters/ruleHitCount/ruleTotalCount/conditions/ruleCredibility/modelName`、`RuleBand`、`ParameterItem`、`ConditionCheck` 在 Task 1 定义，Task 2 消费；`navDestinations`/`NavDestination`/`AppShell`/`CommandPalette` 在 Task 5 定义，Task 6 消费。
- **既有 API 以源码为准**：`PredictionsWorkspace` 依赖 `prediction_store.dart` 的公开 getter，`退出登录` 依赖 `session.dart` 的 `signOut`，执行时以源码实际签名对齐，不臆造。
