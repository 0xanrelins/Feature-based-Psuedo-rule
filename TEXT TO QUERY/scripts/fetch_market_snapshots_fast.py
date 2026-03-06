#!/usr/bin/env python3
"""
Fetch ALL snapshots for one market in the shortest time allowed by rate limits.
- Picks a random market from data/15m-btc-markets-last30days.json (or use --market-id).
- Paginates with limit=1000 per request; paces at 100 req/sec (burst limit) to minimize time.
- Saves to data/snapshots-{market_id}.json
"""

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.client import PolyBackTestClient
from src.config import SNAPSHOTS_PAGE_SIZE

BURST_LIMIT_PER_SEC = 100  # stay under 100 requests per second


def main():
    parser = argparse.ArgumentParser(description="Fetch all snapshots for one market, fast.")
    parser.add_argument("--market-id", type=str, help="Market ID (default: random from 15m list)")
    parser.add_argument("--out", type=str, help="Output path (default: data/snapshots-{market_id}.json)")
    args = parser.parse_args()

    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    list_path = os.path.join(data_dir, "15m-btc-markets-last30days.json")

    if args.market_id:
        market_id = args.market_id
        market_slug = market_id
    else:
        if not os.path.isfile(list_path):
            print(f"Missing {list_path}. Run scripts/fetch_15m_markets_30d.py first.")
            sys.exit(1)
        with open(list_path) as f:
            data = json.load(f)
        markets = data.get("markets", [])
        if not markets:
            print("No markets in list.")
            sys.exit(1)
        m = random.choice(markets)
        market_id = m.get("market_id")
        market_slug = m.get("slug", market_id)
        print(f"Random market: {market_slug} (id={market_id})")

    out_path = args.out or os.path.join(data_dir, f"snapshots-{market_id}.json")
    os.makedirs(data_dir, exist_ok=True)

    all_snapshots = []
    offset = 0
    request_count = 0
    window_start = time.monotonic()
    requests_in_window = 0

    with PolyBackTestClient() as c:
        while True:
            # Pace: max 100 requests per second
            if requests_in_window >= BURST_LIMIT_PER_SEC:
                elapsed = time.monotonic() - window_start
                if elapsed < 1.0:
                    time.sleep(1.0 - elapsed)
                window_start = time.monotonic()
                requests_in_window = 0

            data = c.get_snapshots(market_id, limit=SNAPSHOTS_PAGE_SIZE, offset=offset)
            requests_in_window += 1
            request_count += 1
            batch = data.get("snapshots", [])
            all_snapshots.extend(batch)

            total_available = data.get("total", 0)
            if not batch or len(batch) < SNAPSHOTS_PAGE_SIZE:
                break
            offset += SNAPSHOTS_PAGE_SIZE

    out = {
        "metadata": {
            "market_id": market_id,
            "market_slug": market_slug,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "total_snapshots": len(all_snapshots),
            "requests_used": request_count,
        },
        "snapshots": all_snapshots,
    }

    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)

    print(f"Saved {len(all_snapshots)} snapshots to {out_path} ({request_count} requests)")


if __name__ == "__main__":
    main()
