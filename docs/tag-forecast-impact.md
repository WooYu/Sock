# 标签对价格预估的作用与分类调整

审计日期：2026-10-24。范围：自动 MA/BOLL 外推、多周期规则库、当前资料标签和原文片段；不将合成行情测试当成真实行情预测成绩。

## 原有作用

自动预估的 `use-automatic-forecast.ts` 原先固定传入 `registry: []`，不读取笔记标签。多周期 `buildScenarioRuleRegistry` 虽读取片段的原文版本和引用，但按固定片段 ID 关联规则，也不读取 `tags` 的含义。引擎中的参数外推及价位合并由行情、计算方法和人工情景决定，规则层另行决定入场过滤及风险参考。

冻结上涨、下跌、横盘三组各 30 根合成 K 线，分别进行以下对照：

| 对照 | 原始指标参考价 | 合并价位 | 规则判断 |
| --- | --- | --- | --- |
| 删除所有资料标签，保留原文引用 | 完全一致 | 完全一致 | 完全一致 |
| 替换为不相干的资料标签 | 完全一致 | 完全一致 | 完全一致 |
| 删除整个原文规则注册表 | 完全一致 | 完全一致 | 改变／缺少原文 |

因此，原有资料标签对价格数值的直接作用为 **0**；不能将已有规则的作用算成标签的贡献。该实验没有检验真实未来行情，不能给出命中率或准确率提升。

当前目录有 146 篇笔记、248 个片段。当前词典投影后 65 篇没有资料标签，不表示它们没有正文。已有 12 条条件规则实际绑定 10 个片段，来自 5 篇笔记：片段覆盖约 4.0%，整篇覆盖约 3.4%。其余资料不会因为带有 MA、BOLL 等主题词就自动成为价格计算公式。

## 已实现的分类逻辑

保留用户确定的“内容分类／分析主题”及 AI 最多 3 标签规则。新增独立的、只读的“预估作用”分类，用于检索及执行条件路由：

| 预估作用 | 当前记录数（整篇与片段合计，可重叠） | 用途 |
| --- | ---: | --- |
| 参数计算候选 | 8 | 定位公式／计算思路，待明确计算定义和验证 |
| 入场条件 | 48 | 定位参与或不参与条件；已编写的过滤规则可执行 |
| 目标／压力参考 | 82 | 定位价位用途；已确认模式时可提供原文压力参考 |
| 持仓底线 | 31 | 区分持有边界与买入目标 |
| 退出／期限条件 | 62 | 定位止损、退出、期限及例外 |
| 适用场景 | 188 | 定位趋势、模式及适用前提 |
| 案例验证 | 7 | 定位复盘材料，不当作前瞻验证 |
| 尚无预估用途依据 | 146 | 不从标题、附件或元数据补造用途 |

候选用途需要原文逐字引用：引用必须出现在摘要中，或与同原文哈希、同文件、同记录的冻结目录引用逐字且逐行匹配。后者用于摘要只有开头、有效依据位于后文的情况。附件链接、元数据、补充说明、未绑定的新引用均不作为用途证据。

已经绑定源文片段的既有规则可获得“已关联条件规则”状态，并按动作归入相应作用分类。这个状态只表示有已编写的条件定义，**不表示本次行情适用**。人工趋势／模式确认、原文缺失、观察窗口未定义、例外不明确、人工停用等仍由原规则引擎检查；候选关键词不能生成新公式或新交易规则。

标签页面提供预估作用筛选、每类的引用及关联规则；导出在独立的 `forecastRoles` 字段保留派生版本、原文哈希、标签版本和引用。资料标签、人工修订、历史记录及研究源文绑定不被重写。提取脚本批量与纠错提示中残留的“最多 5 标签”也已统一为当前 3 标签约束，没有重新调用付费提取。

## 预估流程中的实际变化

自动预估异步加载按预估作用筛选的 12 条既有原文规则，显示已采用条件、源文引用、未采用原因及风险价位。市场请求与规则加载可并行；规则加载失败时明确说明只提供指标外推。

- 下跌合成行情：原先空注册表不产生入场过滤；接入分类路由后，日 MA20 下方的新参与过滤触发。候选价格仍可核对，但标记“入场过滤未通过 · 仅作指标参考”。
- 下跌反抽模式：没有确认时不产生原文 MA5 压力位；确认下跌背景及对应模式后，合成案例产生 17.30 的日 MA5 压力参考，附原文引用。
- 未确认三期开口等条件时，相关规则不会因标签已核对或关键词命中而采用。

这次改变了**价格参考的适用条件、用途和风险判断**。MA／BOLL 外推数值仍由行情公式计算；没有为使数字改变而给标签随意加权。是否提高真实预测准确率，仍须使用事前保存预测与后续真实结果独立验证。

## 验证入口

消融与用途影响：`frontend/src/features/scenario/tag-forecast-impact.test.ts`。

分类证据、历史兼容、界面与自动预估：`note-forecast-classification.test.ts`、`note-tags.test.ts`、`note-tag-workbench.test.tsx`、`scenario-rules.test.ts`、`use-automatic-forecast.test.tsx`、`automatic-forecast-panel.test.tsx`；提取兼容由现有提取测试覆盖。

桌面与手机交互：`frontend/e2e/forecast-note-roles.spec.ts`，使用隔离 API 写入的测试夹具与本地构建。

最终结果：9 个文件共 66 项针对性 Vitest 测试通过；TypeScript 与生产构建通过；本次修改文件的 ESLint 零问题。C、D 两个主题的桌面／手机浏览器验证共 8 次通过，新增导出内容的桌面／手机验证另 2 次通过；截图已检查，页面无横向溢出。全量 lint 仅有原先 `note-tag-back.spec.ts` 的导航警告；构建保留原有 3 条动态文件追踪警告。

复现核心检查（`frontend` 目录）：

```powershell
node node_modules/vitest/vitest.mjs run src/features/knowledge/note-forecast-classification.test.ts src/features/knowledge/note-tags.test.ts src/features/knowledge/note-tag-workbench.test.tsx src/features/scenario/tag-forecast-impact.test.ts src/features/scenario/scenario-rules.test.ts src/features/research/use-automatic-forecast.test.tsx src/features/research/automatic-forecast-panel.test.tsx src/features/knowledge/note-tag-reextraction.test.ts src/lib/knowledge/note-tag-extraction.test.ts --pool=threads --maxWorkers=2
npm run build
# 启动本地构建后，使用已安装的Edge执行；分别设置主题c、d
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_BASE_URL='http://localhost:3200'
$env:PLAYWRIGHT_THEME='c'
node node_modules/@playwright/test/cli.js test e2e/forecast-note-roles.spec.ts --workers=2 --trace=off
```
