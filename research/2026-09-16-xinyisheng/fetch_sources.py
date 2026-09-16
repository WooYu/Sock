"""Fetch versioned public OHLCV inputs. No model credentials or generated prices."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent
END = "2026-09-16"


def fetch_json(item: tuple[str, str]) -> dict:
    name, url = item
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=35) as response:
        raw = response.read()
    parsed = json.loads(raw)
    path = ROOT / "sources" / name
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(raw)
    return {"file": path.relative_to(ROOT).as_posix(), "url": url, "retrievedAt": datetime.now(timezone.utc).isoformat(), "sha256": hashlib.sha256(raw).hexdigest(), "data": parsed}


def fetch_all() -> dict:
    requests = []
    # Tencent caps any single response at 640; yearly chunks avoid a silently truncated three-year sample.
    for symbol, adjustment in [("sz300502", "qfq"), ("sz300502", ""), ("sh000001", "")]:
        for year in range(2022, 2027):
            end = f"{year + 1}-01-01" if year < 2026 else "2026-09-17"
            url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},day,{year}-01-01,{end},640,{adjustment}"
            requests.append((f"tencent-{symbol}-{adjustment or 'raw'}-{year}.json", url))
    requests.append(("sina-sz300502-raw.json", "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=sz300502&scale=240&ma=no&datalen=1023"))
    with ThreadPoolExecutor(max_workers=3) as executor:
        responses = list(executor.map(fetch_json, requests))
    manifest = {"asOf": END, "timezone": "Asia/Shanghai", "stock": {"symbol": "300502", "name": "新易盛", "exchange": "SZ"}, "sources": [{k: v for k, v in response.items() if k != "data"} for response in responses]}
    for symbol, adjustment, target in [("sz300502", "qfq", "stock-adjusted.json"), ("sz300502", "", "stock-raw.json"), ("sh000001", "", "benchmark-raw.json")]:
        combined = {}
        duplicate_conflicts = []
        for response in responses:
            if not response["file"].startswith(f"sources/tencent-{symbol}-{adjustment or 'raw'}-"):
                continue
            obj = response["data"].get("data", {}).get(symbol, {})
            rows = obj.get(f"{adjustment}day", []) if adjustment else obj.get("day", [])
            if not rows:
                raise ValueError(f"Missing price data: {response['file']}")
            for row in rows:
                day = row[0]
                if day > END:
                    continue
                candle = dict(zip(["day", "open", "close", "high", "low", "volume_lots"], [day, *map(float, row[1:6])]))
                if day in combined and combined[day] != candle:
                    duplicate_conflicts.append({"day": day, "earlier": combined[day], "later": candle})
                combined[day] = candle
        if duplicate_conflicts:
            raise ValueError(f"Conflicting overlapping chunks ({target}): {duplicate_conflicts[:3]}")
        output = [combined[key] for key in sorted(combined)]
        if not output:
            raise ValueError(f"No rows collected for {target}")
        (ROOT / "data").mkdir(exist_ok=True)
        (ROOT / "data" / target).write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest[target] = {"rows": len(output), "first": output[0]["day"], "last": output[-1]["day"], "adjustment": adjustment or "unadjusted", "volumeUnit": "100 shares per lot", "sha256": hashlib.sha256((ROOT / 'data' / target).read_bytes()).hexdigest()}
    (ROOT / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Explicitly refresh the frozen public source snapshot")
    args = parser.parse_args()
    if (ROOT / "source-manifest.json").exists() and not args.refresh:
        raise SystemExit("Frozen sources already exist. Use --refresh only to create a consciously new source vintage.")
    manifest = fetch_all()
    print(json.dumps({key: value for key, value in manifest.items() if key != "sources"}, ensure_ascii=False))
