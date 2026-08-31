# StockCal 设计系统层（Phase 0：Token + 组件库）

> 状态：Phase 0 已实施。Token 与共享组件继续有效；「保留左侧 rail + 独立页面」的衔接决策已被 `2026-08-26-stockcal-prototype-realignment-design.md` 替代。
> 参考基准：`docs/stockcal-redesign-prototype.html` + `docs/stockcal-prototype.css`（线上站 `https://stock-key-levels.amos369.chatgpt.site/` 的完整 DOM/CSS 快照）。

## 与既有 spec 的关系

本文**接替** `2026-08-21-stockcal-keyline-1to1.md` 的视觉系统部分，其余部分（导航结构、数据模型扩展、各页功能映射）继续有效。

被推翻的两条前提：

1. 该文原则 4 称「深海军蓝 `#0B1220` + 薄荷青 `#47D7C7` 已对齐参考站深色，保持不变」。实测原型 CSS 中 `prefers-color-scheme` 出现 0 次、`data-theme` 0 次，无任何深色取值——**参考站是纯浅色蓝**。该前提基于 `docs/reference/stock-key-levels-reference.md` 的早期人工分析，与抓取到的实际样式表不符。
2. 该文将方向强度定为半圆仪表盘。原型实际使用线性 `.gauge-track`（6px 三段渐变 + 2px 游标）。此项在后续「关键位分析」期修正，不属本期范围。

## 目标

把原型 CSS 里已经存在的视觉语言，固化成一套 Flutter token + 组件，使后续九个业务屏的改造是「填数据」而非「各自造轮子」。

**判定依据**：原型 CSS 中三处指标条（`.portfolio-metrics` / `.stats-metrics` / `.backtest-metrics`）规则逐字相同，两处表格（`.portfolio-table` / `.backtest-table`）仅列宽模板不同。原型作者本身按组件复用绘制，本期只是把这层还原到代码里。

## 已确认决策

| 议题 | 决定 |
|---|---|
| 布局模型 | 保留现有左侧 rail + 独立页面，**不**改成原型的长滚动锚点结构 |
| 切分方式 | 先做组件库（本期），再逐屏改造 |
| 浅色配色 | 完全采用原型取值（canvas `#f5f6f8` / accent `#4057e8` 蓝） |
| 深色配色 | 保留深色主题，配色**参考 X 的设计**，取值待浅色落地后单独确定 |
| 盈亏配色 | 照原型「两套共存」：行情方向红涨绿跌，损益金额绿盈红亏 |
| 组件画廊 | 做，dev-only 入口 |
| 字号 | 照抄原型，唯一例外见「字号阶」一节 |

## 一、Token 层

`lib/theme/design_tokens.dart`：`StockCalTokens extends ThemeExtension<StockCalTokens>`。

### 颜色槽位（浅色取值 = 原型实测值）

**底与面**

| 槽位 | 值 | 用途 |
|---|---|---|
| `canvas` | `#f5f6f8` | 页面底 |
| `surface` | `#ffffff` | 卡片 / 面板 |
| `surfaceSunken` | `#fbfcfe` | 指标格、持仓卡内凹背景 |
| `surfaceHeader` | `#f7f8fb` | 表头行 |
| `surfaceInset` | `#eef0f4` | 分段 tab 槽底 |

**线**

| 槽位 | 值 | 用途 |
|---|---|---|
| `line` | `#e7e9ef` | 面板 / 卡片边框 |
| `softLine` | `#eef0f5` | 卡内分隔、来源行之间 |
| `tileLine` | `#e3e6ed` | 指标格 / 表格边框 |

**字**

| 槽位 | 值 | 用途 |
|---|---|---|
| `ink` | `#172033` | 主文字 |
| `muted` | `#6c7486` | 次要文字 |
| `faint` | `#9299a8` | 标签 / 单位 |
| `eyebrowInk` | `#9198a7` | eyebrow 小标题 |

**行情方向**（红涨绿跌）

| 槽位 | 值 |
|---|---|
| `rise` / `riseSoft` | `#e94052` / `#fff1f2` |
| `fall` / `fallSoft` | `#0a9f6f` / `#eaf9f3` |

**损益金额**（绿盈红亏）

| 槽位 | 值 |
|---|---|
| `profit` / `profitSoft` | `#27875d` / `#eefaf3` |
| `loss` / `lossSoft` | `#d24a55` / `#fff1f2` |

> 两套并存是原型的实际行为，非笔误：同页中 `最高 32.96` 走 `--rise`（红），`浮动盈亏 +1170.00` 走 `.positive`（绿）。全局规则 `.positive,.buy-text{color:#27875d}` 已核实。

**强调**

| 槽位 | 值 |
|---|---|
| `accent` / `accentSoft` | `#4057e8` / `#edf0ff` |
| `amber` / `amberSoft` | `#e39b2e` / `#fff8e9` |

**K 线指标调色板** `indicatorPalette`

`ma5 #d6a12a` · `ma10 #4e9bd6` · `ma20 #a46ee8` · `ma30 #d56c9a` · `ma60 #45a88b` · `ma120 #e17b43` · `ma250 #65738a` · `boll #6678e5`

（现硬编码于 `professional_chart_screen.dart`，本期收进 token；该文件本期不改，仅在其改造期切换来源。）

### 形

| 槽位 | 值 |
|---|---|
| `radiusPanel` / `radiusCard` / `radiusTile` / `radiusButton` / `radiusChip` | 11 / 9 / 7 / 8 / 5 |
| `hairline` | 1 |
| `panelShadow` | `0 3px 12px rgba(30,42,70,.03)` |
| `raisedShadow` | `0 10px 30px rgba(30,42,70,.06)` |

### 字号阶

`eyebrow 9`（w750 / letterSpacing .14em / 大写）· `micro 10` · `label 10` · `body 11` · `bodyLg 12` · `metric 17` · `metricLg 18` · `h2 18`

**唯一偏离原型处**：原型中来源明细行等使用 `font-size: 8px`。Flutter 中 8 逻辑像素在手机上不可读且不满足无障碍要求，故 `micro` 定为 10。其余字号照抄。

### 深色

`StockCalTokens.dark()` 建立**全部同名槽位**。最终取值参考 X 设计（X 自身有 Dim `#15202B` 与 Lights out 纯黑两套），在浅色全部业务屏落地后单独确定。

本期填入**过渡取值**，来源为 `docs/stockcal-redesign-prototype-v1.html` 的深色块，使深色主题在过渡期可用而非空白：

| 槽位 | 过渡值 | 槽位 | 过渡值 |
|---|---|---|---|
| `canvas` | `#0A0E15` | `ink` | `#E7ECF5` |
| `surface` | `#111623` | `muted` | `#8B94A8` |
| `surfaceSunken` | `#0D111A` | `faint` | `#5A6478` |
| `surfaceHeader` | `#151B29` | `eyebrowInk` | `#5A6478` |
| `surfaceInset` | `#1A2130` | `accent` / `accentSoft` | `#5b74ff` / `rgba(91,116,255,.18)` |
| `line` | `#1E2636` | `rise` / `riseSoft` | `#F0525D` / `rgba(240,82,93,.15)` |
| `softLine` | `#182030` | `fall` / `fallSoft` | `#2BB673` / `rgba(43,182,115,.15)` |
| `tileLine` | `#2A3346` | `amber` / `amberSoft` | `#e39b2e` / `rgba(227,155,46,.16)` |

`profit` / `loss` 深色沿用 `fall` / `rise` 的亮度调整值 `#3FBF85` / `#E8606B`；`indicatorPalette` 深浅共用。

代码中以 `// 过渡取值，待 X 配色确定后替换` 单点标注，便于后续整段替换。

本期对深色的硬性要求：**结构完整**——任何组件在深色下都不得因槽位缺失而崩溃或退回硬编码色。

## 二、组件库

`lib/widgets/design/`，十个组件。全部为表现型：入参是数据与回调，**不含业务逻辑、不访问 repository、不做格式化以外的计算**。

准入标准：**原型中出现 ≥2 次且 CSS 规则同构**。仅出现一次的（如 `.decision-strip` 渐变大条）不做抽象。

| 组件 | 还原自 | 变体 |
|---|---|---|
| `SectionHeading` | `.section-heading` + `.eyebrow` | 尾部插槽：徽章 / 图例 / 状态点 / 无 |
| `PanelCard` | `.panel` | — |
| `MetricStrip` | `.portfolio-metrics` ≡ `.stats-metrics` ≡ `.backtest-metrics` | `columns`、每格 `tone`（neutral/profit/loss/risk） |
| `LedgerTable` | `.portfolio-table` ≡ `.backtest-table` | 列 flex 权重、行可点 |
| `SegTabs` | `.cycle-tabs` / `.period-switches` / `.trade-side-tabs` | `pill` / `chip` / `duo` |
| `ScoreBar` | `.mode-score` / `.gauge-track` | `bar`（渐变条 + mono 数）/ `gauge`（三段渐变 + 游标） |
| `StatusBadge` | `.panel-note` `.demo-tag` `.trade-badge` `.history-status` `.status-dot` | tone 枚举 + 是否带光晕圆点 |
| `SwitchPill` | `.switch`（30×17，钮 11，位移 13） | on / off |
| `AppButton` | `.button` | `primary` / `ghost` |
| `MonoText` | `font-variant-numeric: tabular-nums` | — |

**不在本期**（屏级组合，各自在所属期用上述原语拼出）：`zone-card`、`mode-option`、`rule-card`、`future-card`、`history-card`、`ai-pipeline`、K 线面板、`decision-strip`。

### 响应式

`MetricStrip` 与 `LedgerTable` 需还原原型断点行为：指标条 6 列 / 5 列在窄屏塌为 2 列，且末格跨 2；表格列宽模板在窄屏切换到紧凑值。断点以 `LayoutBuilder` 约束宽度判定，不用 `MediaQuery`，以便组件在任意容器内可用。

## 三、与现有代码的衔接

原则：**本期不改动任何业务屏**。`lib/features/**` 下仅两处例外，均与业务无关：新增 `lib/features/dev/design_gallery_screen.dart`，以及在设置页加一个进入画廊的入口。

### `StockCalColors`（41 处引用）

类保留，仅替换其中常量取值为新配色，加 `@Deprecated` 注释指向 token。41 处引用无需修改即自动获得新配色。逐屏改造时按屏退役。

### `lib/core/display.dart`

`gainColor` / `lossColor` 已接受 `BuildContext`，改为读 token 属零成本替换。

**语义保持不变，避免静默翻转九个屏的颜色**：

| 函数 | 本期处理 |
|---|---|
| `gainColor` / `lossColor` | 语义不变，取值重指向 `rise` / `fall` |
| `pnlColor` | 行为不变，仍走 `gainColor` / `lossColor` |
| `profitColor` / `lossAmountColor` | **新增**，取值 `profit` / `loss`；本期建立但零调用点 |

现有 24 个调用点混杂渲染「行情涨跌」与「损益金额」两种语义，只有在改造具体屏时才能逐点判定。故新增的一对本期不启用，由各屏改造期决定切换。

### `lib/theme/stockcal_theme.dart`

`buildStockCalTheme(Brightness)` 签名不变，内部改为从 token 推导 ThemeData（`colorScheme.primary = accent`、`scaffoldBackgroundColor = canvas` 等）。

### 中间状态（已确认接受）

本期合并后，九个业务屏经由 ThemeData 自动变为浅色蓝，但版式仍为旧版。存在一个「配色已对、版式未对」的过渡阶段。

## 四、组件画廊

`lib/features/dev/design_gallery_screen.dart`：十个组件的各状态（各 tone、开/关、宽/窄约束）排列展示。

- 不进主导航，从设置页入口进入。
- 用途：对照原型截图核对还原度；深色取值确定后，一屏内即可校验全部组件。

## 五、测试策略

按 TDD，每个组件先写失败测试。

### Token 契约 `test/theme/design_tokens_test.dart`

- 逐值断言 `light()` 每个槽位等于本文档所列取值——构成「还原度」的可执行契约。
- `dark()` 断言槽位齐全且非 null（取值待定，不断言具体值）。
- `lerp` / `copyWith` 的 ThemeExtension 契约。

### 组件 `test/widgets/design/*_test.dart`

**取色断言写法**：pump 一个携带已知 token 取值的 Theme，再取实际渲染色与该 token 比对。断言的是「组件读取了 token」而非「组件是某颜色」。这是防腐核心——填入深色取值时，任何硬编码都会使对应测试失败。

各组件断言要点：

- `SectionHeading`：eyebrow 大写与字距；尾部插槽可选且缺省不占位。
- `PanelCard`：边框 1px、圆角 11、背景取 `surface`。
- `MetricStrip`：6 列在窄约束下塌为 2 列且末格跨 2；`tone: profit` 时取值走 `profit`。
- `LedgerTable`：表头背景取 `surfaceHeader`；列 flex 权重；行点击回调触发。
- `SegTabs`：三变体各自 active 取色；点击回调返回 index。
- `ScoreBar`：`bar` 宽度比例 = score%；`gauge` 游标位置 = value/100。
- `Badge`：每个 tone 的前景 / 背景成对正确。
- `SwitchPill`：on/off 位移 13px 与轨道色；点击回调触发。
- `AppButton`：`primary` / `ghost` 取色；disabled 不触发回调。
- `MonoText`：`fontFeatures` 含 `tabularFigures`。

### 既有测试

`test/theme/stockcal_theme_test.dart` 与 `test/features/chart/chart_theme_test.dart` 断言了旧青色取值，随配色变更同步更新断言。仓库无 golden 测试，不涉及基线图重刷。

## 六、验收标准

| 检查 | 门槛 |
|---|---|
| `flutter test` | 全绿（现有 179 + 本期新增） |
| `flutter analyze` | 0 issue |
| `grep -c '0xFF' lib/widgets/design/*.dart` | 全部为 0（颜色字面量只许出现在 `design_tokens.dart`） |
| 九个业务屏 | 能启动、不崩溃；配色变为浅色蓝，版式仍为旧版 |
| 组件画廊 | 可从设置进入，十个组件各状态渲染正常 |

验收结果以本次实际运行输出为准，不引用历史记录。

## 七、涉及文件

**新增**

```
lib/theme/design_tokens.dart
lib/widgets/design.dart                       (barrel)
lib/widgets/design/section_heading.dart
lib/widgets/design/panel_card.dart
lib/widgets/design/metric_strip.dart
lib/widgets/design/ledger_table.dart
lib/widgets/design/seg_tabs.dart
lib/widgets/design/score_bar.dart
lib/widgets/design/status_badge.dart          (命名避开 material.Badge 冲突)
lib/widgets/design/switch_pill.dart
lib/widgets/design/app_button.dart
lib/widgets/design/mono_text.dart
lib/features/dev/design_gallery_screen.dart
test/theme/design_tokens_test.dart
test/widgets/design/*_test.dart               (10 个)
```

**修改**

```
lib/theme/stockcal_theme.dart                 从 token 推导
lib/core/display.dart                         读 token + 新增 profitColor/lossAmountColor
lib/features/admin/settings_admin_workspace.dart   仅加画廊入口
test/theme/stockcal_theme_test.dart           更新断言
test/features/chart/chart_theme_test.dart     更新断言
```

**明确不动**：`lib/features/**` 下除上述画廊与设置入口外的全部文件、`lib/widgets/metric_card.dart`。

## 八、后续期次（本文不覆盖）

组件库落地后，按屏推进，各期单独出 plan：关键位分析 / 盈利模式 / AI 策略中心 / 经验规则 / 未来指标 / 预测记录 / 当日复盘 / 组合总览 / 交易与盈亏 / 统计图表。原型中另有三块当前无对应页面的内容——公司行为调整（除权除息复权）、策略效果（回测，代码已存在但未入导航）、未来三日多路径推演——在各自期次内评估。深色取值确定亦排在此阶段。
