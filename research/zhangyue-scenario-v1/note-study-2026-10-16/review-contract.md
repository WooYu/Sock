# 逐篇语义学习记录约定

任务是阅读既有笔记，提出可核对的研究标签与计算条件；不是修改产品、训练基础模型或确认策略有效。本目录中所有输出均为待验证的AI研究候选。原始notes、应用代码、当前标签目录和浏览器记录均不得修改。

## 阅读和证据

按manifest.json指定的分组逐篇阅读全部正文，保留原始行号。不要以标题、关键词命中或旧目录摘要代替阅读；旧标签仅作比较参考。长文件请分段读取，避免输出截断遗漏内容。逐条证据必须是当前文件相应行范围中的真实、连续原文，不包含省略号或自行改写。单条引用尽量控制在30～180个汉字。

图片、音视频和外部链接没有实际检查时明确标记未核对，不从它们推测公式、图形或数字。正文为空或只有附件的资料记录缺失，不补造定义。转录错误保留歧义；解释需有证据，不把疑似“五日线”直接强行改写原文的“50线”。

## 标签

标签ID使用frontend/src/features/knowledge/note-tag-taxonomy.json现有词表。每篇覆盖kind/topic/purpose/timeframe/scope/data/computability七个维度，每个选中ID都必须有一条原文证据和语义理由。没有定义的维度使用该维度unknown标签并说明完整正文未明确。kind或computability没有unknown时选最合适的已有分类并明确限制；只有附件或背景描述可用computability.reference或data.attachment，不标可直接计算。

与价格计算相关的角色另列：trend、granville_stage、parameter_formula、method_selection、support_resistance、mode、risk、validation、context。角色不是新词表标签，不直接写入现有产品目录。

重点辨认公式的输入与输出是否都是指标值、参数推算和实际股价是否混用、周期是否明确、是否要求先确认形态、哪些阈值/窗口/加减幅度尚未定义。经验性“通常”“一定”不得改成经过验证的概率。提炼尽量控制每篇0～4项计算相关主张，长课程可多于4项，但不得把内容数量当作已验证规则数量。

## 用户现行要求优先

- 先日线，规律不明确才逐级查看小时/30分钟；规律明确后最多额外核对一个下级周期。笔记提到多周期是资料依据，不代表每次强制全部计算。
- 相近预测价按整组最大跨度相对两端平均不超过1%合并、原始参考等权算术平均。旧笔记千分之一阈值或“大概6个”需标为与现行用户口径不同；不得改用户要求。
- 单日价格按最近完整日K收盘和板块适用涨跌幅筛选，上下给全部实际结果，不补足3/4/5档。
- 验证价差为abs(计算价-实际价)/实际价，严格小于1%认为接近，开高低收逐项记录；支撑、压力反复触碰需要盘中数据证据。
- 公式/标签可核对、公式可执行、预测有效是不同状态；AI不能冒充人工标签确认或自动启用新规则。

## 每组输出

仅写自己的batch-N.json，不修改其他分组文件。顶层为：

```json
{
  "schemaVersion": 1,
  "batchId": 1,
  "status": "ai_candidate",
  "records": [
    {
      "file": "文件名.md",
      "sourceHash": "当前文件sha256",
      "status": "ai_candidate",
      "readCoverage": {"fromLine": 1, "throughLine": 18},
      "summary": "根据正文的语义总结，避免笼统套话",
      "roles": ["parameter_formula"],
      "tags": ["kind.formula"],
      "evidence": [{"tagId": "kind.formula", "startLine": 8, "endLine": 8, "quote": "真实原文", "reason": "选择该标签的语义理由"}],
      "claims": [
        {"name": "主张名称", "kind": "formula", "formula": null,
         "periods": ["day"], "inputs": [], "applicability": [], "invalidation": [],
         "gaps": [], "computability": "needs_definition",
         "evidence": [{"startLine": 8, "endLine": 8, "quote": "真实原文"}]}
      ],
      "gaps": [],
      "attachments": {"present": true, "status": "not_inspected", "note": "仅阅读文字，图像未核对"},
      "userRuleConflicts": []
    }
  ]
}
```

claims.kind为formula/condition/pattern/risk/context之一；computability为direct/needs_definition/needs_data/reference之一。periods可选day/60m/30m/weekly/monthly/quarterly/yearly/unknown；只有原文明确才给具体周期。formula仅在原文提供或可无歧义写成算式时填写，否则null并在gaps说明，不能因为提到“前三后三”就凭空补外推公式。

attachments.status为not_inspected或none；不存在附件时present=false、status=none。readCoverage覆盖当前文本全篇。全部完成后报告本组篇数、主要发现与最重要的缺失定义，不报告预测效果提升。
