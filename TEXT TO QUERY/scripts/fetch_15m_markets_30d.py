#!/usr/bin/env python3
"""
Fetch 15m BTC market list for the last 30 days and save to data/.
Uses list-markets with limit=100; typically ~30 requests, finishes in under 1 minute.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

# Allow running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.client import PolyBackTestClient


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, "15m-btc-markets-last30days.json")

    now = datetime.now(timezone.utc)
    min_start = now - timedelta(days=30)
    markets = []
    offset = 0
    limit = 100

    with PolyBackTestClient() as c:
        while True:
            data = c.list_markets(market_type="15m", resolved=None, limit=limit, offset=offset)
            batch = data.get("markets", [])
            if not batch:
                break
            for m in batch:
                st = m.get("start_time")
                if not st:
                    continue
                dt = datetime.fromisoformat(st.replace("Z", "+00:00"))
                if dt >= min_start:
                    markets.append(m)
            if len(batch) < limit:
                break
            offset += limit

    out = {
        "metadata": {
            "query": "15m BTC market list, last 30 days",
            "fetched_at": now.isoformat(),
            "market_type": "15m",
            "date_range_days": 30,
            "total_markets": len(markets),
        },
        "markets": markets,
    }

    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)

    print(f"Saved {len(markets)} markets to {out_path}")


if __name__ == "__main__":
    main()
