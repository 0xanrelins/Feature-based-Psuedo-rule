"""
Text to Query — State Machine Orchestrator

States:
  S1: Verify definments
  S2: Ask missing definments (interactive)
  S3: Parse query
  S4: Select endpoint
  S5: Build output
  S6: Handle error
  S7: Deliver result
"""

import os
import sys
import json
from datetime import datetime, timezone

# Load .env from project root so POLYBACKTEST_API_KEY is available
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_env_path = os.path.join(_project_root, ".env")
if os.path.isfile(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

from .config import Definments, get_api_key, get_scan_cap, SNAPSHOTS_PAGE_SIZE

# Project root (parent of src/) for data/ cache paths
_PROJECT_ROOT = _project_root
from .parser import parse_query, parse_time_range, ParsedQuery
from . import llm_parse
from .client import PolyBackTestClient
from .backtest import (
    run_backtest_on_market,
    BacktestResult,
    _evaluate_condition,
    _enrich_snapshots_for_btc,
    _btc_candle_color,
    needs_prev_5_btc,
)


def verify_definments(defs: Definments) -> tuple[bool, list[str]]:
    """S1: Verify all definments are valid."""
    errors = defs.validate()
    return len(errors) == 0, errors


def ask_missing(errors: list[str]) -> None:
    """S2: Report missing/invalid definments."""
    print("\n---\n[AGENT] DEFINMENT_ISSUES\n---")
    for err in errors:
        print(f"  - {err}")
    print("Fix these before proceeding.\n")


def _agent_section(name: str) -> None:
    print(f"\n---\n[AGENT] {name}\n---")


def select_endpoint(query: ParsedQuery) -> str:
    """S4: Determine which endpoint flow to use."""
    if query.action == "backtest":
        return "backtest_flow"
    if query.action == "lookup":
        return "snapshot_at_flow"
    return "list_markets_flow"


def run_list_markets(client: PolyBackTestClient, query: ParsedQuery) -> None:
    """Info flow: just list markets."""
    data = client.list_markets(
        market_type=query.market_type,
        resolved=None,
        limit=20,
    )
    markets = data.get("markets", [])
    total = data.get("total", 0)

    print(f"\nFound {total} markets (showing first {len(markets)}):\n")
    for m in markets:
        status = "RESOLVED" if m.get("winner") else "ACTIVE"
        winner = m.get("winner", "—")
        print(f"  [{status:8}] {m.get('slug', '?'):40} winner={winner}")
    print()


def run_snapshot_lookup(client: PolyBackTestClient, query: ParsedQuery) -> None:
    """Lookup flow: get snapshot at a specific time."""
    markets = client.list_markets(market_type=query.market_type, limit=1)
    market_list = markets.get("markets", [])
    if not market_list:
        print("\n[!] No markets found for this timeframe.\n")
        return

    market = market_list[0]
    market_id = market.get("market_id", "")
    now = datetime.now(timezone.utc)

    data = client.get_snapshot_at(market_id, now)
    snaps = data.get("snapshots", [])

    if not snaps:
        print(f"\n[!] No snapshot found for market {market_id} at {now.isoformat()}\n")
        return

    snap = snaps[0]
    print(f"\nMarket: {market.get('slug', market_id)}")
    print(f"Time:   {snap.get('time', '?')}")
    print(f"BTC:    ${snap.get('btc_price', '?'):,.2f}")
    print(f"UP:     {snap.get('price_up', '?')}")
    print(f"DOWN:   {snap.get('price_down', '?')}")
    print()


def _snapshot_cache_dir(market_type: str) -> str | None:
    """Return path to local snapshot cache dir for this market_type, or None if no cache."""
    if market_type == "15m":
        return os.path.join(_PROJECT_ROOT, "data", "15m_30d_snapshots")
    return None


def _load_snapshots_from_cache(market_id: str, market_type: str) -> list[dict] | None:
    """Load snapshots from local JSON if available. Returns None if not cached."""
    cache_dir = _snapshot_cache_dir(market_type)
    if not cache_dir:
        return None
    path = os.path.join(cache_dir, f"{market_id}.json")
    if not os.path.isfile(path):
        return None
    try:
        with open(path) as f:
            data = json.load(f)
        return data.get("snapshots") or []
    except Exception:
        return None


def _load_markets_from_cache(market_type: str, start_ts: datetime, end_ts: datetime) -> list[dict]:
    """Load markets from local history cache (15m only)."""
    if market_type != "15m":
        return []
    history_path = os.path.join(_PROJECT_ROOT, "data", "15m-btc-markets-history.json")
    path = history_path
    if not os.path.isfile(path):
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        markets = data.get("markets") or []
        filtered = []
        for m in markets:
            m_start = m.get("start_time", "")
            if not m_start:
                continue
            try:
                mt = datetime.fromisoformat(m_start.replace("Z", "+00:00"))
                if start_ts <= mt <= (end_ts or datetime.now(timezone.utc)):
                    if m.get("winner"):  # resolved only
                        filtered.append(m)
            except ValueError:
                continue
        return filtered
    except Exception:
        return []


def _use_cache_only() -> bool:
    """True when we should use cache only (no API). For demo/testing without API key."""
    return os.environ.get("USE_CACHE_ONLY", "").lower() in ("1", "true", "yes")

def _local_data_only() -> bool:
    """True when runtime must strictly use pre-downloaded local data only."""
    return os.environ.get("LOCAL_DATA_ONLY", "").lower() in ("1", "true", "yes")


def _get_local_market_coverage(market_type: str) -> tuple[datetime | None, datetime | None]:
    """Read local market cache and return (min_start, max_start) coverage."""
    if market_type != "15m":
        return None, None

    history_path = os.path.join(_PROJECT_ROOT, "data", "15m-btc-markets-history.json")
    path = history_path
    if not os.path.isfile(path):
        return None, None

    try:
        with open(path) as f:
            data = json.load(f)
        markets = data.get("markets") or []
    except Exception:
        return None, None

    starts: list[datetime] = []
    for m in markets:
        st = m.get("start_time", "")
        if not st:
            continue
        try:
            starts.append(datetime.fromisoformat(st.replace("Z", "+00:00")))
        except ValueError:
            continue

    if not starts:
        return None, None
    return min(starts), max(starts)


def _apply_dynamic_default_time_range(query: ParsedQuery, query_text: str) -> ParsedQuery:
    """
    If user did not explicitly provide a time range, use local cache coverage.
    This replaces static default (e.g. 30d) with "all available local data".
    """
    explicit_start, explicit_end = parse_time_range(query_text)
    if explicit_start is not None or explicit_end is not None:
        return query

    cov_start, cov_end = _get_local_market_coverage(query.market_type or "15m")
    if cov_start is None or cov_end is None:
        return query

    query.start_time = cov_start
    # End boundary to "now" still works because market filtering uses start_time;
    # this keeps behavior stable while defaulting to full local coverage.
    query.end_time = datetime.now(timezone.utc)
    return query


def run_backtest(client: PolyBackTestClient | None, query: ParsedQuery, *, silent: bool = False) -> BacktestResult:
    """Backtest flow: fetch markets + snapshots (from cache when available), apply strategy. Returns BacktestResult."""
    def _log(msg: str = ""):
        if not silent:
            print(msg)
    if not silent:
        _agent_section("BACKTEST_RUN")
    start_ts = query.start_time
    end_ts = query.end_time

    if _use_cache_only() or _local_data_only() or client is None:
        _log("  Using cache-only mode (no API)...")
        filtered = _load_markets_from_cache(query.market_type, start_ts, end_ts)
        cache_dir = _snapshot_cache_dir(query.market_type)
        if cache_dir:
            available = {f.replace(".json", "") for f in os.listdir(cache_dir) if f.endswith(".json")}
            filtered = [m for m in filtered if m.get("market_id") in available]
        elif _local_data_only():
            raise RuntimeError(
                f"local_cache_missing: No cache directory configured for timeframe '{query.market_type}'."
            )
        _log(f"  Found {len(filtered)} resolved markets (cached, snapshot cache only).")
        if _local_data_only() and not filtered:
            raise RuntimeError(
                f"local_cache_empty: No cached resolved markets found for '{query.market_type}' in requested time range."
            )
    else:
        _log("  Fetching resolved markets...")
        all_markets = []
        offset = 0
        while True:
            data = client.list_markets(
                market_type=query.market_type,
                resolved=True,
                limit=100,
                offset=offset,
            )
            batch = data.get("markets", [])
            all_markets.extend(batch)
            if len(batch) < 100:
                break
            offset += 100
        filtered = []
        for m in all_markets:
            m_start = m.get("start_time", "")
            if m_start and start_ts:
                try:
                    mt = datetime.fromisoformat(m_start.replace("Z", "+00:00"))
                    if start_ts <= mt <= (end_ts or datetime.now(timezone.utc)):
                        filtered.append(m)
                except ValueError:
                    continue
        _log(f"  Found {len(filtered)} resolved markets in range.")

    if not filtered:
        _log("  No markets matched the criteria.\n")
        return BacktestResult(trades=[], query=query)

    if needs_prev_5_btc(query):
        filtered = sorted(filtered, key=lambda m: m.get("start_time") or "")

    cap = get_scan_cap(query.market_type)
    cache_dir = _snapshot_cache_dir(query.market_type)
    if cache_dir:
        _log(f"  Using local cache when present: {os.path.basename(cache_dir)}/")
    _log()

    trades = []
    skipped_markets = 0
    last_5_btc_colors: list[str] = []
    for i, market in enumerate(filtered):
        mid = market.get("market_id", "")
        if not silent:
            sys.stdout.write(f"\r  Processing market {i + 1}/{len(filtered)}...")
            sys.stdout.flush()

        entry_snapshot = None
        close_snapshot = None
        prev_5_same: str | None = None

        # Prefer local cache to avoid redundant API calls
        snapshots = _load_snapshots_from_cache(mid, query.market_type)
        if snapshots:
            if query.needs_btc_enrich():
                snapshots = _enrich_snapshots_for_btc(snapshots)
            if needs_prev_5_btc(query):
                btc_color = _btc_candle_color(snapshots)
                if len(last_5_btc_colors) >= 5 and len(set(last_5_btc_colors[-5:])) == 1:
                    prev_5_same = last_5_btc_colors[-1]
                if btc_color is not None:
                    last_5_btc_colors = (last_5_btc_colors + [btc_color])[-5:]
            close_snapshot = snapshots[-1]  # always pass for resolution fallback when sell is price-based
            trade = run_backtest_on_market(
                market, query, snapshots=snapshots, close_snapshot=close_snapshot, prev_5_btc_same_color=prev_5_same
            )
            if trade:
                trades.append(trade)
        else:
            if client is None or _local_data_only():
                if _local_data_only():
                    # Strict local mode: skip missing/unusable files instead of failing whole run.
                    # This preserves progress and reports data quality via skipped count.
                    skipped_markets += 1
                continue  # cache-only: skip markets without cached snapshots
            # Fallback: fetch from API; when needs_prev_5_btc or needs_btc_enrich we fetch all snapshots first
            offset = 0
            entry_token = None
            all_chunks: list[dict] = []
            if query.needs_btc_enrich() or needs_prev_5_btc(query):
                while offset < cap:
                    snap_data = client.get_snapshots(mid, limit=SNAPSHOTS_PAGE_SIZE, offset=offset)
                    chunk = snap_data.get("snapshots", [])
                    if not chunk:
                        break
                    all_chunks.extend(chunk)
                    offset += SNAPSHOTS_PAGE_SIZE
                work = _enrich_snapshots_for_btc(all_chunks) if query.needs_btc_enrich() else all_chunks
                if needs_prev_5_btc(query):
                    btc_color = _btc_candle_color(work)
                    if len(last_5_btc_colors) >= 5 and len(set(last_5_btc_colors[-5:])) == 1:
                        prev_5_same = last_5_btc_colors[-1]
                    if btc_color is not None:
                        last_5_btc_colors = (last_5_btc_colors + [btc_color])[-5:]
                for snap in work:
                    for t in (query.buy_triggers or []):
                        if _evaluate_condition(t.get("condition") or "", snap):
                            entry_snapshot = snap
                            entry_token = t.get("token") or "up"
                            break
                    if entry_snapshot is not None:
                        break
                close_snapshot = work[-1]  # resolution fallback when sell is price-based
                trade = run_backtest_on_market(
                    market, query,
                    snapshots=work,
                    close_snapshot=close_snapshot,
                    prev_5_btc_same_color=prev_5_same,
                )
                if trade:
                    trades.append(trade)
                continue
            # No prev_5 / no btc enrich: stream and find first matching snapshot
            while offset < cap:
                snap_data = client.get_snapshots(mid, limit=SNAPSHOTS_PAGE_SIZE, offset=offset)
                chunk = snap_data.get("snapshots", [])
                if not chunk:
                    break
                for snap in chunk:
                    for t in (query.buy_triggers or []):
                        if _evaluate_condition(t.get("condition") or "", snap):
                            entry_snapshot = snap
                            entry_token = t.get("token") or "up"
                            break
                    if entry_snapshot is not None:
                        break
                if entry_snapshot is not None:
                    break
                offset += SNAPSHOTS_PAGE_SIZE

            if entry_snapshot and query.sell_condition == "market_end":
                end_time_str = market.get("end_time")
                if end_time_str:
                    try:
                        end_dt = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
                        close_data = client.get_snapshot_at(mid, end_dt)
                        close_list = close_data.get("snapshots", [])
                        if close_list:
                            close_snapshot = close_list[0]
                    except Exception:
                        pass

            if not entry_snapshot:
                continue
            if not close_snapshot and query.sell_condition == "market_end":
                continue

            trade = run_backtest_on_market(
                market, query,
                close_snapshot=close_snapshot,
                entry_snapshot=entry_snapshot,
                entry_token=entry_token,
            )
            if trade:
                trades.append(trade)

    result = BacktestResult(trades=trades, query=query, skipped_markets=skipped_markets)
    return result


def _trade_to_dict(t) -> dict:
    """Convert Trade to JSON-serializable dict."""
    return {
        "market_id": t.market_id,
        "market_slug": t.market_slug,
        "entry_time": t.entry_time,
        "entry_price": t.entry_price,
        "exit_time": t.exit_time,
        "exit_price": t.exit_price,
        "pnl": t.pnl,
        "is_win": t.is_win,
    }


def run_json(query_text: str, defs: Definments | None = None, *, dry_run: bool = False) -> dict:
    """
    Programmatic entry point: run full flow and return JSON.
    Used by UI/API integration.
    
    Args:
        dry_run: If True, only parse and return strategy without running backtest.
    """
    if defs is None:
        defs = Definments()

    # S1: Verify definments
    valid, errors = verify_definments(defs)
    if not valid:
        return {"success": False, "error": "definment_issues", "details": errors}

    # S3a: Parse query
    slots = llm_parse.parse_with_llm(query_text, defs)
    parser_mode = "llm"
    warning = None
    if slots is not None:
        if llm_parse.needs_clarification(slots):
            return {
                "success": False,
                "clarification_needed": True,
                "message": llm_parse.get_clarification_message(slots),
            }
        query = llm_parse.llm_slots_to_parsed_query(slots, defs)
    else:
        parser_mode = "fallback"
        warning = "LLM parser unavailable. Used rule-based fallback parser."
        query = parse_query(query_text, defs.timeframe, defs.token)
    query = _apply_dynamic_default_time_range(query, query_text)

    flow = select_endpoint(query)

    if flow != "backtest_flow":
        return {
            "success": False,
            "error": "unsupported_action",
            "action": query.action,
            "message": "Only backtest flow is supported via JSON API.",
        }

    # In local-data-only mode, this test setup currently supports only 15m cache.
    if _local_data_only() and (query.market_type or "").lower() != "15m":
        return {
            "success": False,
            "error": "unsupported_timeframe_for_local_cache",
            "message": (
                "This timeframe is not available in the current local test dataset. "
                "Available timeframe: 15m."
            ),
            "hint": "Please switch the query timeframe to 15m.",
        }

    # Build parsed strategy summary
    triggers = query.buy_triggers or []
    trigger_desc = " or ".join(
        f"BUY {t.get('token', 'up').upper()} when {t.get('condition', '?')}" for t in triggers
    ) or "any"
    parsed_strategy = {
        "action": query.action,
        "market_type": query.market_type,
        "token": query.token_direction,
        "price_source": query.price_source,
        "time_range": f"{query.start_time:%Y-%m-%d} → {query.end_time:%Y-%m-%d}",
        "buy_triggers": [{"token": t.get("token"), "condition": t.get("condition")} for t in triggers],
        "sell_condition": query.sell_condition,
        "entry_window_minutes": getattr(query, "entry_window_minutes", None),
        "entry_window_anchor": getattr(query, "entry_window_anchor", None),
        "exit_on_pct_move": getattr(query, "exit_on_pct_move", None),
        "trigger_description": trigger_desc,
    }

    # Dry run: return strategy without running backtest
    if dry_run:
        return {
            "success": True,
            "parser_mode": parser_mode,
            "warning": warning,
            "parsed_strategy": parsed_strategy,
        }

    # Run full backtest
    try:
        if _use_cache_only():
            result = run_backtest(None, query, silent=True)
        else:
            with PolyBackTestClient() as client:
                result = run_backtest(client, query, silent=True)
    except EnvironmentError as e:
        return {"success": False, "error": "environment", "message": str(e)}
    except Exception as e:
        return {"success": False, "error": "backtest_failed", "message": f"{type(e).__name__}: {e}"}

    return {
        "success": True,
        "parser_mode": parser_mode,
        "warning": (
            warning
            if (warning and result.skipped_markets == 0)
            else (
                f"Skipped {result.skipped_markets} market(s) due to missing/unusable local snapshots."
                if result.skipped_markets > 0
                else warning
            )
        ),
        "parsed_strategy": parsed_strategy,
        "backtest": {
            "total_trades": result.total_trades,
            "skipped_markets": result.skipped_markets,
            "wins": result.wins,
            "losses": result.losses,
            "win_rate": round(result.win_rate, 1),
            "total_pnl": round(result.total_pnl, 4),
            "avg_pnl": round(result.avg_pnl, 4),
            "summary": result.summary(),
        },
        "trades": [_trade_to_dict(t) for t in result.trades],
    }


def run(query_text: str, defs: Definments | None = None, confirm: bool = False) -> None:
    """Main entry point: run the full state machine. Set confirm=True to run backtest after strategy summary."""
    if defs is None:
        defs = Definments()

    # S1: Verify definments
    valid, errors = verify_definments(defs)
    if not valid:
        # S2: Ask missing
        ask_missing(errors)
        return

    # S3a: Parse query (LLM if available, else rule-based)
    slots = llm_parse.parse_with_llm(query_text, defs)
    if slots is not None:
        if llm_parse.needs_clarification(slots):
            _agent_section("CLARIFICATION_NEEDED")
            print(llm_parse.get_clarification_message(slots))
            print("Reply with more detail and run again.\n")
            return
        query = llm_parse.llm_slots_to_parsed_query(slots, defs)
    else:
        _agent_section("FALLBACK")
        print("LLM unavailable or error. Using rule-based parser.\n")
        query = parse_query(query_text, defs.timeframe, defs.token)
    query = _apply_dynamic_default_time_range(query, query_text)

    _agent_section("PARSE")
    print(f"  action          : {query.action}")
    print(f"  market_type     : {query.market_type}")
    print(f"  token           : {query.token_direction}")
    print(f"  price_source    : {query.price_source}")
    print(f"  time_range      : {query.start_time:%Y-%m-%d} → {query.end_time:%Y-%m-%d}")
    for i, t in enumerate(query.buy_triggers or []):
        print(f"  trigger[{i}]     : BUY {t.get('token', '?').upper()} when {t.get('condition', '?')}")
    print(f"  sell_condition  : {query.sell_condition}")
    if getattr(query, "entry_window_minutes", None):
        anchor = getattr(query, "entry_window_anchor", "end") or "end"
        when = "first" if anchor == "start" else "last"
        print(f"  entry_window    : {when} {query.entry_window_minutes} min of each session")
    if getattr(query, "exit_on_pct_move", None):
        dr = getattr(query, "exit_pct_move_direction", "any")
        ref = getattr(query, "exit_pct_move_ref", "token")
        print(f"  exit_on_pct_move: {query.exit_on_pct_move}% ({ref}, {dr})")

    flow = select_endpoint(query)

    if flow == "backtest_flow":
        _agent_section("STRATEGY")
        triggers = query.buy_triggers or []
        if not triggers:
            print("  (no buy triggers)")
        else:
            for t in triggers:
                print(f"  BUY {t.get('token', 'up').upper()} when {t.get('condition', '?')}")
            print("  (first trigger that fires wins.)")
        sell_line = f"  SELL at {query.sell_condition}."
        if getattr(query, "exit_on_pct_move", None):
            sell_line += f" | exit when {getattr(query, 'exit_pct_move_ref', 'token')} moves {query.exit_on_pct_move}% ({getattr(query, 'exit_pct_move_direction', 'any')})"
        print(sell_line)
        print(f"  market_type: {query.market_type}  time_range: {query.start_time:%Y-%m-%d} → {query.end_time:%Y-%m-%d}")
        if getattr(query, "entry_window_minutes", None):
            anchor = getattr(query, "entry_window_anchor", "end") or "end"
            when = "first" if anchor == "start" else "last"
            print(f"  entry_window: {when} {query.entry_window_minutes} min of each session")
        _agent_section("CONFIRM")
        print("  Onaylıyor musun? Re-run with --confirm to execute the backtest.\n")
        if not confirm:
            return

    # S5: Build & execute
    try:
        if flow == "backtest_flow":
            if _use_cache_only():
                result = run_backtest(None, query)
            else:
                with PolyBackTestClient() as client:
                    result = run_backtest(client, query)
            _agent_section("BACKTEST_RESULT")
            print(result.summary())
            if result.trades:
                def _time_mm_ss(iso_str: str) -> str:
                    if not iso_str:
                        return "--:--"
                    try:
                        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
                        return dt.strftime("%M:%S")
                    except Exception:
                        return "--:--"
                print("\n  Trade details:")
                print(f"  {'Market':<40} {'Entry':>7} {'Exit':>7} {'P&L':>8}  {'Entry':>6} {'Exit':>6}")
                print(f"  {'':40} {'price':>7} {'price':>7} {'':>8}  {'(mm:ss)':>6} {'(mm:ss)':>6}")
                print("  " + "-" * 76)
                for t in result.trades:
                    print(f"  {t.market_slug[:38]:<40} {t.entry_price:>7.4f} {t.exit_price:>7.4f} {t.pnl:>+8.4f}  {_time_mm_ss(t.entry_time):>6} {_time_mm_ss(t.exit_time):>6}")
            print()
        elif flow == "snapshot_at_flow":
            with PolyBackTestClient() as client:
                run_snapshot_lookup(client, query)
        else:
            with PolyBackTestClient() as client:
                run_list_markets(client, query)
    except EnvironmentError as e:
        _agent_section("ERROR")
        print(f"  {e}\n")
    except Exception as e:
        _agent_section("ERROR")
        print(f"  {type(e).__name__}: {e}\n")


def main():
    argv = sys.argv[1:]
    if not argv:
        print("Usage: python -m src.main \"<your question>\" [--confirm] [--json] [--dry-run]")
        print()
        print("  --confirm   Run backtest after showing strategy summary.")
        print("  --json      Output JSON (for API/UI integration).")
        print("  --dry-run   Parse only, don't run backtest (returns strategy for confirmation).")
        print()
        print("Examples:")
        print('  python -m src.main "What if I bought UP above 0.55 in 15m markets last 7 days?"')
        print('  python -m src.main "What if I bought UP above 0.55 in 15m markets last 7 days?" --confirm')
        print('  python -m src.main "buy UP at 0.60 when RSI < 30 in 15m last 7 days" --json')
        print('  python -m src.main "buy UP at 0.60 when RSI < 30 in 15m last 7 days" --json --dry-run')
        sys.exit(1)

    json_mode = "--json" in argv
    if json_mode:
        argv = [a for a in argv if a != "--json"]
    confirm = "--confirm" in argv
    if confirm:
        argv = [a for a in argv if a != "--confirm"]
    dry_run = "--dry-run" in argv
    if dry_run:
        argv = [a for a in argv if a != "--dry-run"]
    query_text = " ".join(argv)

    if json_mode:
        out = run_json(query_text, dry_run=dry_run)
        s = json.dumps(out, ensure_ascii=False)
        print(s, flush=True)
        return

    run(query_text, confirm=confirm)


if __name__ == "__main__":
    main()
