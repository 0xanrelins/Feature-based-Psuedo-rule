import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .config import VALID_TIMEFRAMES, VALID_TOKENS, MAX_DATA_RANGE_DAYS


def _price_field_for_token(token: str) -> str:
    return "price_down" if token == "down" else "price_up"


@dataclass
class ParsedQuery:
    """Strategy = list of (condition, token) pairs; first trigger that fires wins."""
    market_type: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    buy_triggers: list[dict] = None  # [{"condition": str, "token": "up"|"down"}, ...]; first match wins
    sell_condition: str | None = None
    action: str = "backtest"  # backtest | info | lookup
    price_source: str = "token"
    entry_window_minutes: int | None = None  # only allow entry within N minutes of session start/end; None = whole session
    entry_window_anchor: str = "end"  # "start" | "end" (default: end = last N minutes)
    exit_on_pct_move: float | None = None  # exit when price moved X% from entry (e.g. 0.2 = 0.2%)
    exit_pct_move_ref: str = "token"  # "token" | "btc"
    exit_pct_move_direction: str = "any"  # "any" | "favor" | "against" (opposite side)

    def __post_init__(self):
        if self.buy_triggers is None:
            self.buy_triggers = []

    @property
    def token_direction(self) -> str | None:
        """Single token if one trigger, else 'multi'. For display only."""
        if not self.buy_triggers:
            return None
        if len(self.buy_triggers) == 1:
            return self.buy_triggers[0].get("token") or "up"
        return "multi"

    def price_field_for(self, token: str) -> str:
        return _price_field_for_token(token)

    @property
    def price_field(self) -> str:
        return _price_field_for_token(self.token_direction or "up")

    def needs_btc_enrich(self) -> bool:
        return any("btc_pct_from_start" in (t.get("condition") or "") for t in self.buy_triggers)

    def missing_fields(self) -> list[str]:
        missing = []
        if not self.market_type:
            missing.append("market_type")
        if not self.start_time:
            missing.append("start_time")
        if not self.buy_triggers:
            missing.append("buy_triggers")
        return missing


# --- Market Type ---

TIMEFRAME_PATTERNS = {
    r"\b5\s*(?:m(?:in)?(?:ute)?s?|dk)\b": "5m",
    r"\b15\s*(?:m(?:in)?(?:ute)?s?|dk)\b": "15m",
    r"\bquarter\s*hour\b": "15m",
    r"\b(?:1\s*)?(?:hour|hr|saat)(?:ly)?\b": "1hr",
    r"\b4\s*(?:hour|hr|saat)s?\b": "4hr",
    r"\b(?:24\s*(?:hour|hr|saat)s?|daily|gunluk|1\s*day)\b": "24hr",
}


def parse_market_type(text: str) -> str | None:
    lower = text.lower()
    for tf in VALID_TIMEFRAMES:
        if re.search(rf"\b{re.escape(tf)}\b", lower):
            return tf
    for pattern, value in TIMEFRAME_PATTERNS.items():
        if re.search(pattern, lower):
            return value
    return None


# --- Time Range ---

TIME_RANGE_PATTERNS = [
    (r"last\s+(\d+)\s+days?", lambda m: int(m.group(1))),
    (r"past\s+(\d+)\s+days?", lambda m: int(m.group(1))),
    (r"son\s+(\d+)\s+gun", lambda m: int(m.group(1))),
    (r"last\s+(\d+)\s+weeks?", lambda m: int(m.group(1)) * 7),
    (r"past\s+week", lambda _: 7),
    (r"this\s+week", lambda _: 7),
    (r"past\s+month", lambda _: 30),
    (r"last\s+month", lambda _: 30),
]


def parse_time_range(text: str) -> tuple[datetime | None, datetime | None]:
    lower = text.lower()
    now = datetime.now(timezone.utc)

    for pattern, extractor in TIME_RANGE_PATTERNS:
        match = re.search(pattern, lower)
        if match:
            days = min(extractor(match), MAX_DATA_RANGE_DAYS)
            return now - timedelta(days=days), now

    if "yesterday" in lower or "dunden" in lower:
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now

    if "today" in lower or "bugun" in lower:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now

    date_range = re.search(
        r"between\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})", lower
    )
    if date_range:
        start = datetime.strptime(date_range.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end = datetime.strptime(date_range.group(2), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return start, end

    since = re.search(r"since\s+(\d{4}-\d{2}-\d{2})", lower)
    if since:
        start = datetime.strptime(since.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return start, now

    return None, None


# --- Token Direction ---

UP_PATTERNS = r"\b(?:up|bullish|goes?\s*up|rises?|yuksel|cikar|buy\s*up)\b"
DOWN_PATTERNS = r"\b(?:down|bearish|goes?\s*down|drops?|falls?|duser|iner|buy\s*down)\b"


def parse_token_direction(text: str) -> str | None:
    lower = text.lower()
    has_up = bool(re.search(UP_PATTERNS, lower))
    has_down = bool(re.search(DOWN_PATTERNS, lower))
    if has_up and not has_down:
        return "up"
    if has_down and not has_up:
        return "down"
    return None


# --- Price Conditions ---

def parse_price_condition(text: str, direction: str) -> str | None:
    """Extract a price threshold condition like 'price_up > 0.60'."""
    price_field = "price_up" if direction == "up" else "price_down"
    lower = text.lower()

    # X cent(s) -> 0.0X (e.g. 6 cent -> 0.06)
    cent = re.search(r"(\d+)\s*cent", lower)
    if cent:
        val = int(cent.group(1))
        if val <= 99:
            decimal = val / 100.0  # 6 -> 0.06
            # "touch to 6 cent" / "first price touch to 6 cent" = buy when price at or below that level
            if "touch" in lower or "at " + cent.group(1) in lower or "first" in lower:
                return f"{price_field} <= {decimal:.2f}"
            return f"{price_field} <= {decimal:.2f}"  # default: buy when cheap (at/below X cent)

    # "price 0.90", "at 0.90", "buy if price 0.90" → buy when price at or above that level
    at_price = re.search(r"(?:price\s+)?(?:at\s+|if\s+price\s+)?(0\.\d+)", lower)
    if at_price and "above" not in lower and "below" not in lower and "over" not in lower and "under" not in lower:
        return f"{price_field} >= {at_price.group(1)}"

    above = re.search(r"(?:above|over|>|crosses?|ustun)\s*(0\.\d+)", lower)
    if above:
        return f"{price_field} > {above.group(1)}"

    below = re.search(r"(?:below|under|<|altın)\s*(0\.\d+)", lower)  # altın = below (legacy)
    if below:
        return f"{price_field} < {below.group(1)}"
    # Legacy: "X altına" (below X) pattern
    below_tr = re.search(r"(0\.\d+)\s*(?:'ın|'in|un|in)?\s*alt[iı]na", lower)
    if below_tr:
        return f"{price_field} < {below_tr.group(1)}"

    around = re.search(r"(?:around|approximately|civari)\s*(0\.\d+)", lower)
    if around:
        val = float(around.group(1))
        return f"{val - 0.02} <= {price_field} <= {val + 0.02}"

    if any(w in lower for w in ("cheap", "low", "dusuk", "ucuz")):  # legacy Turkish
        return f"{price_field} < 0.40"
    if any(w in lower for w in ("expensive", "high", "yuksek", "pahali")):  # legacy Turkish
        return f"{price_field} > 0.60"

    return None


# --- Sell Condition ---

def parse_sell_condition(text: str, direction: str) -> str:
    lower = text.lower()

    if any(w in lower for w in ("immediately", "right away", "hemen", "aninda")):  # legacy Turkish
        return "immediate"

    sell_price = re.search(
        r"sell\s+(?:when|at|if)\s+(?:price\s+)?(?:above|over|>)\s*(0\.\d+)", lower
    )
    if sell_price:
        price_field = "price_up" if direction == "up" else "price_down"
        return f"{price_field} > {sell_price.group(1)}"

    return "market_end"


def parse_exit_on_pct_move(text: str) -> tuple[float | None, str]:
    """Return (exit_on_pct_move, exit_pct_move_direction). E.g. 'sell after 0.2% move' -> (0.2, 'any')."""
    lower = text.lower()
    pct = None
    # "0.2% move", "sell after 0.2% move", "X% move" (legacy: hareket/kar)
    m = re.search(r"(?:sell\s+after|exit\s+when|when\s+it\s+moves|moves?|hemen\s+.*?)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:move|moved|hareket|kar)?", lower)
    if not m:
        m = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:move|moved|hareket|kar)", lower)
    if not m:
        m = re.search(r"(\d+(?:\.\d+)?)\s*%\s+", lower)  # e.g. "0.1% in favor"
    if m:
        try:
            pct = float(m.group(1))
        except (ValueError, IndexError):
            pass
    direction = "any"
    if any(w in lower for w in ("opposite side", "moves opposite", "against us", "goes against", "against")):
        direction = "against"
    elif any(w in lower for w in ("in favor", "in our favor", "favor", "kar yönünde", "kar yonunde")):  # legacy Turkish
        direction = "favor"
    return pct, direction


# --- Action Type ---

def parse_action(text: str) -> str:
    lower = text.lower()
    backtest_signals = ("buy", "sell", "what if", "what would", "backtest",
                        "test strategy", "alsam", "satsam", "ne olurdu",
                        "profitable", "profit", "performance")
    if any(s in lower for s in backtest_signals):
        return "backtest"

    lookup_signals = ("right now", "current", "what is the price", "su an",
                      "at that time", "at that exact")
    if any(s in lower for s in lookup_signals):
        return "lookup"

    return "info"


# --- Main Parser ---

def parse_query(text: str, default_timeframe: str = "15m", default_token: str = "up") -> ParsedQuery:
    market_type = parse_market_type(text) or default_timeframe
    start_time, end_time = parse_time_range(text)
    token_direction = parse_token_direction(text) or default_token
    action = parse_action(text)

    buy_triggers = []
    sell_condition = "market_end"
    entry_window_minutes = None
    entry_window_anchor = "end"
    exit_on_pct_move = None
    exit_pct_move_direction = "any"

    if action == "backtest":
        buy_condition = parse_price_condition(text, token_direction)
        sell_condition = parse_sell_condition(text, token_direction)
        if buy_condition and token_direction:
            buy_triggers = [{"condition": buy_condition, "token": token_direction}]
        if re.search(r"\b(?:in the )?last minute\b", text.lower()) or re.search(r"\bpast minute\b", text.lower()):
            entry_window_minutes = 1
            entry_window_anchor = "end"
        if re.search(r"\b(?:in the )?first minute\b", text.lower()):
            entry_window_minutes = 1
            entry_window_anchor = "start"
        exit_on_pct_move, exit_pct_move_direction = parse_exit_on_pct_move(text)

    if not start_time:
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=30)
        end_time = now

    return ParsedQuery(
        market_type=market_type,
        start_time=start_time,
        end_time=end_time,
        buy_triggers=buy_triggers,
        sell_condition=sell_condition,
        action=action,
        entry_window_minutes=entry_window_minutes,
        entry_window_anchor=entry_window_anchor,
        exit_on_pct_move=exit_on_pct_move,
        exit_pct_move_direction=exit_pct_move_direction,
    )
