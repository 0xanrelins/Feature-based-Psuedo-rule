#!/usr/bin/env python3
"""
Incremental local-cache sync for 15m BTC markets.

Goals:
- One command to keep local cache up to date.
- Do NOT re-download valid snapshot files.
- Fetch only missing/corrupted market snapshots.
- Keep a growing market history archive over time.

Outputs:
- data/market_name.json                   (current sync window market list)
- data/market_all.json                    (append/merge history archive)
- data/market_snapshot/{market_id}.json   (snapshot cache, incremental)
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
# If last snapshot is newer than this, skip API call (data considered fresh).
FRESHNESS_SKIP_HOURS = 1

DATA_DIR = os.path.join(_project_root, "data")
SNAP_DIR = os.path.join(DATA_DIR, "market_snapshot")
MARKETS_WINDOW_PATH = os.path.join(DATA_DIR, "market_name.json")
MARKETS_HISTORY_PATH = os.path.join(DATA_DIR, "market_all.json")


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


def _get_last_snapshot_time(path: str) -> datetime | None:
    """Return the timestamp of the last snapshot in the file, or None."""
    try:
        with open(path) as f:
            data = json.load(f)
        snaps = data.get("snapshots") or []
        if not snaps:
            return None
        last = snaps[-1]
        ts = last.get("time")
        if not ts:
            return None
        return _parse_iso(ts)
    except Exception:
        return None


def _load_market_list_from_disk() -> list[dict[str, Any]]:
    """Load market list from disk. Only market_name.json (current window). No API. Returns [] if missing/empty."""
    data = _safe_read_json(MARKETS_WINDOW_PATH)
    markets = data.get("markets")
    if isinstance(markets, list) and markets:
        return markets
    return []


def _fast_path_fresh() -> bool:
    """
    True if we can skip API: market_name.json exists and was updated in last hour.
    No per-market file check (that loop was causing hang on large lists / slow fs).
    """
    if not os.path.isfile(MARKETS_WINDOW_PATH):
        return False
    try:
        mtime = os.path.getmtime(MARKETS_WINDOW_PATH)
        if (time.time() - mtime) > 3600 * FRESHNESS_SKIP_HOURS:
            return False
    except OSError:
        return False
    data = _safe_read_json(MARKETS_WINDOW_PATH)
    markets = data.get("markets")
    return isinstance(markets, list) and len(markets) > 0


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


def _fetch_snapshots_page(
    client: PolyBackTestClient,
    market_id: str,
    offset: int,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> dict[str, Any]:
    for attempt in range(MAX_RETRIES):
        try:
            return client.get_snapshots(
                market_id,
                limit=SNAPSHOTS_PAGE_SIZE,
                offset=offset,
                start_time=start_time,
                end_time=end_time,
            )
        except (httpx.HTTPStatusError, httpx.TimeoutException) as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status is not None and 400 <= status < 500 and status != 429:
                print(f"  [skip] market={market_id} {status} (no retry)")
                raise
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
    now_utc = datetime.now(timezone.utc)

    market_ids = [str(m.get("market_id", "")).strip() for m in markets if m.get("market_id")]
    market_ids = [mid for mid in market_ids if mid]

    missing_ids: list[str] = []
    corrupted_ids: list[str] = []
    valid_incremental: list[tuple[str, str]] = []  # (mid, path)

    for mid in market_ids:
        path = os.path.join(SNAP_DIR, f"{mid}.json")
        if not os.path.isfile(path):
            missing_ids.append(mid)
            continue
        if _is_snapshot_file_valid(path):
            valid_incremental.append((mid, path))
        else:
            corrupted_ids.append(mid)

    to_fetch_full = missing_ids + corrupted_ids
    valid_ids = len(valid_incremental)

    if not to_fetch_full and not valid_incremental:
        return 0, 0, 0, 0

    print(
        f"Snapshot sync: valid (incremental)={len(valid_incremental)}, missing={len(missing_ids)}, corrupted={len(corrupted_ids)}"
    )

    fetched_ok = 0
    fetched_fail = 0
    fetched_unusable = 0
    appended_ok = 0
    req_sec = 0
    req_min = 0
    sec_window_start = time.monotonic()
    min_window_start = sec_window_start

    with PolyBackTestClient() as client:
        # Full fetch for missing or corrupted
        for idx, mid in enumerate(to_fetch_full, start=1):
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
                    print(
                        f"  UNUSABLE {idx}/{len(to_fetch_full)} market_id={mid}: API returned empty/unusable snapshots"
                    )
                    continue

                out = {
                    "metadata": {
                        "market_id": mid,
                        "slug": slug,
                        "fetched_at": now_utc.isoformat(),
                        "total_snapshots": len(all_snapshots),
                    },
                    "snapshots": all_snapshots,
                }
                _write_json(os.path.join(SNAP_DIR, f"{mid}.json"), out)
                fetched_ok += 1

                if idx == 1 or idx % 50 == 0:
                    print(f"  synced {idx}/{len(to_fetch_full)} market_id={mid} snapshots={len(all_snapshots)}")
            except Exception as e:
                fetched_fail += 1
                print(f"  FAILED {idx}/{len(to_fetch_full)} market_id={mid}: {e}")

        # Incremental append for valid files: fetch from last snapshot time to now, merge, write
        for idx, (mid, path) in enumerate(valid_incremental, start=1):
            try:
                last_time = _get_last_snapshot_time(path)
                if not last_time:
                    continue
                # Skip API call if data is already fresh (last snapshot within last N hours).
                if (now_utc - last_time) < timedelta(hours=FRESHNESS_SKIP_HOURS):
                    continue
                start_after = last_time + timedelta(seconds=1)
                if start_after >= now_utc:
                    continue

                new_snapshots: list[dict[str, Any]] = []
                offset = 0
                while True:
                    req_sec, req_min, sec_window_start, min_window_start = _wait_if_needed(
                        req_sec, req_min, sec_window_start, min_window_start
                    )
                    data = _fetch_snapshots_page(
                        client, mid, offset, start_time=start_after, end_time=now_utc
                    )
                    req_sec += 1
                    req_min += 1

                    batch = data.get("snapshots", [])
                    new_snapshots.extend(batch)
                    if not batch or len(batch) < SNAPSHOTS_PAGE_SIZE:
                        break
                    offset += SNAPSHOTS_PAGE_SIZE

                if not new_snapshots:
                    continue

                existing_data = _safe_read_json(path)
                existing_snapshots = existing_data.get("snapshots") or []
                combined = existing_snapshots + new_snapshots
                combined.sort(key=lambda s: s.get("time") or "")
                seen_time: set[str] = set()
                unique: list[dict[str, Any]] = []
                for s in combined:
                    t = s.get("time")
                    if t and t not in seen_time:
                        seen_time.add(t)
                        unique.append(s)

                meta = existing_data.get("metadata") or {}
                out = {
                    "metadata": {
                        "market_id": mid,
                        "slug": meta.get("slug", mid),
                        "fetched_at": now_utc.isoformat(),
                        "total_snapshots": len(unique),
                    },
                    "snapshots": unique,
                }
                _write_json(path, out)
                appended_ok += 1
                if idx <= 3 or appended_ok % 50 == 0:
                    print(f"  appended {appended_ok} market_id={mid} +{len(new_snapshots)} -> {len(unique)} total")
            except Exception as e:
                print(f"  incremental FAILED market_id={mid}: {e}")

    return valid_ids, fetched_ok, fetched_fail, fetched_unusable


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(SNAP_DIR, exist_ok=True)

    now = datetime.now(timezone.utc)
    print("Sync start: 15m local cache (incremental)")

    # Fast path: market_name.json recent (<1h) and every market has a snapshot file → skip API (no file content read).
    if _fast_path_fresh():
        cached_markets = _load_market_list_from_disk()
        n = len(cached_markets) if cached_markets else 0
        history = _safe_read_json(MARKETS_HISTORY_PATH).get("markets", [])
        history_times = [
            _parse_iso(m.get("start_time", ""))
            for m in history
            if m.get("start_time")
        ]
        history_times = [t for t in history_times if t is not None]
        if history_times:
            coverage_start_s = min(history_times).date().isoformat()
            coverage_end_s = max(history_times).date().isoformat()
            coverage_days = (max(history_times).date() - min(history_times).date()).days + 1
        else:
            coverage_start_s = coverage_end_s = ""
            coverage_days = 0
        print("All data fresh, nothing to update (no API calls).")
        print(f"- Snapshots already valid: {n}")
        print(f"- Snapshots fetched/repaired: 0")
        print(f"- Snapshot fetch failures: 0")
        print(f"- Coverage start: {coverage_start_s}")
        print(f"- Coverage end: {coverage_end_s}")
        print(f"- Coverage days: {coverage_days}")
        print(f"- Markets in current sync window: {n}")
        print(f"- Snapshots complete in current sync window: {n}/{n}")
        sys.stdout.flush()
        return

    latest_30d_markets = _fetch_last_30d_markets(now)
    print(f"Markets fetched (last {DAYS_WINDOW}d): {len(latest_30d_markets)}")

    window_payload = {
        "metadata": {
            "query": f"15m BTC market list, last {DAYS_WINDOW} days",
            "fetched_at": now.isoformat(),
            "market_type": "15m",
            "date_range_days": DAYS_WINDOW,
            "total_markets": len(latest_30d_markets),
        },
        "markets": latest_30d_markets,
    }
    _write_json(MARKETS_WINDOW_PATH, window_payload)

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
        unique_dates = {t.date() for t in history_times}
        days_with_data = len(unique_dates)
        missing_days = coverage_days - days_with_data
        print("\nSync complete.")
        if missing_days > 0:
            print(f"- WARNING: Span is {coverage_days}d but only {days_with_data} days have market data → {missing_days} days MISSING (gaps).")
    else:
        coverage_days = 0
        coverage_start_s = ""
        coverage_end_s = ""
        days_with_data = 0
        missing_days = 0
        print("\nSync complete.")

    print(f"- NOTE: Only last {DAYS_WINDOW}d are fetched from API (DAYS_WINDOW). Older data never downloaded.")
    print(f"- History markets file: {MARKETS_HISTORY_PATH}")
    print(f"- Snapshot dir: {SNAP_DIR}")
    print(f"- Snapshots already valid: {valid_count}")
    print(f"- Snapshots fetched/repaired: {fetched_ok}")
    print(f"- Snapshot fetch failures: {fetched_fail}")
    print(f"- Snapshot unusable after fetch: {fetched_unusable}")
    print(f"- Coverage start: {coverage_start_s}")
    print(f"- Coverage end: {coverage_end_s}")
    print(f"- Coverage days: {coverage_days}")
    print(f"- Days with data: {days_with_data}")
    print(f"- Missing days (gaps in span): {missing_days}")
    print(f"- Markets in current sync window: {total_window_markets}")
    print(f"- Markets in history: {len(merged_history)}")
    print(f"- Snapshots complete in current sync window: {snapshots_complete}/{total_window_markets}")


if __name__ == "__main__":
    main()
