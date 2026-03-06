#!/usr/bin/env python3
"""
Incremental local-cache sync for 15m BTC markets.

Goals:
- One command to keep local cache up to date.
- Do NOT re-download valid snapshot files.
- Fetch only missing/corrupted market snapshots.
- Keep a growing market history archive over time.

Outputs:
- data/15m-btc-markets-history.json       (append/merge history archive)
- data/15m_30d_snapshots/{market_id}.json (snapshot cache, incremental)
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

# Load .env from project root so POLYBACKTEST_API_KEY is available.
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


DAYS_WINDOW = 30
BURST_PER_SEC = 100
REQUESTS_PER_MIN = 2000
MAX_RETRIES = 5
RETRY_BACKOFF_SEC = 60

DATA_DIR = os.path.join(_project_root, "data")
SNAP_DIR = os.path.join(DATA_DIR, "15m_30d_snapshots")
MARKETS_HISTORY_PATH = os.path.join(DATA_DIR, "15m-btc-markets-history.json")


def _safe_read_json(path: str) -> dict[str, Any]:
    if not os.path.isfile(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def _write_json(path: str, payload: dict[str, Any]) -> None:
    # Unique tmp name avoids collisions when multiple writes happen near-simultaneously.
    tmp_path = f"{path}.{os.getpid()}.{int(time.time() * 1000)}.tmp"
    with open(tmp_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    os.replace(tmp_path, path)


def _parse_iso(ts: str) -> datetime | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def _is_snapshot_file_valid(path: str) -> bool:
    try:
        with open(path) as f:
            data = json.load(f)
        snaps = data.get("snapshots") or []
        if not snaps:
            return False
        first = snaps[0]
        return first.get("price_up") is not None or first.get("price_down") is not None
    except Exception:
        return False


def _wait_if_needed(
    requests_in_sec: int,
    requests_in_min: int,
    sec_window_start: float,
    min_window_start: float,
) -> tuple[int, int, float, float]:
    now = time.monotonic()

    if requests_in_sec >= BURST_PER_SEC:
        elapsed = now - sec_window_start
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        now = time.monotonic()
        requests_in_sec = 0
        sec_window_start = now

    if requests_in_min >= REQUESTS_PER_MIN:
        elapsed = now - min_window_start
        if elapsed < 60.0:
            time.sleep(60.0 - elapsed)
        now = time.monotonic()
        requests_in_min = 0
        min_window_start = now

    return requests_in_sec, requests_in_min, sec_window_start, min_window_start


def _fetch_snapshots_page(client: PolyBackTestClient, market_id: str, offset: int) -> dict[str, Any]:
    for attempt in range(MAX_RETRIES):
        try:
            return client.get_snapshots(market_id, limit=SNAPSHOTS_PAGE_SIZE, offset=offset)
        except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status == 429:
                wait = RETRY_BACKOFF_SEC * (attempt + 1)
                print(f"  [429] market={market_id} wait {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
            else:
                wait = RETRY_BACKOFF_SEC
                print(f"  [retry] market={market_id} {type(e).__name__}: {e}")
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(wait)
    raise RuntimeError("unreachable")


def _fetch_last_30d_markets(now: datetime) -> list[dict[str, Any]]:
    min_start = now - timedelta(days=DAYS_WINDOW)
    markets: list[dict[str, Any]] = []
    offset = 0
    limit = 100

    with PolyBackTestClient() as client:
        while True:
            data = client.list_markets(market_type="15m", resolved=None, limit=limit, offset=offset)
            batch = data.get("markets", [])
            if not batch:
                break

            all_older_than_cutoff = True
            for m in batch:
                st = m.get("start_time")
                if not st:
                    continue
                dt = _parse_iso(st)
                if dt and dt >= min_start:
                    markets.append(m)
                    all_older_than_cutoff = False

            if all_older_than_cutoff:
                break
            if len(batch) < limit:
                break
            offset += limit

    dedup: dict[str, dict[str, Any]] = {}
    for m in markets:
        mid = str(m.get("market_id", "")).strip()
        if mid:
            dedup[mid] = m

    def _sort_key(item: dict[str, Any]) -> str:
        return item.get("start_time", "")

    return sorted(dedup.values(), key=_sort_key, reverse=True)


def _merge_market_history(existing: list[dict[str, Any]], latest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for m in existing:
        mid = str(m.get("market_id", "")).strip()
        if mid:
            by_id[mid] = m
    for m in latest:
        mid = str(m.get("market_id", "")).strip()
        if mid:
            by_id[mid] = m

    merged = list(by_id.values())
    merged.sort(key=lambda m: m.get("start_time", ""), reverse=True)
    return merged


def _sync_snapshots_for_markets(markets: list[dict[str, Any]]) -> tuple[int, int, int, int]:
    os.makedirs(SNAP_DIR, exist_ok=True)

    market_ids = [str(m.get("market_id", "")).strip() for m in markets if m.get("market_id")]
    market_ids = [mid for mid in market_ids if mid]

    missing_ids: list[str] = []
    corrupted_ids: list[str] = []
    valid_ids = 0

    for mid in market_ids:
        path = os.path.join(SNAP_DIR, f"{mid}.json")
        if not os.path.isfile(path):
            missing_ids.append(mid)
            continue
        if _is_snapshot_file_valid(path):
            valid_ids += 1
        else:
            corrupted_ids.append(mid)

    to_fetch = missing_ids + corrupted_ids
    if not to_fetch:
        return valid_ids, 0, 0, 0

    print(f"Snapshot sync: valid={valid_ids}, missing={len(missing_ids)}, corrupted={len(corrupted_ids)}")

    fetched_ok = 0
    fetched_fail = 0
    fetched_unusable = 0
    req_sec = 0
    req_min = 0
    sec_window_start = time.monotonic()
    min_window_start = sec_window_start

    with PolyBackTestClient() as client:
        for idx, mid in enumerate(to_fetch, start=1):
            try:
                all_snapshots: list[dict[str, Any]] = []
                offset = 0
                slug = mid

                while True:
                    req_sec, req_min, sec_window_start, min_window_start = _wait_if_needed(
                        req_sec, req_min, sec_window_start, min_window_start
                    )
                    data = _fetch_snapshots_page(client, mid, offset)
                    req_sec += 1
                    req_min += 1

                    market_obj = data.get("market") or {}
                    if market_obj.get("slug"):
                        slug = market_obj.get("slug")

                    batch = data.get("snapshots", [])
                    all_snapshots.extend(batch)
                    if not batch or len(batch) < SNAPSHOTS_PAGE_SIZE:
                        break
                    offset += SNAPSHOTS_PAGE_SIZE

                usable = False
                if all_snapshots:
                    first = all_snapshots[0]
                    usable = (first.get("price_up") is not None) or (first.get("price_down") is not None)
                if not usable:
                    fetched_unusable += 1
                    fetched_fail += 1
                    print(f"  UNUSABLE {idx}/{len(to_fetch)} market_id={mid}: API returned empty/unusable snapshots")
                    continue

                out = {
                    "metadata": {
                        "market_id": mid,
                        "slug": slug,
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                        "total_snapshots": len(all_snapshots),
                    },
                    "snapshots": all_snapshots,
                }
                _write_json(os.path.join(SNAP_DIR, f"{mid}.json"), out)
                fetched_ok += 1

                if idx == 1 or idx % 50 == 0:
                    print(f"  synced {idx}/{len(to_fetch)} market_id={mid} snapshots={len(all_snapshots)}")
            except Exception as e:
                fetched_fail += 1
                print(f"  FAILED {idx}/{len(to_fetch)} market_id={mid}: {e}")

    return valid_ids, fetched_ok, fetched_fail, fetched_unusable


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(SNAP_DIR, exist_ok=True)

    now = datetime.now(timezone.utc)
    print("Sync start: 15m local cache (incremental)")

    latest_30d_markets = _fetch_last_30d_markets(now)
    print(f"Markets fetched (last {DAYS_WINDOW}d): {len(latest_30d_markets)}")

    existing_history = _safe_read_json(MARKETS_HISTORY_PATH).get("markets", [])
    merged_history = _merge_market_history(existing_history, latest_30d_markets)

    history_payload = {
        "metadata": {
            "query": "15m BTC market list, incremental history archive",
            "fetched_at": now.isoformat(),
            "market_type": "15m",
            "total_markets": len(merged_history),
        },
        "markets": merged_history,
    }
    _write_json(MARKETS_HISTORY_PATH, history_payload)

    valid_count, fetched_ok, fetched_fail, fetched_unusable = _sync_snapshots_for_markets(latest_30d_markets)
    total_window_markets = len(latest_30d_markets)
    snapshots_complete = min(total_window_markets, valid_count + fetched_ok)

    history_times = [
        _parse_iso(m.get("start_time", ""))
        for m in merged_history
        if m.get("start_time")
    ]
    history_times = [t for t in history_times if t is not None]
    if history_times:
        coverage_start = min(history_times)
        coverage_end = max(history_times)
        coverage_days = (coverage_end.date() - coverage_start.date()).days + 1
        coverage_start_s = coverage_start.date().isoformat()
        coverage_end_s = coverage_end.date().isoformat()
    else:
        coverage_days = 0
        coverage_start_s = ""
        coverage_end_s = ""

    print("\nSync complete.")
    print(f"- History markets file: {MARKETS_HISTORY_PATH}")
    print(f"- Snapshot dir: {SNAP_DIR}")
    print(f"- Snapshots already valid: {valid_count}")
    print(f"- Snapshots fetched/repaired: {fetched_ok}")
    print(f"- Snapshot fetch failures: {fetched_fail}")
    print(f"- Snapshot unusable after fetch: {fetched_unusable}")
    print(f"- Coverage start: {coverage_start_s}")
    print(f"- Coverage end: {coverage_end_s}")
    print(f"- Coverage days: {coverage_days}")
    print(f"- Markets in current sync window: {total_window_markets}")
    print(f"- Markets in history: {len(merged_history)}")
    print(f"- Snapshots complete in current sync window: {snapshots_complete}/{total_window_markets}")


if __name__ == "__main__":
    main()
