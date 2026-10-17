# 价格核对、逐篇学习与样本库验收

本轮日期：2026-10-17。实现对应[已批准设计](../../docs/superpowers/specs/2026-10-16-price-evaluation-and-note-learning-design.md)与[执行计划](../../docs/superpowers/plans/2026-10-16-price-evaluation-and-note-learning.md)。功能实施验收时保留了既有未提交修改；随后用户于2026-10-17授权提交并推送GitHub供本地运行，交付复验见[本地运行指南](../../docs/handoff/2026-10-17-stockcal-local-run.md)。本次未主动部署Vercel／阿里云生产应用。

## 已实现的流程

1. 保存分析先保留浏览器原快照，再上传同一不可变版本。入库状态只认服务器回执；断网保留原请求重试。账户／设备身份切换后旧响应不进入新身份视图。
2. PostgreSQL保存冻结分析、逐次评价和独立笔记研究版本。Flyway V15追加三张表，V16保存插入事务用于冻结查询可见性；同一身份同一版本重复请求返回原记录，内容冲突返回409，其他身份读取返回404。
3. 后台采集后续首根完整不复权日K，用实际价为分母、严格 `<1%` 核对所有计算价；反向四价覆盖另计，精确到分另计，空价位比例为null。
4. 首次服务器接收、客户端创建及输入时点均须早于目标日北京时间09:15，且目标日已核实、记录为当前定义的live分析，才具备前瞻资格。历史回放永远保留事后标识。
5. 行情修订追加新评价；重复柱不重复生成数值评分，来源刷新或旧柱恢复可追加状态并引用既有评分。故障保留已有成功结果，自动重试及七个自然日复查可在进程重启后继续。
6. “笔记标签 → 逐篇学习建议”逐篇展示原文、引文行号、主张、公式缺口及条件；研究候选单独保存和选用。下次保存分析绑定精确研究ID／哈希。原标签版本不被覆盖，缺失旧引用保留未解析标记。
7. “经验与原则 → 学习样本”保留成功、未接近、待核实和失败记录；支持独立候选／确认趋势筛选、稳定分页、只读冻结详情与含来源／版本的JSON导出。

## 验证命令与范围

执行日志和任务记录保留在开发工作区 `.superpowers/sdd/2026-10-16-price-evaluation-and-note-learning/`，属于未提交工作的执行台账。

| 检查 | 本轮结果 | 范围 |
| --- | --- | --- |
| `frontend: npm test` | 78个文件、602项通过 | 全套前端单元／组件测试；此前新用例的冷加载等待不足已修正 |
| `backend: JAVA_HOME=/workspace/toolchains/java21 GRADLE_USER_HOME=/workspace/.cache/gradle bash gradlew --max-workers=4 test bootJar` | 通过 | 85项正常测试通过及可启动jar；13项PG条件测试在该命令中跳过，已另行全部实际执行 |
| `backend: bash scripts/test-scenario-postgres.sh` | 13项真实PostgreSQL测试通过 | V1–V16迁移、并发幂等与冲突、所有权、精确旧笔记绑定、调度恢复、修订／恢复旧柱、七日边界、查询先筛选后分页和asOf／事务可见性冻结（含采集未完与提交延迟） |
| `frontend: npm run lint` | 通过 | 无eslint警告 |
| `frontend: npm run build` | 通过 | Next 16.3.3生产构建和TypeScript检查，包含新BFF路由 |
| 逐篇原文审计与生成器 `--check` | 通过 | 146篇、271条主张、1863次引文核验，原文与原标签147个文件哈希不变 |
| 静态客户端产物检查 | 通过 | 完整逐篇研究版本ID未进入 `.next/static/chunks`，正文按篇从服务端读取 |
| 桌面／手机浏览器 | 新增与情景／标签20项通过；工作台7项通过、3项按设备跳过；修正后真实双端2项通过 | 固定行情交互与真实记录服务分别验证 |

前端使用现有Playwright和 `/usr/bin/chromium`；当前环境没有可调用的Browser插件。没有升级依赖或下载额外浏览器。命令通过 `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium` 选择系统浏览器。

```bash
# frontend目录；3100仅为本轮隔离验收服务
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium SCENARIO_REAL_RESEARCH=true \
npm run test:e2e -- e2e/scenario-research.spec.ts e2e/scenario-analysis.spec.ts e2e/note-tags.spec.ts --workers=2

PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium \
npm run test:e2e -- e2e/research-studio.spec.ts --workers=2

# 仓库根目录，只读核验，不使用 --merge
python research/zhangyue-scenario-v1/note-study-2026-10-16/verify_records.py
node frontend/scripts/build-note-study.mjs --check
git diff --check
```

`@real`测试仅在显式设置 `SCENARIO_REAL_RESEARCH=true` 时执行；普通浏览器运行会跳过它，不能将跳过称为真实数据库验证。隔离运行方法：复用已有PostgreSQL容器，创建独立 `scenario_ui_test_<时间>_<随机值>` schema；后端进程设置 `DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/stockcal?currentSchema=<schema>`、`SPRING_FLYWAY_SCHEMAS=<schema>`、`PORT=8081`、开发身份模式，关闭AI／知识自动提取／定时调度；以本轮构建jar及系统CA信任启动。另起Next生产进程3100，仅设置 `STOCKCAL_RECORDS_API_BASE_URL=http://127.0.0.1:8081`，公开行情地址模式保留。结束时仅停止这两个自建进程并删除自建schema，保留原开发服务和数据。

## 固定响应与真实服务

`scenario-research.spec.ts`的前三个用例使用冻结回放／可控失败响应，分别检查：断网仅本地、相同原版本恢复重试、回执刷新恢复和完整导出；逐篇建议保存／选用及人工v2/v3逐字节保留；查询错误不能伪装为空、筛选独立、翻页／重置和冻结样本导出。既有情景用例继续核验日线停止／最多多看一级、失败保留父周期、切股迟到响应、1%合并、涨跌幅和不补档。标签回归继续实际编辑／重载／导出本地历史。

`@real`用例使用真实Next BFF、真实Spring服务和隔离PostgreSQL，记录保存、重复保存、全部旧引用原文解析、其他身份404均无HTTP模拟。另外真实保存／重复保存一篇AI语义建议，再将其精确UUID和原文哈希绑定到新预测，全部原标签引用和新增研究引用均解析成功。实际核对通过Java采集腾讯公开不复权日线；已确认实际15日OHLC及2/5、3/4。客户端历史回放标识没有改成事前预测。

本轮另停止并重新启动独立验收Java进程，用相同schema读取双端原记录。服务器首次接收时间、记录ID、请求哈希和完整评价历史全部一致；这项检查不依赖浏览器内存或只重建对象。开发后端也已迁移至V16，Next开发入口的研究记录BFF返回200；公开行情独立配置。

## 掌阅科技14日收盘回放

冻结输入来自 [2026-10-16行情证据](learning-2026-10-16/source.json)，输入截于2026-10-14收盘；回放记录在17日生成并入库。本次仅采用日线，没有为凑数量请求更小周期。14日收盘29.92，普通主板±10%的单日区间为26.93～32.91。

| 计算价 | 相对收盘涨跌 | 与15日实际四价严格<1%的接近项 |
| --- | --- | --- |
| 30.75 | +2.77% | 无 |
| 29.75 | −0.57% | 开盘29.51 |
| 29.04 | −2.94% | 最低28.95、收盘29.01 |
| 28.65 | −4.24% | 无 |
| 27.69 | −7.45% | 无 |

全部5价保留，接近2/5，四价覆盖3/4，精确到分0。最高32.91距最近计算价30.75仍偏差6.56%，明确未覆盖。价位在当日范围内没有被当成“盘中反复支撑／压力”。这份样本只能说明该次事后接近情况，不能证明预测改进、胜率或未来收益。

## 本轮发现与修复

生产浏览器首次验证发现默认时钟函数被构建优化内联到参数默认值，渲染时函数身份变化导致分析输入不断重新请求日线，历史上传按钮卡住。将时钟的回退放入请求回调，依赖保留原可选clock，停止无操作重复采集；保留生产构建上的失败用例，并在双端重试流程中增加请求次数上限。开发环境和提供固定时钟的单元测试原先不能揭示该问题。

最初系统浏览器路径未传入Playwright，无法启动；增加可选可执行文件路径后直接复用系统Chromium。新E2E辅助函数的推断参数类型曾导致构建类型错误，已显式声明请求类型。所有最终通过结论以修正后的验证为准。

独立最终审阅发现两项Important，已分别增加失败回归并修复：其一评价采用采集完成时点，并由V16保存插入事务ID、在游标中固定PostgreSQL可见性快照，防止采集中或尚未提交的修订混入较早分页；其二逐条强制验证标签与主张的非空完整引文，拒绝删掉quote／行号、空主张证据和非数组证据。追加的两项真实PG回归先失败后通过，后端全套及13项PG测试最终均通过；没有进行第二轮独立审阅。

执行技能发布的辅助脚本及 `writing-good-tests.md` 在当前提供器不可读，按技能要求在台账记录一次裁决，用本地任务简报、RED/GREEN日志和完成关卡替代；没有调整业务定义。执行方式为当前会话顺序实施，结束进行一次独立最终审阅，不重复审阅。

浏览器证据： [桌面真实样本](implementation-browser-artifacts/desktop-real-learning-sample.png)、[手机真实样本](implementation-browser-artifacts/mobile-real-learning-sample.png)、[手机逐价核对](implementation-browser-artifacts/mobile-price-evaluation.png)、[手机逐篇学习](implementation-browser-artifacts/mobile-semantic-study.png)；[桌面完整导出](implementation-browser-artifacts/desktop-real-research-export.json)和[手机完整导出](implementation-browser-artifacts/mobile-real-research-export.json)保留实际来源、全部评价及研究原文。已目视检查桌面详情与手机核对；手机表格保留横向滚动，页面整体无横向溢出。

云环境启动说明已成功保存为草稿，保留既有安装脚本、网络、仓库和凭据要求；增加独立记录服务地址、Java系统CA及实际验证命令。保存草稿没有发布配置或应用；跨新环境复用前需在环境设置审阅、保存并发布。

## 明确的边界

- 53篇相关附件未检查，文字结论不代替图片／视频证据；所有新研究主张效果仍为未测试。
- 无已验证缺日依据时，目标只保留候选／待核实；不把行情缺日自行解释为休市或停牌。目标回补、修订和来源刷新保留历史。
- 预测计算由客户端冻结；服务器复核来源、时间、合并和最终价位契约，不代表已经独立认证形态识别和全部预测公式。
- 当前没有让AI自动修改、自动晋级或启用新公式。学习样本库用于后续提出候选、隔离测试和对照，尚无新的前瞻准确率证明。
- 分钟支撑／压力、成交次数与停留时长尚未评估，日线四价接近不能代替这些指标。
