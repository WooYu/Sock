"""Render source-backed research figures and a readable, reproducible finding record."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from backtest import add_indicators, forecast_at
from validate_inputs import validate

ROOT = Path(__file__).resolve().parent
MODEL_LABELS = {"last_close": "价格不变", "baseline_v1": "原有20日趋势", "price_analog": "仅历史类比", "note_analog": "走势 + 经验条件", "note_delta1": "笔记：最近增量", "note_delta2": "笔记：两次增量均值"}
COLORS = {"last_close": "#94a3b8", "baseline_v1": "#e7a34c", "price_analog": "#599bc0", "note_analog": "#6259ce", "note_delta1": "#c26888", "note_delta2": "#b67383"}


def configure_plots():
    chinese = Path("C:/Windows/Fonts/msyh.ttc")
    if chinese.exists():
        font_manager.fontManager.addfont(str(chinese))
        plt.rcParams["font.family"] = font_manager.FontProperties(fname=str(chinese)).get_name()
    plt.rcParams.update({"axes.spines.top": False, "axes.spines.right": False, "axes.edgecolor": "#d9dfeb", "axes.labelcolor": "#5b6477", "xtick.color": "#6c7587", "ytick.color": "#6c7587", "axes.titleweight": "bold", "axes.titlesize": 13, "font.size": 10, "axes.unicode_minus": False, "figure.facecolor": "white", "axes.facecolor": "white"})


def save(fig, name):
    fig.savefig(ROOT / "figures" / name, dpi=170, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def render():
    configure_plots()
    (ROOT / "figures").mkdir(exist_ok=True)
    frame, quality = validate()
    summary = json.loads((ROOT / "results" / "summary.json").read_text(encoding="utf-8"))
    principles = json.loads((ROOT / "results" / "principle-summary.json").read_text(encoding="utf-8"))
    audit = json.loads((ROOT / "catalog-audit.json").read_text(encoding="utf-8"))
    selection = frame.loc["2023-09-16":]
    fig, ax = plt.subplots(figsize=(11, 3.6), layout="constrained")
    dates = pd.to_datetime(selection.index)
    ax.plot(dates, selection.close, color="#5451b6", linewidth=1.3, label="新易盛前复权收盘")
    ax.axvspan(pd.Timestamp("2025-09-16"), dates[-1], color="#f0edfb", label="最近一年留出观察")
    ax.set_yscale("log"); ax.set_ylabel("元 · 前复权 · 对数坐标")
    ax.set_title(f"真实行情范围：{selection.index[0]} — {selection.index[-1]}，{len(selection)}个交易日", loc="left", pad=18)
    ax.grid(axis="y", color="#edf0f6"); ax.legend(loc="upper left", frameon=False)
    save(fig, "01-history-and-split.png")

    rows = [row for row in summary["price"] if row["partition"] == "holdout"]
    metrics = {(row["model"], row["horizon"]): row for row in rows}
    models = ["last_close", "baseline_v1", "price_analog", "note_analog"]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.1), layout="constrained", sharey=True)
    for ax, horizon in zip(axes, [3, 4]):
        values = [metrics[model, horizon]["close_mape"] for model in models]
        bars = ax.bar(range(4), values, color=[COLORS[model] for model in models], width=.62)
        ax.bar_label(bars, labels=[f"{value:.2f}%" for value in values], padding=5, fontsize=11)
        ax.set_xticks(range(4), [MODEL_LABELS[model].replace("走势 + ", "走势+\n") for model in models], fontsize=9)
        ax.set_ylim(0, 8.6); ax.set_title(f"未来{horizon}日 · {metrics['note_analog', horizon]['origins']}个原点", loc="left")
        ax.grid(axis="y", color="#eef0f6"); ax.set_axisbelow(True)
    axes[0].set_ylabel("收盘平均绝对百分比误差 MAPE（越低越好）")
    fig.suptitle("加入经验条件，尚未显示收盘预测优势", x=.055, ha="left", fontsize=15, fontweight="bold")
    save(fig, "02-price-errors.png")

    keys = ["ma5", "ma10", "ma20", "boll_upper", "boll_middle", "boll_lower"]
    labels = ["MA5", "MA10", "MA20", "BOLL 上轨", "BOLL 中轨", "BOLL 下轨"]
    indicator_metrics = {(row["model"], row["indicator"]): row["mape"] for row in summary["indicators"] if row["partition"] == "holdout" and row["horizon"] == 3}
    fig, ax = plt.subplots(figsize=(11, 4), layout="constrained")
    for offset, model in enumerate(["last_close", "note_analog", "note_delta2"]):
        values = [indicator_metrics[model, key] for key in keys]
        bars = ax.bar(np.arange(6) + (offset - 1) * .24, values, width=.22, color=COLORS[model], label=MODEL_LABELS[model])
        ax.bar_label(bars, labels=[f"{value:.2f}" for value in values], fontsize=8, padding=3)
    ax.set_xticks(range(6), labels); ax.set_ylim(0, 4.8)
    ax.set_ylabel("三日参数 MAPE（%）"); ax.set_title("指标预测和价格预测分别评估", loc="left", pad=18)
    ax.legend(frameon=False, ncol=3, loc="upper right"); ax.grid(axis="y", color="#eef0f6"); ax.set_axisbelow(True)
    save(fig, "03-indicator-errors.png")

    origin = len(frame) - 5
    window = frame.iloc[origin - 29:origin + 5]
    relative = np.arange(len(window))
    fig, ax = plt.subplots(figsize=(11, 4), layout="constrained")
    ax.plot(relative[:30], window.close.iloc[:30], color="#334155", lw=1.4, label="预测原点之前的真实收盘")
    ax.plot(relative[29:], window.close.iloc[29:], color="#334155", marker="o", lw=1.4, label="后续实际收盘")
    ax.axvspan(29.5, 33.5, color="#f2effb")
    case = {"origin": frame.index[origin], "modelVersion": "notes-walkforward-v1", "history": window.reset_index().to_dict("records"), "forecasts": {}, "note": "最后一个具备完整4日结果的历史回放，不是事前实盘记录"}
    for model in ["baseline_v1", "note_analog"]:
        prediction = forecast_at(frame, origin, model)
        case["forecasts"][model] = prediction
        ax.plot([29, 30, 31, 32, 33], [window.close.iloc[29], *[row["close"] for row in prediction]], color=COLORS[model], linestyle="--", marker="s", markersize=4, label=MODEL_LABELS[model])
    ticks = [0, 7, 14, 21, 29, 33]
    ax.set_xticks(ticks, [window.index[i][5:] for i in ticks]); ax.set_ylabel("元 · 前复权")
    ax.set_title(f"最近完整回放：以 {frame.index[origin]} 收盘为原点，观察后4个交易日", loc="left", pad=18)
    ax.legend(frameon=False, fontsize=9, ncol=2); ax.grid(axis="y", color="#edf0f6")
    save(fig, "04-latest-complete-replay.png")
    (ROOT / "results" / "replay-example.json").write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding="utf-8")

    target_rows = [row for row in principles["scheduledTargets"] if row["partition"] == "holdout" and row["model"] == "note_delta2" and row["context"] == "all"]
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.8), layout="constrained")
    for offset, kind in enumerate(["buy_reference", "sell_reference"]):
        values = [next(row["touch_pct"] for row in target_rows if row["horizon"] == horizon and row["kind"] == kind) for horizon in [1, 2, 3]]
        bars = axes[0].bar(np.arange(3) + (offset - .5) * .33, values, width=.3, color=["#549f95", "#b17795"][offset], label=["MA5参考位", "BOLL上轨参考位"][offset])
        axes[0].bar_label(bars, labels=[f"{v:.1f}%" for v in values], padding=3, fontsize=9)
    axes[0].set_xticks(range(3), ["第1日", "第2日", "第3日"]); axes[0].set_ylim(0, 60); axes[0].set_ylabel("当日高低范围覆盖参考位（%）"); axes[0].set_title("不分形态直接套用：触达并不稳定", loc="left"); axes[0].legend(frameon=False, fontsize=9)
    reach = next(row for row in principles["nextDayReachability"] if row["partition"] == "holdout" and row["model"] == "note_delta2")
    bars = axes[1].bar([0, 1], [reach["mean_predicted_count"], reach["mean_actual_count"]], color=["#9088cb", "#84a6b9"], width=.5)
    axes[1].bar_label(bars, labels=[f"{v:.2f}个" for v in [reach["mean_predicted_count"], reach["mean_actual_count"]]], padding=5)
    axes[1].set_xticks([0, 1], ["振幅带估计可达", "次日实际覆盖"]); axes[1].set_ylim(0, 5); axes[1].set_ylabel("每日平均参数个数"); axes[1].set_title("振幅匹配偏宽，易多报可达参数", loc="left")
    for ax in axes: ax.grid(axis="y", color="#eef0f6"); ax.set_axisbelow(True)
    save(fig, "05-manual-reference-check.png")

    table = "|方法|三日收盘MAPE|四日收盘MAPE|三日方向正确率|\n|---|---:|---:|---:|\n"
    for model in models:
        direction = "不预测方向" if model == "last_close" else f"{metrics[model,3]['direction_accuracy_pct']:.2f}%"
        table += f"|{MODEL_LABELS[model]}|{metrics[model,3]['close_mape']:.2f}%|{metrics[model,4]['close_mape']:.2f}%|{direction}|\n"
    interval = next(row for row in summary["pairedBlockBootstrap"] if row["partition"] == "holdout" and row["horizon"] == 3 and row["model"] == "note_analog_vs_price_analog")
    lo, hi = interval["ci95_mape_pp"]
    content = f'''# 新易盛三年真实行情：经验与原则的回溯检验

本轮读取最新股票笔记的全部140份Markdown，提取{audit['rawCandidates']}个候选片段，验证{audit['sourceQuotesValidated']}段原文引文，归并为{audit['reviewEntriesAfterTopicGrouping']}个研究主题，并登记用户补充的10条经验/原则/提示。

**直接结论：目前不能证明“加入经验条件”提高了三日收盘预测准确率。优先把经验定义清楚、保留版本和反例、积累前瞻记录，而不是不停微调Agent。**

## 数据和方法

- 证券：新易盛300502.SZ；{selection.index[0]}至{selection.index[-1]}，{len(selection)}个交易日；2022年起行情仅用于指标预热和已成熟历史案例。
- 腾讯按年分段获取；与新浪重叠的{quality['rawSourceCrosscheck']['overlapSessions']}根原始日线，OHLC差异为0，成交量最大差{quality['rawSourceCrosscheck']['maxVolumeDifferenceShares']:.0f}股；市场日历无缺口。
- 原始数据已有9月16日，前复权日线只到9月15日，统一用后者截止，不人为补齐。
- 每个收盘原点只使用当时及以前数据，预测未来1–4个交易日。MA5/10/20用简单均值；BOLL用20日均值±2倍总体标准差。
- 最近一年从2025-09-16留出，固定参数逐日检验。类比模型只用当前10日观察窗口之前已经走完后4日的案例；每5日抽取候选，最近504日内选20个邻居。
- 走势+经验模型使用相同案例与算法，额外按MA/BOLL、双高和市场状态相似度加权。权重0.5在结果分析前固定，不按结果调优。
- 当前笔记与提取版本晚于历史日期，因此这是**当前知识的时间顺序回溯模拟**，不是当年的实盘样本外证明。只选这只股票存在选择偏差；前复权使用今天的数据版本。

![历史与留出区间](figures/01-history-and-split.png)

## 价格预测结果

以下为最近一年留出区间；3日{metrics['note_analog',3]['origins']}个原点，4日{metrics['note_analog',4]['origins']}个原点。MAPE越低越好。

{table}
三日始终预测上涨的方向对照为{metrics['note_analog',3]['always_up_accuracy_pct']:.2f}%。价格不变只作数值误差对照，不把其平盘预测硬比方向胜率。

经验条件相对纯价格类比的三日误差改善为{interval['improvement_mape_pp']:.4f}个百分点，20日时间块bootstrap的95%区间为[{lo:.4f}, {hi:.4f}]，跨0。组合模型的名义80%历史案例区间实际覆盖{metrics['note_analog',3]['close_interval_coverage_pct']:.2f}%，也不能称为已校准的80%置信区间。

![价格误差](figures/02-price-errors.png)

## MA与BOLL参数

笔记里有清楚的增量外推案例：`I(t+h)=I(t)+h×最近指标增量`，以及对近两次增量取均值的“前三后三”版本。它们预测的是参考参数，不能无依据改写成未来收盘价。

三日MA5 MAPE：两次增量外推{indicator_metrics['note_delta2','ma5']:.2f}%，价格不变后重算指标{indicator_metrics['last_close','ma5']:.2f}%；上轨分别{indicator_metrics['note_delta2','boll_upper']:.2f}%和{indicator_metrics['last_close','boll_upper']:.2f}%。不能把外推步骤看作准确率保证。

直接分别外推三条BOLL线还会破坏上下顺序：最近增量版本出现{summary['parameterConsistency']['note_delta1']['invalidBollOrder']}次，两次增量版本{summary['parameterConsistency']['note_delta2']['invalidBollOrder']}次（每种方法各{summary['parameterConsistency']['note_delta2']['forecasts']}个1–4日预测）。结果保留，没有挑掉坏样本；实际使用前应加一致性检查并标记无效，而不是强行调换轨道。

![指标预测误差](figures/03-indicator-errors.png)

## 用户补充的三天参考位与振幅匹配

本次先把“三天5日线/三天上轨”解释为未来三天参数，不是连续三天站上均线。分别检查“第h日是否覆盖第h日参考位”和“明天覆盖未来三组参考位中的几个”。使用近20日真实波幅中位数定义`收盘±一个波幅`的研究可达带，相近价位按0.1%合并。

该简化定义下，预测平均可达{reach['mean_predicted_count']:.2f}个参数，实际平均{reach['mean_actual_count']:.2f}个，数量平均绝对误差{reach['count_mae']:.2f}个；可达参考位的触达精确率{reach['touch_precision_pct']:.2f}%。它偏向“多报可达位”，需要分市场状态校准，不能自动生成买卖指令。

全部状态和“收盘位于上升MA5之上”的研究代理均保留在`results/principle-summary.json`；后者也不是完整的攀升/葛兰碧识别。日内高低范围覆盖价格，不证明先买后卖、可成交或T+1可卖，故没有虚构策略收益。

![参考位和振幅匹配](figures/05-manual-reference-check.png)

## 最近完整回放

固定使用最后一个具备完整4日实际结果的原点{frame.index[origin]}，避免挑选效果最好的片段。虚线为按当时输入重放的预测，深色为后续实际收盘。

![最近完整回放](figures/04-latest-complete-replay.png)

## 怎样管理和改进

- 经验记录条件关系；交易原则约束资格/持有/退出；临时提示绑定品种、股票和有效期。原文不可被AI解释覆盖。
- 来源→知识版本→计算定义→回测版本→使用策略→预测快照→真实结果，保持引用链。确认解释、测试通过和启用是三个动作。
- “葛一/葛二/照镜子/大涨/破位”需要可重复标注、阈值或分时数据。基础葛二退出与强势持有、次新股禁做与板块例外不能机械合并。
- 当前{audit['sourceComputability']['exact_daily']}条exact_daily候选只是计算片段（包括均线和OHLC聚合定义），不是六套已验证买卖策略。{audit['sourceComputability']['requires_proxy']}条需显式代理、{audit['sourceComputability']['requires_intraday']}条需分时、{audit['sourceComputability']['requires_external_data']}条需外部数据、{audit['sourceComputability']['subjective']}条需人工定义。
- 持续追加行情和预测兑现结果；固定规则版本定期复评。对解析错误先改词典/检索/结构化约束，对数值预测研究专门模型；有足量高质量标注和稳定评测后，才讨论微调Agent。
- 下一步证据应来自预先选定的多股票、多市况和真正未来时段；不得反复查看留出结果后调参却仍称其为独立留出。

## 核验与复跑

5项计算与无未来数据测试通过；独立审查逐项重算2,890条Java基线预测及MA/BOLL、核对5,780条类比预测训练边界、48组价格汇总和48组配对差值，无重大差异。

核心脚本：`validate_inputs.py` → `backtest.py` → `evaluate_principles.py` → `build_catalog.py` → `render_report.py`。逐原点账本保留所有好坏结果。`analysis.ipynb`提供带图的重跑入口。

来源：GitHub笔记版本`707f4fe0032ff44f309e7f374ba68f16d9e065af`；所有行情URL、时间戳和SHA256见`source-manifest.json`，324段笔记证据见`knowledge-catalog.json`。外链音频/视频未转录，未读取的图片已在原文清单记录；不能称为已完整解析全部附件。
'''
    (ROOT / "report.md").write_text(content, encoding="utf-8")
    print(json.dumps({"figures": 5, "report": str(ROOT / 'report.md')}, ensure_ascii=False))


if __name__ == "__main__": render()
