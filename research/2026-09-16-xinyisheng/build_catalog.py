"""Validate AI interpretations against frozen originals and build a review-only UI package."""
from __future__ import annotations
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
NOTES = REPO / ".research-sources" / "ObsidianNote" / "印象笔记" / "股票"
COMMIT = "707f4fe0032ff44f309e7f374ba68f16d9e065af"
URL = "https://github.com/WooYu/ObsidianNote"

GROUPS = [
    ("ma5-floor", "MA5 入场资格与趋势底线", ["b1-r02", "b3-r02", "b2-r23"]),
    ("ma20-floor", "MA20 / BOLL 中轨底线", ["b1-r05", "b1-r06", "b3-r01", "b3-r29"]),
    ("double-high", "双高与强势股的持有纪律", ["b1-r01", "b2-r24", "b3-r11"]),
    ("granville-start", "葛一识别、起步和重新计数", ["b1-r09", "b2-r11", "b3-r05", "b3-r06"]),
    ("granville-exit", "葛二 / 葛2.5 的短线退出", ["b1-r10", "b1-r12", "b2-r13", "b2-r15", "b3-r07"]),
    ("granville-cycle", "葛兰碧与开口的四单位节奏", ["b1-r08", "b1-r11", "b2-r12", "b2-r16", "b2-r41", "b3-r08", "b3-r09"]),
    ("parameter-delta", "MA5 / BOLL 增量外推参数", ["b1-r17", "b2-r02", "b2-r03", "b2-r05", "b3-r18"]),
    ("three-day-levels", "未来三日 MA5 与上轨参考位", ["b1-r18", "b2-r07", "b2-r08", "b2-r09", "b3-r19", "b3-r22", "b3-r23"]),
    ("forecast-snapshot", "冻结盘前参数与保留修订", ["b1-r19", "b3-r20", "b3-r21"]),
    ("multi-timeframe", "多周期参数与近价位合并", ["b1-r23", "b2-r04", "b2-r06", "b2-r22"]),
    ("key-point", "关键点、未达与突破的分支", ["b1-r20", "b1-r22", "b2-r10", "b2-r17", "b2-r18", "b2-r19", "b2-r20", "b2-r21", "b3-r24"]),
    ("mirror", "照镜子：回抽、支撑压力互换", ["b1-r03", "b1-r21", "b2-r37", "b2-r40", "b3-r25", "b3-r26"]),
    ("market-turtle", "海龟：弱市场中的强势候选", ["b1-r15", "b2-r44", "b3-r13", "b3-r15"]),
    ("turtle-exit", "海龟的短线退出与持五例外", ["b1-r16", "b3-r14"]),
    ("phase3", "三期开口、攀升与震荡识别", ["b1-r07", "b1-r13", "b1-r14", "b2-r29", "b2-r30", "b2-r31", "b2-r39", "b3-r10", "b3-r16", "b3-r17"]),
    ("moxian", "摸线的阶段、时间与长周期", ["b2-r25", "b2-r26", "b2-r27", "b2-r28", "b2-r38", "b3-r27", "b3-r28", "b3-r30", "b3-r37"]),
    ("rebound-warning", "下跌反抽 MA5 的弱势警报", ["b1-r04", "b2-r35", "b2-r36", "b3-r40", "b3-r41"]),
    ("trade-plan", "交易前的目标、底线与失败退出", ["b1-r26", "b2-r54", "b3-r43"]),
    ("ipo-context", "次新股排除与板块例外", ["b2-r51", "b3-r32", "b3-r33"]),
    ("ex-rights", "除权股、缺口与复权版本", ["b2-r43", "b3-r34"]),
]


def build():
    batches = [json.loads((ROOT / f"extraction-batch-{i}.json").read_text(encoding="utf-8")) for i in [1, 2, 3]]
    documents = [item for batch in batches for item in batch["documents"]]
    rules = [item for batch in batches for item in batch["rules"]]
    assert len(documents) == len({d["file"] for d in documents}) == len(list(NOTES.glob("*.md"))) == 140
    for document in documents:
        path = NOTES / document["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == document["sha256"]
        assert len(path.read_text(encoding="utf-8-sig").splitlines()) == document["lines"]
    quote_count = 0
    for rule in rules:
        for evidence in rule["sourceEvidence"]:
            lines = (NOTES / evidence["file"]).read_text(encoding="utf-8-sig").splitlines()
            assert 1 <= evidence["startLine"] <= evidence["endLine"] <= len(lines)
            assert evidence["quote"] in "\n".join(lines[evidence["startLine"] - 1:evidence["endLine"]]), rule["id"]
            quote_count += 1
    generated = datetime.now(timezone.utc).isoformat()
    mapping = {rule["id"]: rule for rule in rules}
    used = set()
    entries = []
    gaps_for = {"exact_daily": [], "requires_proxy": ["需确认收盘/盘中取值、阈值和适用情境"], "requires_intraday": ["需要当时可见的分时/逐笔数据与执行定义"], "requires_external_data": ["需要板块、证券制度或其他外部历史数据"], "subjective": ["缺少可重复识别的标注或数值定义"]}
    def entry(identifier, title, members):
        interpretation = "\n\n".join(f"{r['name']}：{r['formalization']}" for r in members)
        seen = set(); references = []
        for member in members:
            for evidence in member["sourceEvidence"]:
                key = (evidence["file"], evidence["startLine"], evidence["endLine"], evidence["quote"])
                if key in seen: continue
                seen.add(key)
                path = quote("印象笔记/股票/" + evidence["file"], safe="/")
                references.append({**evidence, "url": f"{URL}/blob/{COMMIT}/{path}#L{evidence['startLine']}-L{evidence['endLine']}"})
        gaps = list(dict.fromkeys(gap for rule in members for gap in gaps_for[rule["computability"]]))
        caveats = list(dict.fromkeys(str(item) for rule in members for item in rule.get("caveats", [])))
        assumption_texts = list(dict.fromkeys(str(item) for rule in members for item in rule.get("assumptions", [])))
        if assumption_texts: interpretation += "\n\n研究假设：\n" + "\n".join(assumption_texts)
        return {"id": identifier, "version": 1, "type": "principle" if all(r["kind"] in ["filter", "risk"] for r in members) else "experience", "title": title, "originalText": "\n\n".join(ref["quote"] for ref in references[:5]), "interpretation": interpretation, "sourceType": "github", "status": "unreviewed", "scope": ["A股", *sorted({str(r["timeframe"]) for r in members})], "createdAt": generated, "gaps": gaps, "caveats": caveats, "references": references, "researchTest": "已完成日线参数外推与参考位检验；未证明预测优势" if identifier in ["parameter-delta", "three-day-levels"] else "完整语义有待确认；相关原子状态见研究回测"}
    for identifier, title, ids in GROUPS:
        assert not used.intersection(ids)
        entries.append(entry(identifier, title, [mapping[key] for key in ids]))
        used.update(ids)
    for rule in rules:
        if rule["id"] not in used:
            entries.append(entry(rule["id"], rule["name"], [rule]))
    manual = json.loads((ROOT / "manual-experiences.json").read_text(encoding="utf-8"))
    for item in manual["items"]:
        entries.append({"id": item["id"], "version": 1, "type": item["type"], "title": item["title"], "originalText": item["originalText"], "interpretation": item.get("interpretation", item.get("dailyProxy", "原文作为待确认的经验/原则保存，不自动改写成买卖信号。")), "sourceType": "manual", "status": "unreviewed", "scope": item["assets"], "createdAt": generated, "gaps": item.get("missing", []), "caveats": item.get("assumptions", []) + (["用户本轮提示尚未确认结构化解释；不自动参与交易。"]), "references": [], "researchTest": "已检验简化的 MA5 / 上轨参考位，触达不等于成交或盈利" if item["id"] == "manual-levels" else "待定义或补数据后检验"})
    summary = json.loads((ROOT / "results" / "summary.json").read_text(encoding="utf-8"))
    labels = {"last_close": "价格不变对照", "baseline_v1": "原有20日趋势", "price_analog": "仅历史走势类比", "note_analog": "走势 + 经验条件"}
    quality = json.loads((ROOT / "data-quality.json").read_text(encoding="utf-8"))
    holdout = {(row['model'], row['horizon']): row for row in summary['price'] if row['partition'] == 'holdout'}
    combined, naive = holdout['note_analog', 3], holdout['last_close', 3]
    comparison = next(row for row in summary['pairedBlockBootstrap'] if row['partition'] == 'holdout' and row['horizon'] == 3 and row['model'] == 'note_analog_vs_price_analog')
    lower, upper = comparison['ci95_mape_pp']
    evidence_statement = '加入经验条件，相对纯价格类比的改善区间跨0，尚未证明优势。' if lower <= 0 <= upper else '经验条件的差异具有方向性，仍须跨股票及前瞻验证后再决定使用。'
    package = {"generatedAt": generated, "docCount": len(documents), "sourceCommit": COMMIT, "sourceRepository": URL + "/tree/" + COMMIT + "/" + quote("印象笔记/股票", safe="/"), "entries": entries,
        "backtest": {"start": quality["coverage"]["evaluationFirst"], "end": quality["coverage"]["evaluationLast"], "sessions": quality["coverage"]["evaluationSessions"], "holdoutStart": summary["holdoutStart"], "models": [{"horizon": row["horizon"], "id": row["model"], "label": labels[row["model"]], "mape": row["close_mape"], "direction": None if row["model"] == "last_close" else row["direction_accuracy_pct"], "samples": row["origins"]} for row in summary["price"] if row["partition"] == "holdout" and row["horizon"] in [3, 4]], "findings": [evidence_statement, f"3日：走势+经验条件 MAPE {combined['close_mape']:.2f}%，价格不变对照{naive['close_mape']:.2f}%；方向正确率{combined['direction_accuracy_pct']:.2f}%，始终看涨对照{combined['always_up_accuracy_pct']:.2f}%。", f"经验条件相对纯价格类比的误差改善95%时间块区间：{lower:.3f}至{upper:.3f}个百分点。", f"{len(rules)}个候选包含大量情境、分时与缺定义内容，已合并重复主题；确认解释不等于启用交易。"], "methodology": ["每个历史原点只读取当时及以前数据，逐日向前评估1至4个交易日。", "最近一年留出观察；相似历史案例的未来4日必须早于当前10日观察片段。", "MA/BOLL误差与收盘价格误差分别统计；BOLL采用20日/2倍总体标准差。", "这是当前笔记版本的回溯检验，单只股票不证明跨股票或未来有效；尚无前瞻验证。", "指标外推与日内参考价触达不等于可成交订单，也没有据此声称策略收益。"], "sourceQuality": ["140篇原文与全部引文逐字核验，来源固定到Git提交。", "腾讯与新浪1,023根原始日线OHLC一致，成交量差不超过50股。", "完整三年725个复权交易日，市场日历无缺口；复权数据比原始数据晚一天。", "使用本次前复权版本，未读取所有外链音频/图片；没有用合成行情回测。"]}}
    audit = {"sourceCommit": COMMIT, "documents": len(documents), "rawCandidates": len(rules), "sourceQuotesValidated": quote_count, "sourceComputability": dict(Counter(r["computability"] for r in rules)), "reviewEntriesAfterTopicGrouping": len(entries) - len(manual["items"]), "manualEntries": len(manual["items"]), "workingTreeLineEndings": "File SHA256 reflects checked-out CRLF bytes; line quotes are newline-normalized.", "groups": [{"id": identifier, "sourceRuleIds": ids} for identifier, _, ids in GROUPS]}
    (ROOT / "catalog-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "knowledge-catalog.json").write_text(json.dumps({"audit": audit, "documents": documents, "rules": rules, "entries": entries}, ensure_ascii=False, indent=2), encoding="utf-8")
    output = REPO / "frontend" / "src" / "features" / "knowledge" / "research-package.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(package, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__": build()
