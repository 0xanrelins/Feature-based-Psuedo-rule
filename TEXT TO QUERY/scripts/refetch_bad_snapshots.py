#!/usr/bin/env python3
"""
Re-fetch snapshot files that are corrupted or empty.
Usage: python scripts/refetch_bad_snapshots.py
Detects bad files in data/15m_30d_snapshots/, re-downloads from API, overwrites.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone

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

sys.path.insert(0, _project_root)
from src.client import PolyBackTestClient
from src.config import SNAPSHOTS_PAGE_SIZE

MAX_RETRIES = 5
RETRY_BACKOFF_SEC = 60
BURST_PER_SEC = 100
REQUESTS_PER_MIN = 2000


def wait_if_needed(requests_in_sec, requests_in_min, window_start, min_window_start):
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


def fetch_page(client, market_id, offset):
    for attempt in range(MAX_RETRIES):
        try:
            return client.get_snapshots(market_id, limit=SNAPSHOTS_PAGE_SIZE, offset=offset)
        except Exception as e:
            if getattr(e, "response", None) and getattr(e.response, "status_code", None) == 429:
                wait = RETRY_BACKOFF_SEC * (attempt + 1)
                print(f"  [429] waiting {wait}s...")
            else:
                print(f"  [error] {e}")
                wait = RETRY_BACKOFF_SEC
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(wait)
    raise RuntimeError("unreachable")


def main():
    data_dir = os.path.join(_project_root, "data")
    cache_dir = os.path.join(data_dir, "15m_30d_snapshots")
    bad_ids = []
    for name in os.listdir(cache_dir):
        if not name.endswith(".json"):
            continue
        path = os.path.join(cache_dir, name)
        try:
            with open(path) as f:
                d = json.load(f)
            snaps = d.get("snapshots", [])
            if not snaps:
                bad_ids.append(name.replace(".json", ""))
            elif snaps[0].get("price_up") is None and snaps[0].get("price_down") is None:
                bad_ids.append(name.replace(".json", ""))
        except Exception:
            bad_ids.append(name.replace(".json", ""))

    if not bad_ids:
        print("No bad files found.")
        return
    print(f"Re-fetching {len(bad_ids)} bad/corrupted files...")
    window_start = time.monotonic()
    min_window_start = window_start
    req_sec, req_min = 0, 0
    ok, fail = 0, 0
    with PolyBackTestClient() as client:
        for i, market_id in enumerate(bad_ids):
            out_path = os.path.join(cache_dir, f"{market_id}.json")
            try:
                all_snapshots = []
                snap_offset = 0
                slug = market_id
                while True:
                    req_sec, req_min, min_window_start = wait_if_needed(
                        req_sec, req_min, window_start, min_window_start
                    )
                    window_start = time.monotonic()
                    data = fetch_page(client, market_id, snap_offset)
                    req_sec += 1
                    req_min += 1
                    if data.get("market"):
                        slug = data["market"].get("slug", market_id)
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
                ok += 1
                print(f"  {i + 1}/{len(bad_ids)} {market_id} -> {len(all_snapshots)} snapshots OK")
            except Exception as e:
                fail += 1
                print(f"  {i + 1}/{len(bad_ids)} {market_id} FAILED: {e}")
    print(f"Done. OK: {ok}, Failed: {fail}")


if __name__ == "__main__":
    main()
