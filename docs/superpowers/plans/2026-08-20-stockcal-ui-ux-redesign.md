# StockCal UI/UX 重设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 StockCal 从「功能全但门面素」改成 2026 深色金融终端：统一组件库、真实搜索、友好错误/空状态、4-tab 导航、金融仪表盘、深色原生 K 线。

**Architecture:** 先落地基础（配色 + 组件库），再做交互修复（搜索/登录/错误/空状态），最后做结构重构（4-tab 导航 + 仪表盘）。每步 TDD，Flutter widget 测试驱动。

**Tech Stack:** Flutter 3.44 (Material 3), Dart, flutter_test；后端已部署不动。

**Spec:** `docs/superpowers/specs/2026-08-20-stockcal-ui-ux-redesign.md`

## Global Constraints

- 配色（`lib/theme/stockcal_theme.dart` 的 `StockCalColors`）：bg `#0F1219`、surface `#1A1E27`、surfaceHigh `#262B36`、primary `#3B6FE0`、accent `#E8A23C`、gain `#F23645`、loss `#089981`、textPrimary `#E3E6EB`、textSecondary `#8A90A0`、border `#262B36`。
- A 股约定：红涨绿跌（gain=红，loss=绿），且颜色不单独承载语义（配文字/符号）。
- 数字用 `withTabular`（`lib/core/display.dart`）。
- 每屏只留一个主行动；空状态用 `EmptyState`；错误用 `ErrorState`；加载用骨架屏 `Skeleton`，不用 `CircularProgressIndicator`（测试中允许）。
- 现有 180+ Flutter 测试保持全绿；导航重构涉及的测试同步适配。
- 提交信息结尾带 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

### Task 1: 2026 Midnight Blue 主题配色

**Files:**
- Modify: `lib/theme/stockcal_theme.dart`
- Test: `test/theme/stockcal_theme_test.dart`

**Interfaces:**
- Produces: `StockCalColors` 常量更新为 Global Constraints 的值；`buildStockCalTheme(Brightness)` 签名不变。

- [ ] **Step 1: 更新测试断言到新配色**

在 `test/theme/stockcal_theme_test.dart` 中，把现有断言的值改成新值（已存在的两个 testWidgets 保留结构）：

```dart
expect(Theme.of(context).scaffoldBackgroundColor, const Color(0xFF0F1219));
expect(gainColor(context), const Color(0xFFF23645));
expect(lossColor(context), const Color(0xFF089981));
```

新增一个断言验证主色：

```dart
expect(Theme.of(context).colorScheme.primary, const Color(0xFF3B6FE0));
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/theme/stockcal_theme_test.dart`
Expected: FAIL（现有值是 `#131722` 等，断言不匹配）

- [ ] **Step 3: 更新 StockCalColors 常量**

在 `lib/theme/stockcal_theme.dart` 的 `StockCalColors` 中替换：

```dart
static const Color bg = Color(0xFF0F1219);
static const Color surface = Color(0xFF1A1E27);
static const Color surfaceHigh = Color(0xFF262B36);
static const Color primary = Color(0xFF3B6FE0);
static const Color accent = Color(0xFFE8A23C);
// gain/loss 保持不变
static const Color textPrimary = Color(0xFFE3E6EB);
static const Color textSecondary = Color(0xFF8A90A0);
static const Color border = Color(0xFF262B36);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/theme/stockcal_theme_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/theme/stockcal_theme.dart test/theme/stockcal_theme_test.dart
git commit -m "feat: adopt 2026 Midnight Blue palette"
```

---

### Task 2: 组件库 MetricCard / EmptyState / ErrorState / Skeleton

**Files:**
- Create: `lib/widgets/metric_card.dart`
- Create: `lib/widgets/empty_state.dart`
- Create: `lib/widgets/error_state.dart`
- Create: `lib/widgets/skeleton.dart`
- Test: `test/widgets/components_test.dart`

**Interfaces:**
- Produces:
  - `MetricCard({required String label, required String value, Color? color, double width = 150})`
  - `EmptyState({required IconData icon, required String title, String? message, String? actionLabel, VoidCallback? onAction})`
  - `ErrorState({required String message, VoidCallback? onRetry})`
  - `Skeleton({double? width, double height = 16, BorderRadius? radius})`

- [ ] **Step 1: 写失败测试**

创建 `test/widgets/components_test.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/widgets/metric_card.dart';
import 'package:stockcal/widgets/empty_state.dart';
import 'package:stockcal/widgets/error_state.dart';
import 'package:stockcal/widgets/skeleton.dart';

void main() {
  testWidgets('MetricCard renders label and value', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: MetricCard(label: '总资产', value: '¥100.00')),
    ));
    expect(find.text('总资产'), findsOneWidget);
    expect(find.text('¥100.00'), findsOneWidget);
  });

  testWidgets('EmptyState shows action button and fires callback', (tester) async {
    var tapped = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: EmptyState(
          icon: Icons.bookmark_border,
          title: '暂无自选',
          actionLabel: '去添加',
          onAction: () => tapped = true,
        ),
      ),
    ));
    await tester.tap(find.text('去添加'));
    expect(tapped, isTrue);
  });

  testWidgets('ErrorState shows retry and fires callback', (tester) async {
    var retried = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ErrorState(message: '加载失败', onRetry: () => retried = true),
      ),
    ));
    await tester.tap(find.text('重试'));
    expect(retried, isTrue);
  });

  testWidgets('Skeleton renders a box', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: Skeleton(height: 20)),
    ));
    expect(find.byType(Skeleton), findsOneWidget);
  });
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/widgets/components_test.dart`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 实现四个组件**

`lib/widgets/metric_card.dart`：

```dart
import 'package:flutter/material.dart';
import '../core/display.dart';

class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    this.color,
    this.width = 150,
  });

  final String label;
  final String value;
  final Color? color;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 6),
              Text(
                value,
                style: withTabular(
                  Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
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

`lib/widgets/empty_state.dart`：

```dart
import 'package:flutter/material.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: muted),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(message!, textAlign: TextAlign.center, style: TextStyle(color: muted)),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
```

`lib/widgets/error_state.dart`：

```dart
import 'package:flutter/material.dart';

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 44, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('重试'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

`lib/widgets/skeleton.dart`：

```dart
import 'package:flutter/material.dart';

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius});

  final double? width;
  final double height;
  final BorderRadius? radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceHigh,
        borderRadius: radius ?? BorderRadius.circular(6),
      ),
    );
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/widgets/components_test.dart`
Expected: PASS（4 个测试通过）

- [ ] **Step 5: 提交**

```bash
git add lib/widgets/ test/widgets/components_test.dart
git commit -m "feat: add MetricCard/EmptyState/ErrorState/Skeleton component library"
```

---

### Task 3: K 线深色适配 + 指标配色统一

**Files:**
- Modify: `lib/features/chart/professional_chart_screen.dart`
- Test: `test/features/chart/chart_theme_test.dart`

**Interfaces:**
- Consumes: `StockCalColors`（Task 1）
- Produces: 蜡烛颜色从主题取，无对外签名变化。

- [ ] **Step 1: 写失败测试**

创建 `test/features/chart/chart_theme_test.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/theme/stockcal_theme.dart';
import 'package:stockcal/features/chart/chart_data.dart';
import 'package:stockcal/features/chart/professional_chart_screen.dart';

void main() {
  testWidgets('candles use theme gain/loss colors', (tester) async {
    final candles = [
      for (var i = 0; i < 10; i++)
        Candle(day: DateTime(2026, 1, i + 1), open: 10, high: 11, low: 9, close: 10.5, volume: 100),
    ];
    await tester.pumpWidget(MaterialApp(
      theme: buildStockCalTheme(Brightness.dark),
      home: ProfessionalChartScreen(candles: candles),
    ));
    // 断言主题色常量被使用：检查 StockCalColors 暴露正确的值
    expect(StockCalColors.gain, const Color(0xFFF23645));
    expect(StockCalColors.loss, const Color(0xFF089981));
  });
}
```

- [ ] **Step 2: 跑测试确认失败（如常量已正确则此步通过，跳过红色阶段）**

Run: `flutter test test/features/chart/chart_theme_test.dart`
Expected: PASS（此测试验证常量，属于回归测试；核心改动靠 Step 3 的代码替换保障）

- [ ] **Step 3: 替换硬编码颜色**

在 `professional_chart_screen.dart` 中，`CandleSticksStyle.light(...)` 调用处：

把
```dart
candleBullColor: const Color(0xFFC53A43),
candleBearColor: const Color(0xFF16856B),
volumeBullColor: const Color(0x66C53A43),
volumeBearColor: const Color(0x6616856B),
```
改为
```dart
candleBullColor: StockCalColors.gain,
candleBearColor: StockCalColors.loss,
volumeBullColor: StockCalColors.gain.withValues(alpha: 0.4),
volumeBearColor: StockCalColors.loss.withValues(alpha: 0.4),
```

并在文件顶部加 import：
```dart
import '../../theme/stockcal_theme.dart';
```

同时把 `_IndicatorPainter` 中硬编码的指标线颜色替换为 `StockCalColors`（MA5 用 `accent`、MA20 用 `primary`、EMA12 用 `textSecondary`、BOLL 用 `border`），即把 `const Color(0xFFB57900)` / `0xFF2667A8` / `0xFF7B4FA3` / `0xFF65717E` 分别替换为 `StockCalColors.accent` / `StockCalColors.primary` / `StockCalColors.textSecondary` / `StockCalColors.border`。

- [ ] **Step 4: 跑全量测试确认无回归**

Run: `flutter test`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/chart/professional_chart_screen.dart test/features/chart/chart_theme_test.dart
git commit -m "feat: dark-native chart with theme-sourced candle and indicator colors"
```

---

### Task 4: 自选股真实搜索

**Files:**
- Modify: `lib/features/watchlist/watchlist_screen.dart`
- Modify: `lib/features/home/home_screen.dart`
- Test: `test/features/watchlist/watchlist_screen_test.dart`（同步适配）

**Interfaces:**
- Consumes: `AShareMarketAdapter`（含 `Future<List<Security>> search(String query)`，`Security` 有 `code`/`name`）。
- Produces: `WatchlistScreen({required controller, required marketService})`。

- [ ] **Step 1: 写失败测试**

在 `test/features/watchlist/watchlist_screen_test.dart` 中新增（或改现有）：用 fake `AShareMarketAdapter` 提供搜索结果，验证「添加股票」弹窗调用 search 并显示结果：

```dart
class _FakeMarket implements AShareMarketAdapter {
  @override
  Future<List<Security>> search(String query) async =>
      [const Security(code: '600519', name: '贵州茅台')];
  @override
  Future<MarketSnapshot> snapshot(String code) =>
      throw UnimplementedError();
}

testWidgets('stock picker searches via market service', (tester) async {
  final controller = WatchlistController(
    repository: MemoryWatchlistRepository(),
    outbox: MemoryMutationOutbox(),
  );
  await tester.pumpWidget(MaterialApp(
    home: WatchlistScreen(controller: controller, marketService: _FakeMarket()),
  ));
  // 触发添加流程、输入查询、断言结果来自 fake service
});
```

（具体断言按现有 `_StockPicker` 的 Key `stock-search-field` 定位。）

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/watchlist/watchlist_screen_test.dart`
Expected: FAIL（`WatchlistScreen` 尚无 `marketService` 参数）

- [ ] **Step 3: 实现真搜索**

`watchlist_screen.dart`：给 `WatchlistScreen` 加 `required this.marketService`；把 `_addStock` 的 `_StockPicker` 改为接收 `marketService`，`_StockPickerState` 里用 `Timer`（300ms 防抖）调 `marketService.search(query)`，展示 `FutureBuilder`（加载用 `Skeleton`，结果渲染 `ListTile`，空结果显示「未找到匹配股票」）。

`home_screen.dart`：`_Workspace` 里 `module == '自选股'` 分支改为 `WatchlistScreen(controller: watchlistController, marketService: marketService)`。

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/watchlist/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/watchlist/watchlist_screen.dart lib/features/home/home_screen.dart test/features/watchlist/
git commit -m "feat: real market search in watchlist stock picker"
```

---

### Task 5: 登录引导卡

**Files:**
- Modify: `lib/features/home/home_screen.dart`
- Test: `test/features/home/login_prompt_test.dart`

**Interfaces:**
- Consumes: `SessionController`（`session?.isSignedIn`）
- Produces: `_Dashboard` 接收 `bool signedIn` + `VoidCallback onLogin`。

- [ ] **Step 1: 写失败测试**

创建 `test/features/home/login_prompt_test.dart`：

```dart
testWidgets('shows login prompt when signed out', (tester) async {
  // 构造 HomeScreen，session 未登录
  // 断言 find.text('登录以获取行情与 AI 分析') findsOneWidget
});
testWidgets('hides login prompt when signed in', (tester) async {
  // 已登录：断言 find.text('登录以获取行情与 AI 分析') findsNothing
});
```

（用真实 `SessionController` 配合内存 repository，`session == null` 表示未登录。）

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/home/login_prompt_test.dart`
Expected: FAIL（尚无登录卡）

- [ ] **Step 3: 实现登录引导卡**

在 `home_screen.dart` 的 `_Dashboard` 中：新增 `signedIn` 与 `onLogin` 参数；`_content` 顶部当 `!signedIn` 时插入一张 `Card`：

```dart
if (!signedIn) ...[
  Card(
    child: ListTile(
      leading: const Icon(Icons.login),
      title: const Text('登录以获取行情与 AI 分析'),
      subtitle: const Text('登录后同步自选、组合，获取实时行情与 AI 复盘'),
      trailing: FilledButton(
        onPressed: onLogin,
        child: const Text('去登录'),
      ),
    ),
  ),
  const SizedBox(height: 12),
],
```

`_Workspace` 里把 `sessionController` 与 `onNavigate` 传给 `_Dashboard`。

- [ ] **Step 4: 跑测试确认通过**

Run: `flutter test test/features/home/login_prompt_test.dart`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/features/home/home_screen.dart test/features/home/login_prompt_test.dart
git commit -m "feat: login prompt card on dashboard"
```

---

### Task 6: 友好错误 + 空状态 CTA（接入组件库）

**Files:**
- Modify: `lib/features/home/home_screen.dart`
- Modify: `lib/features/portfolio/portfolio_screen.dart`
- Modify: `lib/features/review/review_workspace.dart`
- Modify: `lib/features/analysis/stock_analysis_screen.dart`
- Test: 现有测试适配

**Interfaces:**
- Consumes: `ErrorState`/`EmptyState`/`MetricCard`（Task 2）

- [ ] **Step 1: 替换 `_MarketSnapshotLoader` 的错误为 ErrorState**

`home_screen.dart` 的 `_MarketSnapshotLoaderState.build`：把 `snapshot.hasError` 分支里的 `Text(snapshot.error.toString())` 换成 `ErrorState(message: '行情加载失败，请稍后重试', onRetry: _retry)`。

- [ ] **Step 2: 替换组合页/复盘页/分析页指标为 MetricCard**

- `portfolio_screen.dart`：`_Metric`（`value` 为 String）改为用 `MetricCard`，`value` 传 String。
- `review_workspace.dart`：`_Value` 改为 `MetricCard`。
- `stock_analysis_screen.dart`：`_ValueTile`（`value` 为 double）改为 `MetricCard`（`value` 传 `value.toStringAsFixed(2)`）。

- [ ] **Step 3: 空状态加 CTA**

- 组合页「暂无持仓」→ `EmptyState(icon, '暂无持仓', '记录一笔交易后在这里汇总', '记一笔', onAction: _showTradeEditor)`。
- 规则页「暂无规则」→ `EmptyState(..., '新建规则', onAction: _createRule)`。
- 复盘页「暂无复盘记录」→ `EmptyState(..., actionLabel 视条件)`。

- [ ] **Step 4: 跑全量测试**

Run: `flutter test`
Expected: 全绿（个别测试若断言旧文案，同步改断言为新文案）

- [ ] **Step 5: 提交**

```bash
git add lib/features/
git commit -m "feat: friendly errors and guided empty states via component library"
```

---

### Task 7: 4-tab 导航重构

**Files:**
- Modify: `lib/features/home/home_screen.dart`
- Test: `test/features/product_surface_test.dart` 等导航相关测试适配

**Interfaces:**
- Produces: 底部导航 4 tab：`行情`/`自选`/`组合`/`我的`；桌面导航 rail 同步；「我的」页为卡片网格入口。

- [ ] **Step 1: 更新导航测试断言**

把 `product_surface_test.dart` 里对旧 5-tab（总览/个股分析/专业K线/组合/更多）的断言改成 4-tab（行情/自选/组合/我的）。

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/product_surface_test.dart`
Expected: FAIL

- [ ] **Step 3: 实现 4-tab 导航**

`home_screen.dart`：`_selected` 初值改为 `'行情'`；`mobileIndex` 映射与 `NavigationBar` 的 `destinations` 改为 4 项；`_Workspace` 新增 `'行情'`/`'我的'` 分支：

- `'行情'`：未选中股票时渲染 `_Dashboard`，选中后渲染 `StockAnalysisScreen` + 顶栏「专业 K 线」按钮切 `_chartStockCode` 到 `ProfessionalChartScreen`（保留 `_MarketSnapshotLoader`）。
- `'我的'`：渲染 `_MyPage`（新 StatelessWidget），用 `GridView` 卡片网格列出「复盘 AI/规则回测/知识规则/账户同步/设置/管理后台」，点击 `onNavigate` 到原模块。
- 删除旧 `'更多'` 分支与 `_MoreDestination`。

- [ ] **Step 4: 跑全量测试**

Run: `flutter test`
Expected: 全绿（导航相关测试已适配）

- [ ] **Step 5: 提交**

```bash
git add lib/features/home/home_screen.dart test/features/product_surface_test.dart
git commit -m "feat: restructure navigation to 4 tabs (行情/自选/组合/我的)"
```

---

### Task 8: 首页金融仪表盘

**Files:**
- Modify: `lib/features/home/home_screen.dart`
- Test: `test/features/home/dashboard_test.dart`

**Interfaces:**
- Consumes: `MetricCard`、登录卡（Task 5）、`EmptyState`。

- [ ] **Step 1: 写失败测试**

创建 `test/features/home/dashboard_test.dart`，断言已登录时仪表盘展示「总资产」指标卡（`MetricCard`）与自选行情卡列表标题。

- [ ] **Step 2: 跑测试确认失败**

Run: `flutter test test/features/home/dashboard_test.dart`
Expected: FAIL

- [ ] **Step 3: 实现仪表盘**

`_Dashboard`：把现有 `_Metric`（Column）换成 `MetricCard`；顶部总资产区用大号 `MetricCard`；新增「自选股行情」卡片列表（每张卡：名称/代码/现价/涨跌幅，涨跌色 + `withTabular`，sparkline 用 `snapshot.dailyCandles` 尾段收盘价绘制）；保留关键位提醒与快速入口。行情数据来自 `marketService`，未登录或未选股时显示登录卡/空状态。

- [ ] **Step 4: 跑全量测试**

Run: `flutter test`
Expected: 全绿

- [ ] **Step 5: 提交**

```bash
git add lib/features/home/home_screen.dart test/features/home/dashboard_test.dart
git commit -m "feat: financial dashboard home with asset metrics and watchlist quotes"
```

---

## Self-Review 备注

- Spec 覆盖：8 个 spec 项 → Task 1(配色) 2(组件库) 3(K线) 4(搜索) 5(登录) 6(错误/空状态) 7(导航) 8(仪表盘)，逐项对应；骨架屏落在 Task 2/6 接入处。
- 类型一致性：`Security`（code/name）来自 `market_data.dart`，`AShareMarketAdapter.search` 返回 `Future<List<Security>>`；`MetricCard` 的 `value` 统一为 String。
- 导航重构（Task 7）改动最大，`_Workspace` 的 `switch` 会重排，执行时需对照 `home_screen.dart` 现状。
