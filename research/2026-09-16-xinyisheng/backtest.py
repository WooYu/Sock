"""Causal daily forecasts and note-parameter replay, with inspectable per-origin errors."""
from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
INDICATORS = ["ma5", "ma10", "ma20", "boll_upper", "boll_middle", "boll_lower"]
PRICE_MODELS = ["last_close", "baseline_v1", "price_analog", "note_analog"]


def add_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    for n in [5, 10, 20]:
        result[f"ma{n}"] = result.close.rolling(n, min_periods=n).mean()
    result["boll_middle"] = result.ma20
    spread = result.close.rolling(20, min_periods=20).std(ddof=0) * 2
    result["boll_upper"] = result.ma20 + spread
    result["boll_lower"] = result.ma20 - spread
    result["boll_width"] = spread * 2 / result.ma20
    result["volume_ratio"] = result.volume / result.volume.shift(1).rolling(20).mean()
    return result


def rule_flags(frame: pd.DataFrame) -> pd.DataFrame:
    f = frame if "ma5" in frame else add_indicators(frame)
    p = f.shift(1)
    return pd.DataFrame({
        "above_ma5": f.close >= f.ma5,
        "below_ma20": f.close < f.ma20,
        "ma5_ma10_falling": (f.ma5 < p.ma5) & (f.ma10 < p.ma10),
        "three_ma_rising": (f.ma5 > p.ma5) & (f.ma10 > p.ma10) & (f.ma20 > p.ma20),
        "double_high": (f.high > p.high) & (f.low > p.low),
        "ma5_break": (f.close < f.ma5) & (p.close >= p.ma5),
        "ma5_reclaim_ma20_up": (f.close >= f.ma5) & (p.close < p.ma5) & (f.ma20 > p.ma20),
        "upper_touch_above_ma5": (f.high >= f.boll_upper) & (f.close >= f.ma5),
        "ma5_pullback_up": (f.low <= f.ma5) & (f.close >= f.ma5) & (f.ma5 > p.ma5),
        "boll_opening_up": (f.boll_upper > p.boll_upper) & (f.boll_lower < p.boll_lower) & (f.close > f.boll_middle),
        "below_lower": f.close < f.boll_lower,
        "ma5_above_ma10_above_ma20": (f.ma5 > f.ma10) & (f.ma10 > f.ma20),
        "benchmark_up": f.benchmark_close >= f.benchmark_close.shift(1),
    }, index=f.index)


def extend_indicators(history: np.ndarray, predicted_closes: list[float]) -> list[dict]:
    values = list(history)
    result = []
    for close in predicted_closes:
        values.append(close)
        ma20 = float(np.mean(values[-20:]))
        deviation = float(np.std(values[-20:], ddof=0))
        result.append({"ma5": float(np.mean(values[-5:])), "ma10": float(np.mean(values[-10:])), "ma20": ma20, "boll_upper": ma20 + 2 * deviation, "boll_middle": ma20, "boll_lower": ma20 - 2 * deviation})
    return result


def indicator_projection(history: pd.DataFrame, increments: int) -> list[dict]:
    latest = history.iloc[-1]
    previous = history.iloc[-1 - increments]
    return [{key: float(latest[key] + h * (latest[key] - previous[key]) / increments) for key in INDICATORS} for h in range(1, 5)]


def forecast_at(frame: pd.DataFrame, origin: int, model: str) -> list[dict]:
    # The API boundary cuts away future observations even if the caller supplies a complete table.
    history = frame.iloc[:origin + 1]
    close = history.close.to_numpy(float)
    last = float(close[-1])
    if len(close) < 24:
        raise ValueError("At least 24 daily observations required")
    if model in ["last_close", "baseline_v1"]:
        x = np.arange(20) - 9.5
        slope = 0.0 if model == "last_close" else float(np.dot(x, close[-20:] - close[-20:].mean()) / np.dot(x, x))
        previous = history.close.shift(1)
        amplitude = float(pd.concat([history.high - history.low, (history.high - previous).abs(), (history.low - previous).abs()], axis=1).max(axis=1).iloc[-20:].median())
        result = []
        next_open = last
        for h in range(1, 5):
            next_close = max(.01, last + h * slope)
            high = max(next_open, next_close) + amplitude * .5
            low = max(.01, min(next_open, next_close) - amplitude * .5)
            envelope = amplitude * np.sqrt(h)
            result.append({"horizon": h, "open": next_open, "high": high, "low": low, "close": next_close, "range_low": min(low, max(.01, next_close - envelope)), "range_high": max(high, next_close + envelope), "neighborCount": 0, "latestTrainingOutcomeIndex": None})
            next_open = next_close
    elif model in ["price_analog", "note_analog"]:
        n = len(history)
        # Outcomes j+1..j+4 precede the entire current ten-session shape.
        candidates = np.arange(max(24, n - 504), n - 14, 5, dtype=int)
        if len(candidates) < 20:
            raise ValueError("Insufficient matured historical cases")
        def shape(index):
            values = close[index - 9:index + 1]
            daily = np.diff(np.log(close[index - 19:index + 1]))
            scale = max(float(daily.std(ddof=0)), .005) * np.sqrt(10)
            return (values / values[0] - 1) / scale
        current_shape = shape(n - 1)
        distance = np.array([np.mean((shape(int(j)) - current_shape) ** 2) for j in candidates])
        if model == "note_analog":
            flags = rule_flags(history).to_numpy(bool)
            distance += .5 * np.mean(flags[candidates] != flags[-1], axis=1)
        neighbor_indices = candidates[np.argsort(distance, kind="stable")[:20]]
        result = []
        for h in range(1, 5):
            ratios = history.iloc[neighbor_indices + h][["open", "high", "low", "close"]].to_numpy(float) / close[neighbor_indices, None]
            point = {key: float(value) for key, value in zip(["open", "high", "low", "close"], np.median(ratios, axis=0) * last)}
            interval = np.quantile(ratios[:, 3], [.1, .9]) * last
            result.append({"horizon": h, **point, "range_low": float(interval[0]), "range_high": float(interval[1]), "neighborCount": len(neighbor_indices), "latestTrainingOutcomeIndex": int(neighbor_indices.max() + 4)})
    else:
        raise ValueError(f"Unknown model: {model}")
    for row, indicators in zip(result, extend_indicators(close, [row["close"] for row in result])):
        row.update(indicators)
    return result


def direction(value):
    return np.where(value > .001, 1, np.where(value < -.001, -1, 0))


def block_interval(values, seed=300502, replications=2000, block=20):
    values = np.asarray(values, dtype=float)
    if len(values) < 2:
        return [None, None]
    rng = np.random.default_rng(seed)
    n = len(values)
    starts = rng.integers(0, n, size=(replications, int(np.ceil(n / block))))
    indices = (starts[:, :, None] + np.arange(block)) % n
    samples = values[indices.reshape(replications, -1)[:, :n]].mean(axis=1)
    return [float(value) for value in np.quantile(samples, [.025, .975])]


def run_backtest(frame: pd.DataFrame):
    f = add_indicators(frame)
    rows = []
    parameters = []
    origins = np.flatnonzero(f.index >= "2023-09-16")
    for origin in origins:
        if origin >= len(f) - 1:
            continue
        day = f.index[origin]
        close_t = float(f.close.iloc[origin])
        all_predictions = {model: forecast_at(frame, int(origin), model) for model in PRICE_MODELS}
        for model, predictions in all_predictions.items():
            for point in predictions:
                h = point["horizon"]
                if origin + h >= len(f):
                    continue
                actual = f.iloc[origin + h]
                actual_return = float(actual.close / close_t - 1)
                predicted_return = point["close"] / close_t - 1
                rows.append({"origin": day, "target": f.index[origin + h], "partition": "holdout" if day >= "2025-09-16" else "development", "horizon": h, "model": model, "origin_close": close_t, "actual_close": float(actual.close), "predicted_close": point["close"], "actual_return": actual_return, "predicted_return": predicted_return, "close_ape": abs(point["close"] / actual.close - 1) * 100, "ohlc_ape": float(np.mean([abs(point[key] / actual[key] - 1) for key in ["open", "high", "low", "close"]]) * 100), "direction_hit": bool(direction(predicted_return) == direction(actual_return)), "always_up_hit": bool(direction(actual_return) == 1), "interval_hit": point["range_low"] <= actual.close <= point["range_high"], "interval_width_pct": (point["range_high"] - point["range_low"]) / close_t * 100, **{f"predicted_{key}": point[key] for key in ["open", "high", "low", "range_low", "range_high"]}, **{key: point[key] for key in ["neighborCount", "latestTrainingOutcomeIndex"]}})
                for key in INDICATORS:
                    parameters.append({"origin": day, "target": f.index[origin + h], "partition": "holdout" if day >= "2025-09-16" else "development", "horizon": h, "model": model, "indicator": key, "predicted": point[key], "actual": float(actual[key]), "ape": abs(point[key] / actual[key] - 1) * 100})
        for increments in [1, 2]:
            predictions = indicator_projection(f.iloc[:origin + 1], increments)
            for h, point in enumerate(predictions, 1):
                if origin + h >= len(f):
                    continue
                actual = f.iloc[origin + h]
                for key in INDICATORS:
                    parameters.append({"origin": day, "target": f.index[origin + h], "partition": "holdout" if day >= "2025-09-16" else "development", "horizon": h, "model": f"note_delta{increments}", "indicator": key, "predicted": point[key], "actual": float(actual[key]), "ape": abs(point[key] / actual[key] - 1) * 100})
    forecasts = pd.DataFrame(rows)
    indicators = pd.DataFrame(parameters)
    (ROOT / "results").mkdir(exist_ok=True)
    forecasts.to_csv(ROOT / "results" / "forecast-ledger.csv", index=False, float_format="%.10f")
    indicators.to_csv(ROOT / "results" / "indicator-ledger.csv", index=False, float_format="%.10f")
    summarize(forecasts, indicators, f)
    return forecasts, indicators


def summarize(forecasts, indicators, frame):
    price_summary = []
    uncertainty = []
    for split, selection in [("all", forecasts), ("development", forecasts[forecasts.partition == "development"]), ("holdout", forecasts[forecasts.partition == "holdout"])]:
        for (model, h), group in selection.groupby(["model", "horizon"]):
            price_summary.append({"partition": split, "model": model, "horizon": int(h), "origins": len(group), "close_mape": float(group.close_ape.mean()), "ohlc_mape": float(group.ohlc_ape.mean()), "direction_accuracy_pct": float(group.direction_hit.mean() * 100), "always_up_accuracy_pct": float(group.always_up_hit.mean() * 100), "close_interval_coverage_pct": float(group.interval_hit.mean() * 100), "mean_interval_width_pct": float(group.interval_width_pct.mean())})
        for h in [1, 2, 3, 4]:
            table = selection[selection.horizon == h].pivot(index="origin", columns="model", values="close_ape")
            for model in PRICE_MODELS[1:]:
                differences = table.last_close - table[model]
                uncertainty.append({"partition": split, "horizon": h, "model": model, "improvement_mape_pp": float(differences.mean()), "ci95_mape_pp": block_interval(differences)})
            differences = table.price_analog - table.note_analog
            uncertainty.append({"partition": split, "horizon": h, "model": "note_analog_vs_price_analog", "improvement_mape_pp": float(differences.mean()), "ci95_mape_pp": block_interval(differences)})
    indicator_summary = []
    for split, selection in [("all", indicators), ("development", indicators[indicators.partition == "development"]), ("holdout", indicators[indicators.partition == "holdout"])]:
        for (model, h, indicator), group in selection.groupby(["model", "horizon", "indicator"]):
            indicator_summary.append({"partition": split, "model": model, "horizon": int(h), "indicator": indicator, "origins": len(group), "mape": float(group.ape.mean())})
    rolling = forecasts.assign(quarter=pd.to_datetime(forecasts.origin).dt.to_period("Q").astype(str)).groupby(["quarter", "model", "horizon"]).agg(origins=("origin", "size"), close_mape=("close_ape", "mean"), direction_accuracy=("direction_hit", "mean")).reset_index()
    rolling.to_csv(ROOT / "results" / "quarterly-metrics.csv", index=False)
    bands = indicators.pivot(index=["origin", "horizon", "model"], columns="indicator", values="predicted")
    invalid_order = (bands.boll_lower > bands.boll_middle) | (bands.boll_middle > bands.boll_upper)
    consistency = {str(model): {"forecasts": int(len(group)), "invalidBollOrder": int(group.sum())} for model, group in invalid_order.groupby(level="model")}
    summary = {"price": price_summary, "indicators": indicator_summary, "pairedBlockBootstrap": uncertainty, "parameterConsistency": consistency, "uniqueOrigins": int(forecasts.origin.nunique()), "firstOrigin": forecasts.origin.min(), "lastOrigin": forecasts.origin.max(), "holdoutStart": "2025-09-16", "dataLast": frame.index[-1], "noteParameterOnly": "note_delta1/2 predict indicator parameters, not future closes or a complete trade strategy."}
    (ROOT / "results" / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    from validate_inputs import validate
    frame, quality = validate()
    forecasts, indicators = run_backtest(frame)
    result = json.loads((ROOT / "results" / "summary.json").read_text(encoding="utf-8"))
    print(json.dumps([row for row in result["price"] if row["partition"] == "holdout" and row["horizon"] in [3, 4]], ensure_ascii=False, indent=2))
