# 从原文重新提取精简标签

当前词典与旧目录会累积过多标签。新的 `notes:retag` 流程让两个不同模型独立阅读完整原文，不提供现有标签或旧研究作为提取依据。

每篇最多 5 个标签：核心主题最多 2 个，主要用途、内容类型、周期各最多 1 个。无需凑齐维度；不明则不选，不补“未明确”标签，不加入数据依赖、可计算性或上下位重复标签。

## 配置与运行

使用 DeepSeek API 和本地 Codex CLI 独立提取。在项目根目录或 `frontend/.env.local` 配置 DeepSeek 的 `AI_API_KEY`，其余变量见 `frontend/.env.example`。配置优先级为：进程环境、frontend 本地配置、根目录本地配置。Codex 沿用本机当前模型、服务与认证，无须另配 OpenAI API Key；可用 `STOCKCAL_CODEX_MODEL` 覆盖模型，用 `STOCKCAL_CODEX_BIN` 指定本地程序。密钥不会写入比较产物。

在 `frontend` 目录执行：

```powershell
# 先对少量笔记验证模型效果
npm run notes:retag -- --limit 6
# 全部 146 篇笔记；保留已完成结果，只续跑缺失或失败项
npm run notes:retag
# 单篇核对或换模型后另存一次实验
npm run notes:retag -- --file 05-breakout-buy.md --output ../.planning/tag-reextract/breakout.json
# 可分别运行；不同进程须使用不同输出文件
npm run notes:retag -- --only deepseek --output ../.planning/tag-reextract/deepseek-side.json
npm run notes:retag -- --only codex
# 合并相同模型与提示词下的独立结果，更新本地前端 AI 原始标签数据
npm run notes:retag -- --merge ../.planning/tag-reextract/deepseek-side.json --publish
```

DeepSeek 每篇一次请求，Codex 默认每批最多 6 篇，可通过 `--codex-batch-size 1` 改为逐篇。每篇仍须独立提取并校验，批次中不能跨文件使用引文。Codex 以只读、临时会话执行，标准输入传递原文，JSON Schema 约束输出，在临时目录运行以避免载入项目指令与旧标签。

完整 Markdown 文本会发送到所配置服务，不会读取图片、外部链接指向的内容或补充说明。每个标签必须带原文逐字引文、行号和提取理由，程序校验有效标签、去重、总数与维度上限、行号和引用内容。

DeepSeek 输出未通过约束时，最多要求其自行修正两次。对于在全文唯一出现的逐字引文，可由程序推导准确行号并记录修正标志；不做模糊匹配，不补写原文，不接受转述。附件旁的同一行真实正文可以作为依据，纯附件链接和元数据不能作为依据。

即使 DeepSeek 缺少密钥，本地 Codex 结果也会独立保存。配置补齐后重跑即可，只调用缺失或失败的一侧。Codex 使用自定义供应商时，`codex login status` 不一定反映供应商认证是否可用，以实际提取结果为准。

## 比较产物

默认生成 `.planning/tag-reextract/deepseek-codex.json`：

- 保留两个模型各自的结果与用量。
- `comparison.tags` 是双模型一致的精简候选，绝不将两边标签求并集。
- `onlyFirst` / `onlySecond` 展示不同意见；缺少共识或出现分歧的笔记标为待核对。
- `removed` / `added` 与旧目录比较；这只是候选变化，不表示原标签全部错误。
- 提示词版本、模型配置与原文字节摘要绑定，避免混用旧缓存。更换模型或提示词时指定新的输出文件。
- Windows 工作区 CRLF 与目录 LF 仅换行不同时，保留目录来源摘要及工作区字节摘要；任何正文修改仍会停止。

默认仅生成比较报告。`--publish` 要求全部 146 篇均完成双模型提取且全部证据再次校验通过，才更新 `frontend/src/features/knowledge/note-tag-ai-results.json`。前端以该文件替换整篇笔记的机器初始标签，不改动原目录与逐篇研究的哈希绑定。

浏览器中人工修订的版本继续优先展示；“采用 AI 精简标签”会在原编辑弹窗中预览，保存后追加新版本，保留实际旧版本和补充说明。没有共识的标签不自动采用；无正文或无共识的笔记允许零标签，页面提示核对原文或补充说明，不能直接确认空标签。

## 页面按篇重新提取

当前笔记详情的“AI 原文标签”区提供“AI 重新提取标签”。接口 `/api/note-tag-extraction` 仅接收目录中的整篇笔记 ID 与原文 SHA-256，服务端从已绑定版本的完整原文读取内容，核对摘要后复用批处理的提取规则和引文校验。不会把摘要、人工补充说明或当前标签作为模型输入。

页面展示两侧结果、引文、共识标签、相对当前版本的新增/移除以及模型分歧。两侧全部成功后，才可“采用本次结果并编辑”；编辑器中保存将追加新版本，取消不会写入。零共识允许预览与保存为空标签候选，不会改用并集。只完成一侧时保留该侧结果供查看，不能作为共识采用。

此接口使用 Node.js 运行环境；服务主机需配置 DeepSeek 与可执行的本地 Codex CLI（同上方环境变量与认证）。仅部署网页到 Vercel 不会自动获得本机 CLI。未完成的模型会在页面显示失败原因，当前标签不受影响。“根据补充说明建议标签”仍为独立的单模型流程。

2026-10-20 用户决定生产暂不使用 Codex。生产通过既有阿里云后端转发到 `compose.tags.yaml` 的内部 Node 提取服务，仅使用 DeepSeek；`STOCKCAL_CODEX_ENABLED=false` 时返回明确的单模型候选，允许预览和保存，页面不称为双模型共识。生产容器不安装 Codex、不挂载本机 Codex 配置，也不新增公网端口。本地批处理的双模型功能保留。

规则片段保留既有独立标签，这一批实际模型提取范围为 146 篇整篇笔记。

## 本次实际结果

2026-10-20，DeepSeek `deepseek-chat` 与本地 Codex `gpt-6.1-sol` 各完成 146 篇；比较结果无失败条目。原始标签总数 1960，共识核心标签 181（减少约 90.8%），实际每篇 0–4 个；103 篇有共识标签，43 篇暂未取得共识。模型不同意见保留在比较报告及页面折叠区，不作为已采用标签。

补充说明、人工修订和既有研究结果没有作为这轮模型提取输入，避免继承旧标签噪声。

Codex 非交互调用依据：[官方非交互模式文档](https://developers.openai.com/codex/noninteractive/)。
