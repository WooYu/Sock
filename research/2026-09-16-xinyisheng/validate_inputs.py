"""Verify source fidelity before any financial metric is reported."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parent


def validate() -> tuple[pd.DataFrame, dict]:
    manifest = json.loads((ROOT / "source-manifest.json").read_text(encoding="utf-8"))
    for source in manifest["sources"]:
        assert hashlib.sha256((ROOT / source["file"]).read_bytes()).hexdigest() == source["sha256"], source["file"]
    frames = {}
    for name in ["stock-adjusted", "stock-raw", "benchmark-raw"]:
        assert hashlib.sha256((ROOT / "data" / f"{name}.json").read_bytes()).hexdigest() == manifest[f"{name}.json"]["sha256"], f"Derived data changed: {name}"
        frame = pd.DataFrame(json.loads((ROOT / "data" / f"{name}.json").read_text(encoding="utf-8"))).set_index("day").sort_index()
        assert frame.index.is_unique
        assert frame.index.is_monotonic_increasing
        assert np.isfinite(frame.select_dtypes("number")).all().all()
        assert (frame[["open", "high", "low", "close"]] > 0).all().all()
        assert (frame.high >= frame[["open", "close"]].max(axis=1)).all()
        assert (frame.low <= frame[["open", "close"]].min(axis=1)).all()
        assert (pd.to_datetime(frame.index).weekday < 5).all()
        frames[name] = frame
    sina = pd.DataFrame(json.loads((ROOT / "sources" / "sina-sz300502-raw.json").read_text(encoding="utf-8")))
    sina["day"] = sina.day.str[:10]
    sina = sina.set_index("day")
    for field in ["open", "high", "low", "close", "volume"]:
        sina[field] = pd.to_numeric(sina[field])
    stock = frames["stock-raw"]
    overlap = stock.index.intersection(sina.index)
    price_diff = (stock.loc[overlap, ["open", "high", "low", "close"]] - sina.loc[overlap, ["open", "high", "low", "close"]]).abs()
    volume_diff = (stock.loc[overlap, "volume_lots"] * 100 - sina.loc[overlap, "volume"]).abs()
    bad_price = price_diff.max(axis=1) > 0.011
    if bad_price.any():
        raise ValueError(f"Price sources disagree: {price_diff[bad_price].head().to_dict()}")
    adjusted = frames["stock-adjusted"]
    common = adjusted.index.intersection(stock.index).intersection(frames["benchmark-raw"].index)
    frame = adjusted.loc[common].copy()
    frame["raw_close"] = stock.loc[common, "close"]
    frame["benchmark_close"] = frames["benchmark-raw"].loc[common, "close"]
    frame["volume"] = stock.loc[common, "volume_lots"] * 100
    frame = frame.drop(columns=["volume_lots"])
    frame.to_csv(ROOT / "data" / "verified-daily.csv", encoding="utf-8", float_format="%.8f")
    evaluation = frame.loc["2023-09-16":]
    calendar = frames["benchmark-raw"].loc[evaluation.index[0]:evaluation.index[-1]].index
    raw_returns = stock.close.pct_change()
    adjusted_returns = adjusted.close.pct_change()
    common_returns = raw_returns.index.intersection(adjusted_returns.index)
    action_days = common_returns[(raw_returns.loc[common_returns] - adjusted_returns.loc[common_returns]).abs() > .02]
    quality = {
        "sourceHashesVerified": len(manifest["sources"]),
        "rawSourceCrosscheck": {"overlapSessions": len(overlap), "maxPriceDifferenceCNY": float(price_diff.max().max()), "priceMismatchesOver0011": int(bad_price.sum()), "maxVolumeDifferenceShares": float(volume_diff.max()), "volumeMismatchesOver100Shares": int((volume_diff > 100).sum())},
        "coverage": {"warmupFirst": frame.index[0], "lastVerifiedAdjustedSession": frame.index[-1], "lastRawSession": stock.index[-1], "evaluationFirst": evaluation.index[0], "evaluationLast": evaluation.index[-1], "evaluationSessions": len(evaluation), "missingVsBenchmarkCalendar": calendar.difference(evaluation.index).tolist(), "nonpositiveVolumeSessions": frame.index[frame.volume <= 0].tolist()},
        "corporateActionCandidates": [{"day": day, "rawReturn": float(raw_returns[day]), "adjustedReturn": float(adjusted_returns[day])} for day in action_days if day >= "2023-09-16"],
        "caveats": ["腾讯复权日线最后日期比未复权日线滞后，评估截止共同已验证日期，不拼接未经核验的复权行情。", "前复权是本次下载的数据版本，不是每个历史时点独立保存的版本。", "原始成交量不随复权股价缩放，除权事件附近的量比解释应谨慎。", "腾讯和新浪可能共享上游交易所数据；交叉一致性不等于两个独立交易所来源。"],
    }
    (ROOT / "data-quality.json").write_text(json.dumps(quality, ensure_ascii=False, indent=2), encoding="utf-8")
    return frame, quality


if __name__ == "__main__":
    _, quality = validate()
    print(json.dumps(quality, ensure_ascii=False, indent=2))
