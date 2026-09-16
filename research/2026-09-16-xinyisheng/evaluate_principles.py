"""Event diagnostics and the user's three-MA5 / three-upper-band reference-level idea."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd
from backtest import add_indicators, rule_flags, indicator_projection
from validate_inputs import validate

ROOT = Path(__file__).resolve().parent
RULES = [
    ("above_ma5", "收盘位于 MA5 上方", ["b1-r02", "b3-r02"], "经验的收盘代理，不等于买入指令"),
    ("below_ma20", "收盘位于 MA20 下方", ["b3-r01"], "禁做/观望过滤，不等于做空预测"),
    ("ma5_ma10_falling", "MA5 与 MA10 同时下降", ["b3-r03"], "可直接计算的禁做状态"),
    ("three_ma_rising", "MA5/10/20 同时上升", ["b3-r04"], "将三个原子状态取交集是研究组合"),
    ("double_high", "最高价、最低价同时抬升", ["b1-r01"], "原文双高定义；持有纪律需另定"),
    ("ma5_break", "收盘跌破 MA5", ["b1-r02", "b3-r02"], "以收盘确认破位的研究代理"),
    ("ma5_reclaim_ma20_up", "重新站上 MA5 且 MA20 上升", ["b3-r41"], "代理采用当前 MA20 上升，并非严格首次拐头"),
    ("upper_touch_above_ma5", "触及 BOLL 上轨且收盘守住 MA5", ["b3-r10"], "使用当日收盘后的轨道标记状态，不假定盘中提前成交"),
    ("ma5_pullback_up", "回踩上升 MA5 后收回", ["b1-r09"], "最低价触线且收盘在线上；不冒充已识别葛一"),
    ("boll_opening_up", "BOLL 向外张开且收盘在中轨上", ["b3-r16", "b2-r30"], "技术代理，不等同完整三期开口定义"),
    ("below_lower", "收盘低于 BOLL 下轨", ["b3-r16"], "位置状态，不附加自动抄底含义"),
    ("ma5_above_ma10_above_ma20", "MA5 > MA10 > MA20", ["b3-r04", "b2-r23"], "研究使用的均线排列代理"),
]


def merge_levels(values, tolerance=.001):
    merged = []
    for value in sorted(float(value) for value in values if np.isfinite(value) and value > 0):
        if not merged or abs(value / merged[-1] - 1) > tolerance:
            merged.append(value)
    return merged


def evaluate():
    raw, _ = validate()
    frame = add_indicators(raw)
    flags = rule_flags(frame)
    outcomes = {h: frame.close.shift(-h) / frame.close - 1 for h in [1, 2, 3, 4]}
    events = []
    for start, partition in [("2023-09-16", "all"), ("2025-09-16", "holdout")]:
        period = frame.index >= start
        for key, title, references, interpretation in RULES:
            for h, outcome in outcomes.items():
                selected = outcome[period & flags[key] & outcome.notna()]
                universe = outcome[period & outcome.notna()]
                events.append({"id": key, "title": title, "sourceRuleIds": references, "interpretation": interpretation, "partition": partition, "horizon": h, "events": len(selected), "baseOrigins": len(universe), "positive_pct": float((selected > .001).mean() * 100) if len(selected) else None, "median_return_pct": float(selected.median() * 100) if len(selected) else None, "mean_return_pct": float(selected.mean() * 100) if len(selected) else None, "unconditional_positive_pct": float((universe > .001).mean() * 100), "unconditional_mean_return_pct": float(universe.mean() * 100), "claim": "描述条件后表现，不是完整策略收益或因果效应"})
    targets = []
    reachable = []
    for origin in np.flatnonzero(frame.index >= "2023-09-16"):
        if origin + 1 >= len(frame):
            continue
        past = frame.iloc[:origin + 1]
        price = float(past.close.iloc[-1])
        partition = "holdout" if past.index[-1] >= "2025-09-16" else "development"
        true_range = pd.concat([past.high - past.low, (past.high - past.close.shift(1)).abs(), (past.low - past.close.shift(1)).abs()], axis=1).max(axis=1)
        amplitude = float(true_range.iloc[-20:].median())
        actual_next = frame.iloc[origin + 1]
        rising_ma5_context = bool(past.close.iloc[-1] >= past.ma5.iloc[-1] and past.ma5.iloc[-1] > past.ma5.iloc[-2])
        for increments in [1, 2]:
            parameters = indicator_projection(past, increments)
            for h, point in enumerate(parameters[:3], 1):
                if origin + h >= len(frame):
                    continue
                actual = frame.iloc[origin + h]
                for kind, key, extreme in [("buy_reference", "ma5", "low"), ("sell_reference", "boll_upper", "high")]:
                    level = point[key]
                    targets.append({"origin": past.index[-1], "target": frame.index[origin + h], "partition": partition, "rising_ma5_context": rising_ma5_context, "model": f"note_delta{increments}", "horizon": h, "kind": kind, "level": level, "actual_extreme": actual[extreme], "inside_day_range": actual.low <= level <= actual.high, "within_1pct_of_extreme": abs(level / actual[extreme] - 1) <= .01, "extreme_ape": abs(level / actual[extreme] - 1) * 100})
            # Tomorrow may reach any of the precomputed next-three-day references; this is a different question from scheduled t+h extrema.
            levels = merge_levels([point[key] for point in parameters[:3] for key in ["ma5", "boll_upper"]])
            predicted = [level for level in levels if price - amplitude <= level <= price + amplitude]
            touched = [level for level in levels if actual_next.low <= level <= actual_next.high]
            hits = len(set(predicted).intersection(touched))
            reachable.append({"origin": past.index[-1], "partition": partition, "model": f"note_delta{increments}", "candidate_count": len(levels), "predicted_reachable_count": len(predicted), "actual_touched_count": len(touched), "true_positive": hits, "false_positive": len(predicted) - hits, "false_negative": len(touched) - hits, "count_absolute_error": abs(len(predicted) - len(touched)), "assumption": "可达带=当日收盘±近20日真实波幅中位数；0.1%合并近价位；未使用次日高低价选择参数"})
    pd.DataFrame(events).drop(columns=["sourceRuleIds"]).to_csv(ROOT / "results" / "principle-events.csv", index=False)
    pd.DataFrame(targets).to_csv(ROOT / "results" / "manual-target-ledger.csv", index=False)
    pd.DataFrame(reachable).to_csv(ROOT / "results" / "manual-reachability-ledger.csv", index=False)
    target_summary = []
    target_frame = pd.DataFrame(targets)
    for context, selected in [("all", target_frame), ("rising_ma5_proxy", target_frame[target_frame.rising_ma5_context])]:
        for (partition, model, horizon, kind), group in selected.groupby(["partition", "model", "horizon", "kind"]):
            target_summary.append({"context": context, "partition": partition, "model": model, "horizon": int(horizon), "kind": kind, "origins": len(group), "touch_pct": float(group.inside_day_range.mean() * 100), "extreme_within_1pct_pct": float(group.within_1pct_of_extreme.mean() * 100), "extreme_mape": float(group.extreme_ape.mean())})
    reach_summary = []
    for (partition, model), group in pd.DataFrame(reachable).groupby(["partition", "model"]):
        tp, fp, fn = (int(group[key].sum()) for key in ["true_positive", "false_positive", "false_negative"])
        reach_summary.append({"partition": partition, "model": model, "origins": len(group), "mean_predicted_count": float(group.predicted_reachable_count.mean()), "mean_actual_count": float(group.actual_touched_count.mean()), "count_mae": float(group.count_absolute_error.mean()), "touch_precision_pct": 100 * tp / (tp + fp) if tp + fp else None, "touch_recall_pct": 100 * tp / (tp + fn) if tp + fn else None})
    result = {"principles": events, "scheduledTargets": target_summary, "nextDayReachability": reach_summary, "executionLimit": "仅检验日内价格范围是否覆盖参考位。没有证明触达顺序、可成交量、T+1可卖或净收益；不把同日触达买卖参考价当作一笔已实现收益。"}
    (ROOT / "results" / "principle-summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"targets": [row for row in target_summary if row["partition"] == "holdout" and row["horizon"] == 3], "reachability": [row for row in reach_summary if row["partition"] == "holdout"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    evaluate()
