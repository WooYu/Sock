# 掌阅科技多周期情景分析：首版证据

2026-10-16新增用户指定的[价格参考位验证标准](price-evaluation-criteria.md)：与实际开高低收逐项比较，严格小于1%记为接近；盘中反复支撑、压力另核证据。含14日收盘日线回放对照15日行情的完整示例，尚未接入应用评分界面。

同日完成[AI学习记录001](learning-2026-10-16/README.md)：掌阅科技60个日线样本，40个用于归纳、20个作时序验证；候选规律在验证中未超过更强的固定方法，保留证据且未启用。支持独立复核，尚非后台持续自动学习服务。

新增[146篇笔记的逐篇语义研究](note-study-2026-10-16/README.md)：1367个标签赋值、271项候选主张与1863次原文引用核对，整理8项优先计算研究入口。建议与原标签分开保留，原始notes及当前产品目录不变；附件和缺失定义明确标注，尚未证明预测效果提升。

已冻结真实、不复权的日线、1小时和30分钟行情，各640根；来源为腾讯公开延时行情。采集时间、源时间、最新完整柱、参数、文件字节数和SHA-256见 [manifest.json](manifest.json)。本目录与浏览器验收中的合成数据分别保存。

## 页面使用

1. 在工作台选择掌阅科技（603533），点击图表下方“开始多周期分析”。
2. 先核对日线状态，在“核对形态与模式”中填写方向、攀升／飙升、葛起点、语境、模式、持仓及底线；填写实际依据。候选状态不会自动变成人工确认。
3. 大阳线后依次点击“看1小时”“继续看30分钟”。小周期状态和MA独立显示，日线底线保留原周期。未收盘柱的情景单列“盘中暂估”。
4. 比较平均增量、最近一根增量、收盘情景滚动重算；可填写有明确价位依据的延续／回撤收盘路径。保存快照后，历史只读，修订追加版本，可导出完整依据。

原文标签入口为 `/knowledge?view=notes`。每条原则可查看原文和采用／不适用／条件不足／重复／人工停用的理由。选择小时底线会明确标为人工选择，不把日线笔记自动改成小时原则。

## 事后固定案例

本次人工选择 **2026-09-11** 大阳线作为算例：前收23.48，开23.25，高25.79，低23.16，收25.04，成交量51,418,400。该日及其前后分钟历史均在冻结数据内。选择发生在采集之后，存在选择偏差；没有声称这是当时预先固定的样本。

[comparison.json](comparison.json) 保存完整 `kind: replay` 快照、真实选择时间、270个逐项对照及汇总：三个周期 × 六个指标 × 三个期限 × 五组方法／路径。MA5的平价滚动值另经独立算式核对，日线后三根依次为24.456、24.522、24.728。

条件路径均只取原点已知价格：基准为原点收盘；延续为原点最高价；回撤为原点开收盘实体中部。它们是后来构造的反事实条件，未赋予概率，也未按后续价格选取最优路径。

下表是这个案例日线后三根的平均绝对指标误差，单位为元。它比较的是未来MA／BOLL参数，不能解释成未来股价误差或盈利。

| 方法／条件 | 日MA5误差 | 日BOLL上轨误差 |
| --- | ---: | ---: |
| 三点平均增量 | 0.5373 | 0.2095 |
| 最近一根增量 | 0.7073 | 0.4646 |
| 收盘保持25.04 | 0.4720 | 0.3244 |
| 收盘保持原点高点25.79 | 0.7720 | 0.5970 |
| 收盘保持实体中部24.145 | 0.1227 | 0.0657 |

该例中滚动基准的MA5误差较小，但BOLL上轨误差大于平均增量。单个事后样本无法证明任一方法有预测优势；也不能据回撤路径误差最小，倒推当时应选该路径。

没有已核实的交易所日历，应用中的未来日期保留未知。报告使用冻结行情的后续同周期柱进行事后相对编号对齐，没有把该股票的缺日推断为全市场休市。历史源后来可能修订，无法重建当时实际接收到的版本或盘中信息；不复权数据也未做除权事件校正。

没有在窗口前保存的live计划，`forwardCoverage.eligible` 为false，不报告事前范围覆盖率、成交先后、胜率或净收益。后续应先保存执行窗口前的快照，再累计不同趋势及葛阶段样本。

## 复跑

在 `frontend/` 运行（使用已有本机行情API，不能指向远程服务）：

```bash
node --test scripts/capture-scenario-inputs.test.mjs
node scripts/capture-scenario-inputs.mjs --symbol 603533 --output /tmp/zhangyue-new-capture
node scripts/replay-scenario-evidence.mjs --input ../research/zhangyue-scenario-v1 --origin 2026-09-11 --output /tmp/zhangyue-replay.json
```

采集和回放均拒绝覆盖已有冻结输出；原始输入的哈希在回放前核验。公开行情网络曾读取失败，重启Next并设置 `NODE_USE_ENV_PROXY=1` 后实际读取成功。必须保留代理和CA校验；不通过关闭TLS校验恢复行情。

## 2026-10-15：跨周期1%平均价

工作台新增“跨周期综合结果”。当前计算方法下，日线、1小时与30分钟的未来参考位按价格分组；整组最高与最低价之差除以两者平均价不超过1%，才合为一组，代表值取所有唯一参考位的算术平均。例如10.00、10.01、10.08合为10.03；10.00、10.09、10.18会分组，避免相邻价位一路串联。

综合结果只采用选定的一种计算方法，滚动方法每个周期只采用选定的一条路径，避免重复混合对照方法或互斥情景。可展开查看原始价格、周期、指标及未来根数。尚未读取的30分钟可通过“汇总三个周期”加入；未纳入、缺项与离线缓存状态单列。盘中暂估不参与正式综合价。

新快照保存`consolidation`定义、方法及各周期路径，重载后展示冻结结果；旧快照和本目录原有comparison.json中的旧合并值不变。本更新没有改变历史案例的原始数据、逐项指标误差或覆盖结论，也不把1%的分组阈值当作预测误差保证。

本次更新验证：533项Vitest测试、lint、生产构建通过；桌面／手机浏览器回归17项通过，3项按预设设备项目跳过。独立审查发现的十进制1%边界误拆问题已先复现失败、再修正；9.95与10.05可合并为10.00，略超边界仍分组。另用真实公开行情在桌面1280×900和手机390×844核对三周期54个正式参考位的分组、均值和来源；无页面异常或框架错误层，旧后端规则／预测未配置的502与多周期综合模块分别记录。


## 2026-10-15：收盘价与单日上下档位

在“跨周期综合结果”中，以最近完整、不复权日K收盘价为基准，按用户更正，上下分别展示范围内全部实际计算的合并价位，数量由计算结果决定。每个价位显示相对基准的涨跌百分比，使用0.01元价格单位；取消档数选择、截断和等分补位；某侧没有有效价位时明确显示为空。越界原值不截断到边界，可展开“查看全部原始合并价位”核对。

普通主板10%、创业板／科创板20%、北交所30%按代码提供常规假设；当前行情未提供完整风险状态、上市初期例外或除权参考价验证。特殊名称与未知代码不会直接套用普通规则，可手动选择5／10／20／30%，或设为不限幅／待核实并暂停生成有边界档位。区间只对应基准收盘后的一个交易日，未来K线根数仍分别按来源周期计数。若已核实日历或15:00分钟K线证明日线收盘过期，暂停档位并提示刷新；低价取整导致单侧区间退化时提示核实最小变动规则。

新快照保存`dailyPriceLadder`的`daily-close-levels-v2`定义、基准收盘与日期、规则来源、区间、全部实际上下价位、涨跌百分比及越界组ID，不保存固定档数。历史只读且使用冻结的规则标签；完整重算校验拒绝篡改的价格、百分比或规则。旧`daily-close-ladder-v1`记录按当时固定档数和补位结果保留，并在页面标注历史口径；以旧版本为基础修订时采用新的实际数量口径。

更正前的历史验证记录（2026-10-15 10:33北京时间，固定5档口径，非当前展示规则）：掌阅科技603533基准为10月14日完整日K收盘29.92元；常规±10%假设下，单日区间26.93～32.91元。选择每侧5档得到上方30.59（+2.24%）、30.81（+2.97%）、31.22（+4.34%）、31.98（+6.89%）、32.51（+8.66%）；下方29.90（-0.07%）、29.55（-1.24%）、29.08（-2.81%）、28.78（-3.81%）、27.76（-7.22%）。12组原始合并价越界，未进入档位。此示例是该次来源快照的技术参考结果，不是未来行情或胜率证据；新的小时／30分钟完整柱加入后，综合候选可更新，基准日收盘保持不变。

使用仓库Playwright和系统Chromium验证桌面1280×900／手机390×844；Browser插件未提供。真实行情逐档独立复算上下界、价格单位、百分比和原组来源，检查3／4／5档切换、页面身份、无横向溢出和无框架错误层。已知旧后端规则／预测502与该模块分开记录。复核发现的过期日线问题及原始均值百分比、历史规则标签不一致已用失败测试复现并修复。

上次固定档位口径验证：66个Vitest测试文件、563项全部通过；lint及生产构建通过；桌面／手机Playwright共19项通过、3项按预设项目跳过。改动保留在当前云环境，未提交或发布生产。

数量更正后的最终验证：66个Vitest测试文件、565项全部通过；lint及生产构建通过；桌面／手机Playwright19项通过、3项按预设项目跳过。覆盖0／1／2／7个实际价位、完整保留超过5个的结果、空侧、无补位、越界过滤、百分比及新旧快照校验。

真实行情复核（2026-10-15 11:08北京时间）：掌阅科技收盘基准仍为29.92元，区间26.93～32.91元；实际得到上方4个：30.76（+2.81%）、31.23（+4.38%）、32.11（+7.32%）、32.70（+9.29%）；下方7个：29.75（-0.57%）、29.36（-1.87%）、29.08（-2.81%）、28.65（-4.24%）、27.76（-7.22%）、27.51（-8.05%）、27.09（-9.46%）。23组原始合并价中12组越界，剩余11个全部展示。桌面和手机均逐项核对全部有效原组、价格、百分比和来源，未发现数量选择、补位、遗漏、横向溢出或页面异常。额外载入更正前的真实保存快照，确认原始账本保持不变，并能按新口径修订。

## 实施验证与交接（2026-10-15）

- `npm test`：64个测试文件、522项通过；采集脚本Node测试5项通过。
- `npm run lint` 与 `NODE_USE_ENV_PROXY=1 npm run build`：通过。
- 仓库Playwright在系统Chromium上运行scenario、note-tags、research-studio：桌面／手机合计15项通过，3项按预设项目跳过。覆盖三周期人工确认后保留日线底线、行情失败、换股晚响应、历史重载、原文及导出、无横向溢出。
- 另用无行情mock的桌面1280×900和手机390×844验证真实掌阅日线→小时→30分钟，各640根完整柱；无页面异常或框架错误层。公开行情模式下，旧后端规则及预测接口502是已知未配置状态，多周期分析使用本地冻结笔记注册表。
- 最后由独立审查者检查全改动；4个重要问题已用失败用例复现并修复：跳空不能虚算覆盖、下层确认不能覆盖日线底线、旧原点／短路径单列停用、价格不连续事件后的盘中暂估能够保存和重载。新增字段损坏也会拒绝载入。
- 已检查桌面和手机截图，`git diff --check`通过，原始notes未修改。截图与完整命令日志保留在本次计划工作区和/tmp。
- PostgreSQL、Redis、后端与前端已在当前云实例恢复；数据库接受连接、Redis PONG、后端健康UP及10条内置规则、前端健康检查通过。前端以公开行情模式启动；后端账户／同步／旧预测页面未在此模式接通。复用启动说明已保存为环境草稿，需要在环境设置发布才用于未来实例。
- 改动保留在当前工作区，未提交、合并或发布到生产环境。

已知小项：历史页提到误差“详见导出”，当前导出仍只含快照与原始依据，不含当次重新计算的误差／覆盖结果及实际核对输入。该提示与导出需后续统一；现阶段可用本报告的离线脚本复算，不能依赖该提示认为导出已经携带评价结果。

实施取舍的完整记录（含风险代价）如下；它们说明验收范围，不能扩大成生产或策略有效性声明。

- Use the existing managed cloud checkout without a new worktree — onboarding explicitly requires this and isolation already exists — cost if wrong: changes share the current task checkout.
- Skill helper scripts and the extra writing-good-tests resource are not available through skills.read; use equivalent local brief extraction and command logs in this same plan workspace — cost if wrong: less automatic bookkeeping, guarded by explicit task completion evidence.
- Preserve task changes as local diffs under the stated read-only git permissions, and retain the ledger until evidence is copied into a durable completion record — cost if wrong: no per-task git commits.
- trend_climb is the existing upward-trend mode, with climbing/surging kept as separate confirmed riseStyle values — otherwise the planned surge rule has no applicable mode — cost if wrong: enum naming is broader than its spelling; UI will say 上涨趋势.
- preserve explicit CloseScenario paths and conditions in ScenarioAnalysis.scenarios — reference levels alone cannot reproduce a saved scenario — cost if wrong: a small increase in snapshot payload.
- latch shared asOf after all requested source responses, and refresh the full selected set when adding 30m; retain clearly marked cached parent data on source failures — request-start asOf dropped every freshly fetched partial candle — cost if wrong: an extra parent read on drilldown (server cache reused).
- store incomplete-candle hypotheses separately as provisional, outside formal states/rules/coverage; stamp creation at the actual save event — required by the spec and prevents retrospective forward-plan claims — cost if wrong: extra provisional rows and snapshot fields.
- open the analysis panel through an explicit lazy-loaded homepage entry — avoids loading the large knowledge catalog and hour requests before analysis is requested — cost if wrong: one extra click. Browser plugin not available; use repository Playwright and system Chromium.
- replay paths retain the actual later selection time and are accepted only with explicit replay kind — prevents fictitious historical selection timestamps — cost if wrong: replay calculations intentionally allow retrospective choices and cannot establish forward performance.
- start the frontend with proxy support and backend URL unset for public-market analysis — the tokenless backend otherwise forces snapshot/search through an unavailable provider — cost if wrong: backend-dependent account/sync/prediction UI is not connected in this local mode; backend service remains available separately and production configuration is unchanged.
- production deployment and network behavior are not certified by local service checks — no production change was authorized or performed — cost if wrong: production integration still needs its own release validation.
- exchange-calendar authenticity remains unjudged and calendar stays null — no verified exchange calendar was obtained — cost if wrong: future dates remain unavailable rather than inferred.
- external historical prices retain provider provenance and hashes without independent exchange reconciliation — source reads were verified, source truth was not — cost if wrong: provider revisions or errors can affect the retrospective comparison.
- profitability remains unvalidated — only one retrospective indicator-error case and no prior live plan exist — cost if wrong: no supported win-rate or net-return conclusion.
- preserve prior note-tag implementation and verify its interfaces/regressions — broad review of previously implemented classification is outside this change — cost if wrong: existing classification errors may remain.
- accept inspected desktop/mobile screenshots and tested keyboard/accessibility names as bounded UI evidence — the reviewer did not independently repeat browser/visual checks — cost if wrong: untested browser, assistive technology and interaction combinations may differ.

## 2026-10-15：先判断大周期，明确后停止

当前界面启动只加载、计算日线，不再预先读取小时线。趋势和盈利模式均经人工确认，且当前完整K线有足够MA/BOLL样本时，即可在该周期停止；如需额外核对，最多再选一个下级周期。日线不明确才逐级查看小时线，小时线仍不明确才查看30分钟；候选方向不等于已经确认的规律。当前停止依据沿用现有人工核对流程，不添加未经确认的自动识别阈值。

已删除“汇总三个周期”入口及确认大阳线后强制读取30分钟的动作。大周期确认后，更深周期不会进入当前价格、规则、新快照或后续刷新；已有旧快照保持保存时的周期。页面显示本次实际采用的周期，不再用必须凑齐三个周期的进度。

14日收盘流程回放：只采用日线时，上方30.75（+2.77%）；下方29.75（-0.57%）、29.04（-2.94%）、28.65（-4.24%）、27.69（-7.45%）。如额外采用小时线，上方30.38（+1.54%）、30.82（+3.01%）、32.08（+7.22%）、32.58（+8.89%）；下方29.79（-0.43%）、29.09（-2.77%）、28.75（-3.91%）、27.69（-7.45%）、27.29（-8.79%）、26.99（-9.79%）。两种情况均未采用30分钟；基准29.92元、普通主板区间26.93～32.91元，保持平均增量法。此处事后假设日线已确认，仅用于测试停止流程，不代表14日实时保存的判断或成交结果。

浏览器验证：桌面1280×900和手机390×844均实际检查启动只请求day，点击小时后才请求60m，整个过程没有30m请求；两个尺寸无页面异常、横向溢出或框架错误层。固定合成浏览器案例还确认日线规律后停止、最多一次小时核对、保存/重载只包含day与60m，以及大周期底线来源保留。原有后端规则和旧预测502单独记录。最终测试结果见本次执行记录；未提交或发布生产。
