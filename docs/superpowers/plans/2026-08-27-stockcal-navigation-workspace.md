# StockCal Flutter 导航与股票工作区实施计划（已替代）

> 状态：已被 `2026-08-27-stockcal-web-first-plan.md` 替代。由于产品路线改为 Web-first，本计划仅保留为 Flutter 方案历史记录，不再执行。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将旧的桌面 Rail／移动 Drawer 重构为已确认的顶部导航／移动底部导航，并建立跨总览、分析、K 线、交易和复盘共享的单一股票工作区状态。

**Architecture:** `HomeScreen` 继续作为依赖组装边界，但把一级导航交给 `NavigationController`，把股票搜索、选择、周期、行情、分析和请求竞态交给 `StockWorkspaceController`。`AppShell` 只渲染响应式导航和内容；业务页面通过控制器读取同一个不可变 `StockWorkspaceSnapshot`，不再自行加载同一股票的行情。

**Tech Stack:** Flutter 3.47、Dart 3.12、Material 3、`ChangeNotifier`、`flutter_test`

**Spec:** `docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md`

## Global Constraints

- 宽度不小于 `900px` 时使用吸顶顶部导航；小于 `900px` 时使用轻量顶部栏和固定底部导航。
- 桌面一级导航固定为：总览、个股分析、专业 K 线、交易、复盘、规则库。
- 移动底部导航固定为：总览、分析、K线、交易、复盘。
- 当前股票、操作周期、一级导航和各聚合页二级页签互不无故重置。
- 选择新股票后旧股票数据不得伪装为新股票数据；快速切股时旧请求不得覆盖新结果。
- 刷新失败时保留最后一次成功数据，并暴露失败、过期或离线状态及最后更新时间。
- 正式功能不得静默注入演示行情；演示数据只允许出现在明确测试夹具或演示模式。
- `375px` 宽度不得产生页面级横向溢出；触控目标不小于 `48dp`；`1.3` 倍文本不得使导航溢出。
- 保留 `StockAnalyzer`、仓库接口、远程服务接口和现有领域计算，不引入新路由框架。

---

## 文件结构

| 文件 | 单一职责 |
|---|---|
| `lib/features/navigation/nav_destination.dart` | 定义一级导航标识、桌面与移动可见性和标签 |
| `lib/features/navigation/navigation_controller.dart` | 保存一级导航及各聚合页二级页签 |
| `lib/features/navigation/app_shell.dart` | 渲染桌面顶部导航、移动顶部栏和底部导航 |
| `lib/features/workspace/stock_workspace_controller.dart` | 管理当前股票、周期、行情、分析、刷新和请求竞态 |
| `lib/features/workspace/stock_workspace_scope.dart` | 向子树提供同一个工作区控制器 |
| `lib/features/home/home_screen.dart` | 组装依赖并把旧模块映射到六个一级工作区 |
| `test/features/navigation/navigation_controller_test.dart` | 验证导航状态和二级页签保持 |
| `test/features/navigation/nav_shell_test.dart` | 验证桌面顶部导航 |
| `test/features/navigation/mobile_navigation_test.dart` | 验证移动底部导航、尺寸和文本缩放 |
| `test/features/workspace/stock_workspace_controller_test.dart` | 验证选股、刷新、错误保留和竞态 |
| `test/features/home/home_workspace_integration_test.dart` | 验证选股后跨一级页面共享同一股票 |

---

### Task 1: 建立新的导航领域模型

**Files:**
- Modify: `lib/features/navigation/nav_destination.dart`
- Create: `lib/features/navigation/navigation_controller.dart`
- Create: `test/features/navigation/navigation_controller_test.dart`
- Modify: `test/features/navigation/nav_shell_test.dart`

**Interfaces:**
- Produces: `enum PrimarySection { overview, analysis, chart, trading, review, rules }`
- Produces: `NavigationController.selectPrimary(PrimarySection)`、`selectAnalysisTab(AnalysisTab)`、`selectTradingTab(TradingTab)`、`selectReviewTab(ReviewTab)`
- Produces: `List<NavDestination> desktopDestinations` 与 `mobileDestinations`

- [ ] **Step 1: 写导航结构和状态保持的失败测试**

```dart
test('desktop and mobile navigation expose the confirmed information architecture', () {
  expect(
    desktopDestinations.map((item) => item.label),
    ['总览', '个股分析', '专业 K 线', '交易', '复盘', '规则库'],
  );
  expect(
    mobileDestinations.map((item) => item.label),
    ['总览', '分析', 'K线', '交易', '复盘'],
  );
});

test('switching primary section preserves analysis tab', () {
  final controller = NavigationController();
  controller.selectAnalysisTab(AnalysisTab.future);
  controller.selectPrimary(PrimarySection.trading);
  controller.selectPrimary(PrimarySection.analysis);
  expect(controller.analysisTab, AnalysisTab.future);
});
```

- [ ] **Step 2: 运行测试并确认因新类型不存在而失败**

Run: `flutter test test/features/navigation/navigation_controller_test.dart test/features/navigation/nav_shell_test.dart`

Expected: FAIL，提示 `PrimarySection`、`NavigationController` 或新目的地列表未定义。

- [ ] **Step 3: 实现导航类型与控制器**

```dart
enum PrimarySection { overview, analysis, chart, trading, review, rules }
enum AnalysisTab { keyLevels, patterns, future, ai }
enum TradingTab { positions, ledger, predictions, statistics }
enum ReviewTab { daily, trade, history, backtest }

class NavigationController extends ChangeNotifier {
  PrimarySection primary = PrimarySection.overview;
  AnalysisTab analysisTab = AnalysisTab.keyLevels;
  TradingTab tradingTab = TradingTab.positions;
  ReviewTab reviewTab = ReviewTab.daily;

  void selectPrimary(PrimarySection value) {
    if (value == primary) return;
    primary = value;
    notifyListeners();
  }

  void selectAnalysisTab(AnalysisTab value) {
    if (value == analysisTab) return;
    analysisTab = value;
    notifyListeners();
  }

  void selectTradingTab(TradingTab value) {
    if (value == tradingTab) return;
    tradingTab = value;
    notifyListeners();
  }

  void selectReviewTab(ReviewTab value) {
    if (value == reviewTab) return;
    reviewTab = value;
    notifyListeners();
  }
}
```

将 `NavDestination` 改为保存 `PrimarySection section`、`String desktopLabel`、`String mobileLabel` 与 `IconData icon`，并显式构造六项桌面列表和排除 `rules` 的五项移动列表。

- [ ] **Step 4: 运行导航模型测试并确认通过**

Run: `flutter test test/features/navigation/navigation_controller_test.dart test/features/navigation/nav_shell_test.dart`

Expected: PASS。

- [ ] **Step 5: 提交导航领域模型**

```bash
git add lib/features/navigation/nav_destination.dart lib/features/navigation/navigation_controller.dart test/features/navigation/navigation_controller_test.dart test/features/navigation/nav_shell_test.dart
git commit -m "feat(nav): define grouped product navigation"
```

---

### Task 2: 重构响应式 AppShell

**Files:**
- Modify: `lib/features/navigation/app_shell.dart`
- Modify: `test/features/navigation/nav_shell_test.dart`
- Modify: `test/features/navigation/mobile_navigation_test.dart`

**Interfaces:**
- Consumes: `PrimarySection`、`desktopDestinations`、`mobileDestinations`
- Produces: `AppShell(selected: PrimarySection, onSelected: ValueChanged<PrimarySection>, currentStockLabel: String?)`

- [ ] **Step 1: 写桌面顶部导航和移动底部导航失败测试**

```dart
testWidgets('wide shell uses top navigation and no rail', (tester) async {
  tester.view.physicalSize = const Size(1440, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(buildShell(selected: PrimarySection.analysis));
  expect(find.byKey(const Key('desktop-primary-nav')), findsOneWidget);
  expect(find.byType(NavigationRail), findsNothing);
  expect(find.byType(Drawer), findsNothing);
});

testWidgets('phone shell exposes five 48dp bottom destinations', (tester) async {
  tester.view.physicalSize = const Size(375, 812);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(buildShell(selected: PrimarySection.overview));
  expect(find.byKey(const Key('mobile-primary-nav')), findsOneWidget);
  expect(find.text('规则库'), findsNothing);
  for (final label in ['总览', '分析', 'K线', '交易', '复盘']) {
    expect(tester.getSize(find.widgetWithText(InkResponse, label)).height, greaterThanOrEqualTo(48));
  }
});
```

- [ ] **Step 2: 运行测试并确认旧 Rail／Drawer 实现失败**

Run: `flutter test test/features/navigation/nav_shell_test.dart test/features/navigation/mobile_navigation_test.dart`

Expected: FAIL，桌面找不到 `desktop-primary-nav`，移动端仍使用 Drawer。

- [ ] **Step 3: 实现 900px 响应式外壳**

将构造函数收敛为：

```dart
const AppShell({
  super.key,
  required this.selected,
  required this.onSelected,
  required this.content,
  required this.accountMenu,
  required this.onOpenPalette,
  this.currentStockLabel,
});
```

使用 `LayoutBuilder` 以 `constraints.maxWidth >= 900` 分支。桌面返回 `Scaffold`，其 `appBar` 为 `68` 高的自定义顶栏，导航项用 `InkWell` + 底部 `3px` 蓝色边框表达选中态；内容使用 `Center > ConstrainedBox(maxWidth: 1392)`。移动端使用轻量 `AppBar` 与 `bottomNavigationBar`，每个目的地用 `Semantics(selected: ...)` 和最小 `48` 高触控区；账户菜单保留规则库、账户、设置和后台入口。

- [ ] **Step 4: 增加 1.3 倍文本和选择回调验证**

```dart
await tester.pumpWidget(
  MediaQuery(
    data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
    child: buildShell(selected: PrimarySection.overview),
  ),
);
await tester.tap(find.text('K线'));
expect(selected, PrimarySection.chart);
expect(tester.takeException(), isNull);
```

- [ ] **Step 5: 运行外壳测试并确认通过**

Run: `flutter test test/features/navigation/nav_shell_test.dart test/features/navigation/mobile_navigation_test.dart`

Expected: PASS，且无 overflow exception。

- [ ] **Step 6: 提交响应式外壳**

```bash
git add lib/features/navigation/app_shell.dart test/features/navigation/nav_shell_test.dart test/features/navigation/mobile_navigation_test.dart
git commit -m "feat(nav): add responsive top and bottom navigation"
```

---

### Task 3: 建立可防竞态的股票工作区控制器

**Files:**
- Create: `lib/features/workspace/stock_workspace_controller.dart`
- Create: `test/features/workspace/stock_workspace_controller_test.dart`
- Delete after migration: `lib/features/analysis/stock_analysis_controller.dart`
- Delete after migration: `test/features/analysis/stock_analysis_controller_test.dart`

**Interfaces:**
- Consumes: `StockCatalog`、`AShareMarketAdapter`、`StockAnalyzer`、`Security`、`OperationCycle`
- Produces: `enum StockWorkspaceStatus { idle, searching, loading, refreshing, ready, stale, offline, error }`
- Produces: immutable `StockWorkspaceSnapshot(security, market, analysis, cycle, generatedAt)`
- Produces: `search`、`selectStock`、`setCycle`、`refresh`

- [ ] **Step 1: 迁移现有成功、失败保留测试并新增快速切股失败测试**

```dart
test('a slow old request cannot overwrite a newer selected stock', () async {
  final market = ControlledMarket();
  final controller = StockWorkspaceController(
    catalog: MemoryStockCatalog(DemoAshareData.securities),
    market: market,
    analyzer: StockAnalyzer(),
    clock: () => DateTime(2026, 8, 27, 9),
  );
  final first = controller.selectStock(DemoAshareData.securities[0]);
  final second = controller.selectStock(DemoAshareData.securities[1]);
  market.complete(code: DemoAshareData.securities[1].code);
  await second;
  market.complete(code: DemoAshareData.securities[0].code);
  await first;
  expect(controller.current?.security.code, DemoAshareData.securities[1].code);
  expect(controller.current?.market.quote.security.code, DemoAshareData.securities[1].code);
});
```

同时保留现有断言：首次加载生成确定性分析；刷新失败保留 `lastSuccessful`；新选股加载期间 `current` 不得继续暴露旧代码的数据。

- [ ] **Step 2: 运行工作区测试并确认新控制器不存在**

Run: `flutter test test/features/workspace/stock_workspace_controller_test.dart`

Expected: FAIL，提示 `StockWorkspaceController` 未定义。

- [ ] **Step 3: 实现不可变快照和请求令牌**

```dart
class StockWorkspaceSnapshot {
  const StockWorkspaceSnapshot({
    required this.security,
    required this.market,
    required this.analysis,
    required this.cycle,
    required this.generatedAt,
  });
  final Security security;
  final MarketSnapshot market;
  final StockAnalysis analysis;
  final OperationCycle cycle;
  final DateTime generatedAt;
}

Future<void> selectStock(Security security) async {
  selected = security;
  current = null;
  final request = ++_requestVersion;
  status = StockWorkspaceStatus.loading;
  notifyListeners();
  await _load(request: request, preservePrevious: false);
}
```

`_load` 在写入前同时验证 `request == _requestVersion`、`selected?.code == loaded.quote.security.code`。`refresh` 以 `lastSuccessful` 作为保留值；根据 `MarketSourceInfo.state` 映射 `ready/stale/offline`，错误写入 `errorMessage` 和 `status`，但不得清空 `lastSuccessful`。

- [ ] **Step 4: 实现周期变化与搜索状态**

`setCycle` 立即保存新周期；有选中股票时重新分析同一行情，只有需要新 lookback 数据时才调用市场服务。`search` 仅更新搜索结果和 `searching` 标记，不覆盖当前成功行情状态。

- [ ] **Step 5: 运行工作区测试并确认通过**

Run: `flutter test test/features/workspace/stock_workspace_controller_test.dart`

Expected: PASS，包括反向完成两个请求的竞态用例。

- [ ] **Step 6: 提交工作区控制器**

```bash
git add lib/features/workspace/stock_workspace_controller.dart test/features/workspace/stock_workspace_controller_test.dart
git commit -m "feat(workspace): unify selected stock and analysis state"
```

---

### Task 4: 提供工作区作用域并迁移现有分析页面

**Files:**
- Create: `lib/features/workspace/stock_workspace_scope.dart`
- Modify: `lib/features/analysis/stock_analysis_screen.dart`
- Modify: `test/features/analysis/stock_analysis_screen_test.dart`
- Modify: `test/features/analysis/stock_analysis_navigation_test.dart`
- Delete: `lib/features/analysis/stock_analysis_controller.dart`
- Delete: `test/features/analysis/stock_analysis_controller_test.dart`

**Interfaces:**
- Consumes: `StockWorkspaceController`
- Produces: `StockWorkspaceScope.of(BuildContext)` 与 `StockWorkspaceScope.maybeOf(BuildContext)`
- Produces: `StockAnalysisScreen` 从作用域读取状态，不持有第二份股票控制器

- [ ] **Step 1: 写同一控制器实例和分析页面重建测试**

```dart
testWidgets('analysis descendants read the same workspace controller', (tester) async {
  late StockWorkspaceController first;
  late StockWorkspaceController second;
  await tester.pumpWidget(
    StockWorkspaceScope(
      controller: controller,
      child: Builder(builder: (context) {
        first = StockWorkspaceScope.of(context);
        return Builder(builder: (context) {
          second = StockWorkspaceScope.of(context);
          return const SizedBox();
        });
      }),
    ),
  );
  expect(first, same(controller));
  expect(second, same(controller));
});
```

- [ ] **Step 2: 运行分析页面测试并确认作用域不存在**

Run: `flutter test test/features/analysis/stock_analysis_screen_test.dart test/features/analysis/stock_analysis_navigation_test.dart`

Expected: FAIL，提示 `StockWorkspaceScope` 未定义或旧 `controller` 参数不匹配。

- [ ] **Step 3: 实现 InheritedNotifier 作用域**

```dart
class StockWorkspaceScope extends InheritedNotifier<StockWorkspaceController> {
  const StockWorkspaceScope({
    super.key,
    required StockWorkspaceController controller,
    required super.child,
  }) : super(notifier: controller);

  static StockWorkspaceController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StockWorkspaceScope>();
    assert(scope != null, 'StockWorkspaceScope not found');
    return scope!.notifier!;
  }
}
```

- [ ] **Step 4: 将 `StockAnalysisScreen` 映射到新状态**

页面从 `StockWorkspaceScope.of(context)` 读取 `current?.market`、`current?.analysis`、`selected`、`results`、`status` 和 `errorMessage`；搜索调用 `search`，选股调用 `selectStock`，周期调用 `setCycle`，重试调用 `refresh`。保持现有视觉组件不变，本任务不重做关键位页面布局。

- [ ] **Step 5: 运行全部分析测试并删除旧控制器**

Run: `flutter test test/features/analysis`

Expected: PASS，且 `rg "StockAnalysisController" lib test` 无结果。

- [ ] **Step 6: 提交作用域迁移**

```bash
git add lib/features/workspace/stock_workspace_scope.dart lib/features/analysis test/features/analysis
git commit -m "refactor(analysis): consume shared stock workspace"
```

---

### Task 5: 将 HomeScreen 接入聚合导航和共享工作区

**Files:**
- Modify: `lib/features/home/home_screen.dart`
- Create: `test/features/home/home_workspace_integration_test.dart`
- Modify: `test/features/home/home_screen_test.dart`
- Modify: `test/features/product_surface_test.dart`

**Interfaces:**
- Consumes: `NavigationController`、`StockWorkspaceController`、`StockWorkspaceScope`
- Produces: 六个一级工作区映射；旧模块通过二级页签或账户菜单进入

- [ ] **Step 1: 写跨页选股同步失败测试**

```dart
testWidgets('selecting a holding updates analysis and chart to the same stock', (tester) async {
  final harness = HomeHarness.withDemoStock('600519');
  await tester.pumpWidget(harness.app);
  await tester.tap(find.byKey(const Key('holding-600519')));
  await tester.pumpAndSettle();
  expect(harness.navigation.primary, PrimarySection.analysis);
  expect(harness.workspace.selected?.code, '600519');
  await tester.tap(find.text('专业 K 线'));
  await tester.pumpAndSettle();
  expect(find.textContaining('600519'), findsWidgets);
  expect(harness.workspace.selected?.code, '600519');
});
```

为便于注入测试依赖，给 `HomeScreen` 增加可选 `HomeDependencies`；生产默认值仍组装现有持久化仓库和远程服务。

- [ ] **Step 2: 运行集成测试并确认旧 `_selected`／`_chartStockCode` 架构失败**

Run: `flutter test test/features/home/home_workspace_integration_test.dart test/features/home/home_screen_test.dart`

Expected: FAIL，提示 `HomeDependencies` 不存在或跨页股票不一致。

- [ ] **Step 3: 替换 HomeScreen 的局部导航和股票字段**

新增并持有：

```dart
late final NavigationController _navigation;
late final StockWorkspaceController _stockWorkspace;
```

删除 `_selected`、`_chartStockCode`、`_onAnalysisSelectionChanged` 和 `_MarketSnapshotLoader`。图表直接使用 `_stockWorkspace.current!.market.dailyCandles`，标注控制器只监听 `_stockWorkspace.selected?.code` 切换股票。

- [ ] **Step 4: 映射六个一级工作区**

`overview` 使用现有 `_OverviewWorkspace`；`analysis` 根据 `analysisTab` 映射关键位、盈利模式、未来指标、AI；`chart` 使用 `ProfessionalChartScreen`；`trading` 根据 `tradingTab` 映射组合、流水、预测、统计；`review` 根据 `reviewTab` 映射复盘和回测；`rules` 映射知识／规则管理。未加载行情的子页统一读取工作区空态或错误态，不再自行调用 `market.snapshot`。

- [ ] **Step 5: 迁移命令面板和账户菜单**

命令面板选择股票时调用 `selectStock` 后选择 `PrimarySection.analysis` 和 `AnalysisTab.keyLevels`。账户菜单中的专业 K 线、规则回测等旧 key 改为控制器组合动作；规则库作为桌面一级入口，同时保留在移动账户菜单。

- [ ] **Step 6: 运行首页、导航和产品表面测试**

Run: `flutter test test/features/home test/features/navigation test/features/product_surface_test.dart`

Expected: PASS，且 `rg "_chartStockCode|var _selected =" lib/features/home/home_screen.dart` 无结果。

- [ ] **Step 7: 提交 HomeScreen 集成**

```bash
git add lib/features/home/home_screen.dart test/features/home test/features/product_surface_test.dart
git commit -m "feat(home): connect grouped navigation to stock workspace"
```

---

### Task 6: Phase 1 完整验证与文档回写

**Files:**
- Modify: `docs/handoff/2026-08-14-stockcal-current-status.md`
- Modify: `docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md`

**Interfaces:**
- Consumes: Tasks 1–5 的完整实现
- Produces: 可复核的 Phase 1 验证记录和 Phase 2 输入边界

- [ ] **Step 1: 运行格式与差异检查**

Run: `dart format --output=none --set-exit-if-changed lib test && git diff --check`

Expected: 两条命令均以 0 退出；若格式命令列出文件，先执行 `dart format lib test` 后重跑。

- [ ] **Step 2: 运行全量测试和静态分析**

Run: `flutter test && flutter analyze`

Expected: 全量测试 0 失败，静态分析显示 `No issues found!`。

- [ ] **Step 3: 构建 Web release**

Run: `flutter build web --release`

Expected: `build/web` 构建成功且命令以 0 退出。

- [ ] **Step 4: 完成真实操作路径检查**

在 `1440×900` 检查：顶栏六项、搜索选股、分析到 K 线股票一致、规则库入口。

在 `375×812` 且文本 `1.3x` 检查：底部五项、账户菜单规则库、无页面横向溢出、触控目标可用。
记录浏览器控制台错误；存在运行时错误或关键路径失败时不得标记完成。

- [ ] **Step 5: 回写阶段状态**

在设计文档「实施阶段」中仅将第 1 阶段标记为完成，并记录测试数、分析结果、构建结果和目视检查环境。交接文档把旧的「原型接近完成」表述替换为「Phase 1 导航与工作区完成；页面原型迁移仍待 Phase 2–7」。

- [ ] **Step 6: 提交验证记录**

```bash
git add docs/handoff/2026-08-14-stockcal-current-status.md docs/superpowers/specs/2026-08-26-stockcal-prototype-realignment-design.md
git commit -m "docs: record navigation workspace verification"
```

---

## 自检结果

- **Spec coverage:** Phase 1 覆盖桌面／移动导航、导航状态保持、共享股票、周期、刷新、错误保留、快速切股竞态与跨页一致性。总览重排、分析四页视觉、K 线完整交互、交易、复盘、规则库和全站截图属于 Phase 2–7，将分别形成独立计划。
- **Placeholder scan:** 每个任务均给出具体失败测试、实现接口、验证命令和提交边界，没有待补内容或跨任务省略。
- **Type consistency:** 全计划统一使用 `PrimarySection`、`AnalysisTab`、`TradingTab`、`ReviewTab`、`StockWorkspaceController` 和 `StockWorkspaceSnapshot`；旧 `String module` 与 `StockAnalysisController` 在迁移完成后删除。
