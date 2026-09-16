import unittest
import numpy as np
import pandas as pd
from backtest import add_indicators, forecast_at, rule_flags, indicator_projection


def fixture(n=400):
    close = 100 + np.arange(n) * .1 + np.sin(np.arange(n) / 5)
    return pd.DataFrame({"open": close - .1, "high": close + 1, "low": close - 1, "close": close, "volume": np.full(n, 10000), "benchmark_close": 3000 + np.arange(n)}, index=pd.bdate_range("2022-01-03", periods=n).strftime("%Y-%m-%d"))


class BacktestIntegrity(unittest.TestCase):
    def test_population_bollinger_and_ma(self):
        frame = fixture(20)
        frame["close"] = np.arange(1, 21)
        row = add_indicators(frame).iloc[-1]
        self.assertEqual(row.ma5, 18)
        self.assertEqual(row.ma20, 10.5)
        self.assertAlmostEqual(row.boll_upper, 10.5 + 2 * np.std(np.arange(1, 21), ddof=0))

    def test_future_mutation_cannot_change_forecast(self):
        original = fixture()
        mutated = original.copy()
        mutated.iloc[301:, :4] *= 100
        for model in ["last_close", "baseline_v1", "price_analog", "note_analog"]:
            self.assertEqual(forecast_at(original, 300, model), forecast_at(mutated, 300, model))

    def test_analog_outcomes_end_before_current_observation_window(self):
        predictions = forecast_at(fixture(), 300, "note_analog")
        for prediction in predictions:
            self.assertLess(prediction["latestTrainingOutcomeIndex"], 291)
            self.assertEqual(prediction["neighborCount"], 20)
            self.assertLessEqual(prediction["low"], min(prediction["open"], prediction["close"]))
            self.assertGreaterEqual(prediction["high"], max(prediction["open"], prediction["close"]))

    def test_note_increment_projection_uses_observed_values_only(self):
        frame = add_indicators(fixture(60))
        actual = indicator_projection(frame, 2)
        for horizon, point in enumerate(actual, 1):
            self.assertAlmostEqual(point["ma5"], frame.ma5.iloc[-1] + horizon * (frame.ma5.iloc[-1] - frame.ma5.iloc[-3]) / 2)

    def test_double_high_requires_both_high_and_low(self):
        frame = add_indicators(fixture(60))
        frame.iloc[-1, frame.columns.get_loc("high")] = frame.high.iloc[-2] + 1
        frame.iloc[-1, frame.columns.get_loc("low")] = frame.low.iloc[-2] - 1
        self.assertFalse(rule_flags(frame).iloc[-1]["double_high"])


if __name__ == "__main__":
    unittest.main()
