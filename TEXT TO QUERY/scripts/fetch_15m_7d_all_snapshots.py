#!/usr/bin/env python3
"""
15m BTC, last 30 days: Fetches ALL snapshots for each market.
- Gets market list from API (last 30 days, 15m).
- Pacing: 100 req/sec, 2000 req/min.
- Writes: data/market_snapshot/{market_id}.json
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Load .env from project root so POLYBACKTEST_API_KEY can be set there
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_script_dir, ".."))
_env_path = os.path.join(_project_root, ".env")
if os.path.isfile(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

import httpx

sys.path.insert(0, _project_root)
from src.client import PolyBackTestClient
from src.config import SNAPSHOTS_PAGE_SIZE

MAX_RETRIES = 5
RETRY_BACKOFF_SEC = 60

BURST_PER_SEC = 100
REQUESTS_PER_MIN = 2000


def wait_if_needed(
    requests_in_sec: int,
    requests_in_min: int,
    window_start: float,
    min_window_start: float,
):
    """Block to respect burst (100/s) and minute (2000/min) limits. Returns (new_sec_count, new_min_count, new_min_window)."""
    now = time.monotonic()
    if requests_in_sec >= BURST_PER_SEC:
        elapsed = now - window_start
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        now = time.monotonic()
        requests_in_sec = 0
    if requests_in_min >= REQUESTS_PER_MIN:
        elapsed = now - min_window_start
        if elapsed < 60.0:
            time.sleep(60.0 - elapsed)
        now = time.monotonic()
        return 0, 0, now
    return requests_in_sec, requests_in_min, min_window_start


def fetch_snapshots_page(client, market_id, offset):
    """One get_snapshots call with retries on 429/timeout."""
    for attempt in range(MAX_RETRIES):
        try:
            return client.get_snapshots(market_id, limit=SNAPSHOTS_PAGE_SIZE, offset=offset)
        except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
            if getattr(e, "response", None) and getattr(e.response, "status_code", None) == 429:
                wait = RETRY_BACKOFF_SEC * (attempt + 1)
                print(f"  [429] rate limit, waiting {wait}s (attempt {attempt + 1}/{MAX_RETRIES})...")
            else:
                print(f"  [error] {type(e).__name__}: {e} (attempt {attempt + 1}/{MAX_RETRIES})")
                wait = RETRY_BACKOFF_SEC
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(wait)
    raise RuntimeError("unreachable")


DAYS = 30

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")
    out_dir = os.path.join(data_dir, "market_snapshot")
    os.makedirs(out_dir, exist_ok=True)

    now = datetime.now(timezone.utc)
    min_start_ts = now - timedelta(days=DAYS)
    markets = []
    offset = 0
    limit = 100

    print(f"Fetching 15m market list (last {DAYS} days)...")
    with PolyBackTestClient() as c:
        while True:
            data = c.list_markets(market_type="15m", resolved=None, limit=limit, offset=offset)
            batch = data.get("markets", [])
            if not batch:
                break
            all_older_than_cutoff = True
            for m in batch:
                st = m.get("start_time")
                if not st:
                    continue
                dt = datetime.fromisoformat(st.replace("Z", "+00:00"))
                if dt >= min_start_ts:
                    markets.append(m)
                    all_older_than_cutoff = False
            if all_older_than_cutoff and batch:
                break
            offset += limit

    print(f"Found {len(markets)} markets. Fetching all snapshots (burst=100/s, 2000/min)...")
    total_requests = 0
    window_start = time.monotonic()
    min_window_start = window_start
    requests_in_sec = 0
    requests_in_min = 0

    with PolyBackTestClient() as client:
        done_count = 0
        for i, m in enumerate(markets):
            market_id = m.get("market_id")
            slug = m.get("slug", market_id)
            out_path = os.path.join(out_dir, f"{market_id}.json")
            if os.path.isfile(out_path):
                done_count += 1
                if (i + 1) % 100 == 0 or i == 0:
                    print(f"  {i + 1}/{len(markets)} (skip existing) {slug}")
                continue

            try:
                requests_in_sec, requests_in_min, min_window_start = wait_if_needed(
                    requests_in_sec, requests_in_min, window_start, min_window_start
                )
                window_start = time.monotonic()

                all_snapshots = []
                snap_offset = 0
                while True:
                    requests_in_sec, requests_in_min, min_window_start = wait_if_needed(
                        requests_in_sec, requests_in_min, window_start, min_window_start
                    )
                    window_start = time.monotonic()

                    data = fetch_snapshots_page(client, market_id, snap_offset)
                    total_requests += 1
                    requests_in_sec += 1
                    requests_in_min += 1
                    batch = data.get("snapshots", [])
                    all_snapshots.extend(batch)
                    if not batch or len(batch) < SNAPSHOTS_PAGE_SIZE:
                        break
                    snap_offset += SNAPSHOTS_PAGE_SIZE

                out = {
                    "metadata": {
                        "market_id": market_id,
                        "slug": slug,
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                        "total_snapshots": len(all_snapshots),
                    },
                    "snapshots": all_snapshots,
                }
                with open(out_path, "w") as f:
                    json.dump(out, f, indent=2, default=str)
                done_count += 1
                if (i + 1) % 50 == 0 or i == 0:
                    print(f"  {i + 1}/{len(markets)} {slug} -> {len(all_snapshots)} snapshots")
            except Exception as e:
                print(f"  FAILED {i + 1}/{len(markets)} {slug}: {e}")

    print(f"Done. {len(markets)} markets -> {out_dir} (fetched: {done_count}, total requests: {total_requests})")


if __name__ == "__main__":
    main()
