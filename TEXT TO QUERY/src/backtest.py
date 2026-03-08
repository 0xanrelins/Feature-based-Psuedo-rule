import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .parser import ParsedQuery
from .indicators import enrich_snapshots_with_indicators


@dataclass
class Trade:
    market_id: str
    market_slug: str
    entry_time: str
    entry_price: float
    exit_time: str
    exit_price: float

    @property
    def pnl(self) -> float:
        return self.exit_price - self.entry_price

    @property
    def pnl_pct(self) -> float:
        if self.entry_price == 0:
            return 0.0
        return (self.pnl / self.entry_price) * 100

    @property
    def is_win(self) -> bool:
        return self.pnl > 0


@dataclass
class BacktestResult:
    trades: list[Trade]
    query: ParsedQuery
    skipped_markets: int = 0
    markets_count: int = 0  # total markets backtest ran over (for display)

    @property
    def total_trades(self) -> int:
        return len(self.trades)

    @property
    def wins(self) -> int:
        return sum(1 for t in self.trades if t.is_win)

    @property
    def losses(self) -> int:
        return self.total_trades - self.wins

    @property
    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return (self.wins / self.total_trades) * 100

    @property
    def total_pnl(self) -> float:
        return sum(t.pnl for t in self.trades)

    @property
    def avg_pnl(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return self.total_pnl / self.total_trades

    @property
    def avg_hold_time_minutes(self) -> float:
        """Average hold time in minutes across all trades."""
        if not self.trades:
            return 0.0
        total_minutes = 0.0
        count = 0
        for t in self.trades:
            if not t.entry_time or not t.exit_time:
                continue
            try:
                entry = datetime.fromisoformat(t.entry_time.replace("Z", "+00:00"))
                exit_ = datetime.fromisoformat(t.exit_time.replace("Z", "+00:00"))
                total_minutes += (exit_ - entry).total_seconds() / 60.0
                count += 1
            except (ValueError, TypeError):
                continue
        return total_minutes / count if count else 0.0

    def summary(self) -> str:
        total_pnl_pct = self.total_pnl * 100
        avg_pnl_pct = self.avg_pnl * 100
        hold_m = self.avg_hold_time_minutes
        hold_str = f"{hold_m:.1f}m" if hold_m >= 1 else f"{hold_m * 60:.0f}s"
        lines = []
        if self.markets_count > 0:
            lines.append(f"{self.markets_count} markette:")
        lines.extend([
            f"Total Trades: {self.total_trades}",
            f"Wins / Losses: {self.wins} / {self.losses}",
            f"Win Rate: {self.win_rate:.1f}%",
            f"Total PnL: {total_pnl_pct:+.2f}%",
            f"Avg PnL/Trade: {avg_pnl_pct:+.2f}%",
            f"Avg Hold Time: {hold_str}",
        ])
        return "\n".join(lines)


def _enrich_snapshots_for_btc(snapshots: list[dict]) -> list[dict]:
    """Add btc_pct_from_start to each snapshot (copy). Used when price_source=btc_price."""
    if not snapshots:
        return []
    try:
        btc_start = snapshots[0].get("btc_price")
        if btc_start is None:
            return list(snapshots)
        btc_start = float(btc_start)
        if btc_start <= 0:
            return list(snapshots)
    except (TypeError, ValueError):
        return list(snapshots)
    out = []
    for s in snapshots:
        snap = dict(s)
        try:
            bp = s.get("btc_price")
            if bp is not None:
                bp = float(bp)
                snap["btc_pct_from_start"] = (bp - btc_start) / btc_start * 100.0
        except (TypeError, ValueError):
            pass
        out.append(snap)
    return out


def _parse_threshold_expression(rhs: str, entry_price: float | None) -> float | None:
    """
    Parse RHS of a comparison when it's an expression like 'filling_price * 2' or 'entry_price * 2'.
    Returns the numeric threshold, or None if not parseable or entry_price missing.
    """
    s = rhs.strip()
    try:
        return float(s)
    except (TypeError, ValueError):
        pass
    if entry_price is None:
        return None
    # filling_price * 2, entry_price * 0.5
    m = re.match(r"(filling_price|entry_price)\s*\*\s*([\d.]+)$", s, re.IGNORECASE)
    if m:
        return entry_price * float(m.group(2))
    # 2 * filling_price
    m = re.match(r"([\d.]+)\s*\*\s*(filling_price|entry_price)$", s, re.IGNORECASE)
    if m:
        return float(m.group(1)) * entry_price
    # filling_price / 2
    m = re.match(r"(filling_price|entry_price)\s*/\s*([\d.]+)$", s, re.IGNORECASE)
    if m:
        denom = float(m.group(2))
        return (entry_price / denom) if denom else None
    return None


def _evaluate_condition(
    condition: str,
    snapshot: dict,
    prev_snapshot: dict | None = None,
    entry_price: float | None = None,
) -> bool:
    """
    Evaluate a price condition against a snapshot.
    
    Supports: compound conditions with 'and'/'or', standard comparisons, equality, range, and crossovers (with prev_snapshot).
    """
    if not condition:
        return True
    
    cond_lower = condition.lower().replace("_", " ")
    
    # Handle compound conditions with OR
    if " or " in cond_lower:
        parts = condition.split(" or ")
        return any(_evaluate_condition(p.strip(), snapshot, prev_snapshot, entry_price) for p in parts)
    
    # Handle compound conditions with AND
    if " and " in cond_lower:
        parts = condition.split(" and ")
        return all(_evaluate_condition(p.strip(), snapshot, prev_snapshot, entry_price) for p in parts)
    
    # Handle crossover patterns
    if "crosses above" in cond_lower or "crosses below" in cond_lower:
        if prev_snapshot is None:
            return False
        
        is_crosses_above = "crosses above" in cond_lower
        pattern = "crosses above" if is_crosses_above else "crosses below"
        
        parts = cond_lower.split(pattern)
        if len(parts) == 2:
            field1 = parts[0].strip().replace(" ", "_")  # "ema 12" -> "ema_12"
            field2 = parts[1].strip().replace(" ", "_")  # "price up" -> "price_up"
            
            val1_curr = snapshot.get(field1)
            val1_prev = prev_snapshot.get(field1)
            
            try:
                val2_curr = float(field2)
                val2_prev = val2_curr
            except ValueError:
                val2_curr = snapshot.get(field2)
                val2_prev = prev_snapshot.get(field2)
            
            if None in [val1_curr, val1_prev, val2_curr, val2_prev]:
                return False
            
            if is_crosses_above:
                return float(val1_prev) <= float(val2_prev) and float(val1_curr) > float(val2_curr)
            else:
                return float(val1_prev) >= float(val2_prev) and float(val1_curr) < float(val2_curr)
    
    if " == " in condition:
        parts = condition.split(" == ", 1)
        if len(parts) == 2:
            field = parts[0].strip()
            raw = parts[1].strip().strip("'").strip()
            value = snapshot.get(field)
            if value is None:
                return False
            return str(value).strip() == raw

    for op_str, op_fn in [(">=", lambda a, b: a >= b),
                           ("<=", lambda a, b: a <= b),
                           (">", lambda a, b: a > b),
                           ("<", lambda a, b: a < b)]:
        if op_str in condition:
            parts = condition.split(op_str)
            if len(parts) == 2:
                field = parts[0].strip()
                rhs = parts[1].strip()
                try:
                    threshold = float(rhs)
                except (TypeError, ValueError):
                    threshold = _parse_threshold_expression(rhs, entry_price)
                if threshold is None:
                    return False
                value = snapshot.get(field)
                if value is None:
                    return False
                return op_fn(float(value), threshold)

    if "<=" in condition and condition.count("<=") == 2:
        match = condition.split("<=")
        if len(match) == 3:
            low = float(match[0].strip())
            field = match[1].strip()
            high = float(match[2].strip())
            value = snapshot.get(field)
            if value is None:
                return False
            return low <= float(value) <= high

    return True


def _enrich_snapshots_with_ta(snapshots: list[dict]) -> list[dict]:
    """Add Technical Analysis indicators (RSI, EMA, MACD, etc.) to snapshots."""
    return enrich_snapshots_with_indicators(snapshots)


def _btc_candle_color(snapshots: list[dict]) -> str | None:
    """Return 'green' if session BTC candle closed higher than open, else 'red'. None if unknown."""
    if not snapshots or len(snapshots) < 2:
        return None
    try:
        open_p = float(snapshots[0].get("btc_price") or 0)
        close_p = float(snapshots[-1].get("btc_price") or 0)
        if open_p <= 0:
            return None
        return "green" if close_p > open_p else "red"
    except (TypeError, ValueError):
        return None


def needs_prev_5_btc(query: ParsedQuery) -> bool:
    """True if any buy trigger uses prev_5_btc_candles_same_color (requires ordered markets + btc color per session)."""
    for t in query.buy_triggers or []:
        if "prev_5_btc_candles_same_color" in (t.get("condition") or ""):
            return True
    return False


def needs_ta_indicators(query: ParsedQuery) -> bool:
    """True if any condition uses technical indicators (RSI, EMA, MACD, etc.)."""
    ta_keywords = ['rsi', 'ema', 'macd', 'bb_', 'stoch', 'btc_rsi', 'btc_ema']
    conditions = []
    
    for t in query.buy_triggers or []:
        cond = t.get("condition") or ""
        if cond:
            conditions.append(cond)
    
    sell = query.sell_condition
    if sell and sell not in ("market_end", "immediate"):
        conditions.append(sell)
    
    for cond in conditions:
        cond_lower = cond.lower()
        for keyword in ta_keywords:
            if keyword in cond_lower:
                return True
    return False


def run_backtest_on_market(
    market: dict,
    query: ParsedQuery,
    snapshots: list[dict] | None = None,
    close_snapshot: dict | None = None,
    entry_snapshot: dict | None = None,
    entry_token: str | None = None,
    prev_5_btc_same_color: str | None = None,
) -> Trade | None:
    """Run backtest on a single market. Returns a Trade if entry condition is met.

    - If entry_snapshot and close_snapshot are provided: use them (entry_token required when multiple triggers).
    - Else: scan snapshots; evaluate buy_triggers in order; first condition that fires sets entry token and entry.
    """
    triggers = query.buy_triggers or []

    def _resolution_exit_for_token(m: dict, token: str) -> float | None:
        w = m.get("winner")
        if not w:
            return None
        if (token == "up" and w == "Up") or (token == "down" and w == "Down"):
            return 1.0
        return 0.0

    if entry_snapshot is not None and close_snapshot is not None:
        token = entry_token or (triggers[0].get("token") if len(triggers) == 1 else "up")
        price_field = query.price_field_for(token)
        entry_price = float(entry_snapshot.get(price_field) or 0)
        if query.sell_condition == "market_end":
            exit_price = _resolution_exit_for_token(market, token)
            if exit_price is None:
                exit_price = float(close_snapshot.get(price_field) or 0)
        else:
            exit_price = float(close_snapshot.get(price_field) or 0)
        return Trade(
            market_id=market.get("market_id", ""),
            market_slug=market.get("slug", ""),
            entry_time=entry_snapshot.get("time", ""),
            entry_price=entry_price,
            exit_time=close_snapshot.get("time", ""),
            exit_price=exit_price,
        )

    if not snapshots or not triggers:
        return None

    work_snapshots = _enrich_snapshots_for_btc(snapshots) if query.needs_btc_enrich() else snapshots
    
    # Enrich with Technical Analysis indicators if needed
    if needs_ta_indicators(query):
        work_snapshots = _enrich_snapshots_with_ta(work_snapshots)
    
    if prev_5_btc_same_color is not None:
        work_snapshots = [dict(s) for s in work_snapshots]
        for s in work_snapshots:
            s["prev_5_btc_candles_same_color"] = prev_5_btc_same_color

    # Keep full session for exit scan (price-based sell / exit_on_pct); then restrict to entry window for entry only
    snapshots_full = list(work_snapshots)
    entry_window = getattr(query, "entry_window_minutes", None) or 0
    entry_anchor = getattr(query, "entry_window_anchor", "end") or "end"
    if entry_window > 0:
        if entry_anchor == "start":
            start_str = market.get("start_time")
            try:
                start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00")) if start_str else None
                if not start_dt:
                    raise ValueError("missing start_time")
                end_dt = start_dt + timedelta(minutes=entry_window)
                filtered = []
                for s in work_snapshots:
                    t_str = s.get("time")
                    if not t_str:
                        continue
                    try:
                        snap_dt = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
                        if start_dt <= snap_dt <= end_dt:
                            filtered.append(s)
                    except (TypeError, ValueError):
                        continue
                work_snapshots = filtered
            except (TypeError, ValueError):
                pass
        else:
            end_str = market.get("end_time")
            if end_str:
                try:
                    end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                    cutoff = end_dt - timedelta(minutes=entry_window)
                    filtered = []
                    for s in work_snapshots:
                        t_str = s.get("time")
                        if not t_str:
                            continue
                        try:
                            snap_dt = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
                            if cutoff <= snap_dt <= end_dt:
                                filtered.append(s)
                        except (TypeError, ValueError):
                            continue
                    work_snapshots = filtered
                except (TypeError, ValueError):
                    pass

    found_entry = None
    token_used = None
    prev_snap = None
    for snap in work_snapshots:
        for t in triggers:
            cond = t.get("condition")
            if cond and _evaluate_condition(cond, snap, prev_snap):
                found_entry = snap
                token_used = t.get("token") or "up"
                break
        if found_entry is not None:
            break
        prev_snap = snap

    if not found_entry or not token_used:
        return None

    # Snapshots after entry (chronological) for price-based exit / exit_on_pct
    entry_time = found_entry.get("time") or ""
    exit_scan = sorted([s for s in snapshots_full if (s.get("time") or "") > entry_time], key=lambda s: s.get("time") or "")
    if not exit_scan and close_snapshot and (close_snapshot.get("time") or "") >= entry_time:
        exit_scan = [close_snapshot]

    price_field = query.price_field_for(token_used)
    # Default exit = resolution (session end) when sell is price-based; overwrite if condition met
    if query.sell_condition == "market_end":
        exit_snapshot = close_snapshot if close_snapshot else (snapshots_full[-1] if snapshots_full else work_snapshots[-1])
    else:
        exit_snapshot = close_snapshot if close_snapshot else (snapshots_full[-1] if snapshots_full else work_snapshots[-1])

    exit_on_pct = getattr(query, "exit_on_pct_move", None) or 0
    exit_pct_ref = getattr(query, "exit_pct_move_ref", "token") or "token"
    exit_pct_dir = getattr(query, "exit_pct_move_direction", "any") or "any"

    if exit_on_pct > 0:
        # Exit when price has moved X% from entry (direction: any | favor | against); scan full session after entry
        entry_val = None
        if exit_pct_ref == "btc":
            entry_val = found_entry.get("btc_price")
            try:
                entry_val = float(entry_val) if entry_val is not None else None
            except (TypeError, ValueError):
                entry_val = None
        else:
            entry_val = float(found_entry.get(price_field) or 0)
        if entry_val is not None and entry_val != 0:
            threshold = float(exit_on_pct)  # e.g. 0.2 for 0.2%
            for snap in exit_scan:
                cur_val = None
                if exit_pct_ref == "btc":
                    try:
                        cur_val = float(snap.get("btc_price") or 0)
                    except (TypeError, ValueError):
                        continue
                else:
                    cur_val = float(snap.get(price_field) or 0)
                pct_move = (cur_val - entry_val) / entry_val * 100.0
                if exit_pct_dir == "any" and abs(pct_move) >= threshold:
                    exit_snapshot = snap
                    break
                if exit_pct_dir == "favor" and pct_move >= threshold:
                    exit_snapshot = snap
                    break
                if exit_pct_dir == "against" and pct_move <= -threshold:
                    exit_snapshot = snap
                    break
    else:
        if query.sell_condition == "immediate":
            # Next snapshot in full session (not just entry window)
            if exit_scan:
                exit_snapshot = exit_scan[0]
        elif query.sell_condition not in ("market_end", None):
            # Scan full session after entry; if condition never met, exit_snapshot stays resolution (close_snapshot)
            entry_price_for_condition = float(found_entry.get(price_field) or 0)
            prev_exit_snap = found_entry  # Previous is entry snapshot for first iteration
            for snap in exit_scan:
                if _evaluate_condition(
                    query.sell_condition, snap, prev_exit_snap, entry_price=entry_price_for_condition
                ):
                    exit_snapshot = snap
                    break
                prev_exit_snap = snap

    entry_price = float(found_entry.get(price_field) or 0)
    # Resolution price when exiting at session end (market_end or price target never hit)
    if exit_snapshot is close_snapshot and close_snapshot:
        exit_price = _resolution_exit_for_token(market, token_used)
        if exit_price is None:
            exit_price = float(exit_snapshot.get(price_field) or 0)
    else:
        exit_price = float(exit_snapshot.get(price_field) or 0)

    return Trade(
        market_id=market.get("market_id", ""),
        market_slug=market.get("slug", ""),
        entry_time=found_entry.get("time", ""),
        entry_price=entry_price,
        exit_time=exit_snapshot.get("time", ""),
        exit_price=exit_price,
    )
