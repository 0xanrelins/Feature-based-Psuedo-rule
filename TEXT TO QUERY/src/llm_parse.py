"""
S3a: LLM-based parse — user question + definments (bounded context) → slots.
Returns structured slots and optional clarification_needed.

The LLM uses project resources (glossary, mapping-rules) as the single source of truth:
loads docs/glossary.md and docs/mapping-rules.md and injects them into the system prompt
so the model can fill slots from the user message by matching these rules. Definments
(in the user message) are used for defaults. clarification_needed only when genuinely ambiguous.

Supports OpenAI or OpenRouter (OpenAI-compatible API). Env:
  OPENROUTER_API_KEY  — use OpenRouter; model via OPENROUTER_MODEL (default: openai/gpt-4o-mini).
  OPENAI_API_KEY      — use OpenAI; model via OPENAI_LLM_MODEL (default: gpt-4o-mini).
OpenRouter takes precedence if both are set.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import Definments, VALID_TIMEFRAMES, VALID_TOKENS, MAX_DATA_RANGE_DAYS
from .parser import ParsedQuery

# Project root (parent of src/) so we can load docs/ at runtime
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DOCS_DIR = os.path.join(_PROJECT_ROOT, "docs")

# Cache loaded doc content to avoid reading disk on every call
_doc_cache: dict[str, str] = {}

# Extra sources loaded only when clarification_needed (lazy): PolyBackTest and context
_EXTRA_SOURCE_PATHS = [
    "polybacktest/introduction.md",
    "polybacktest/rate-limits.md",
    "polybacktest/api-reference/get-market-snapshots.md",
]

# Role: mapping is reference, not a limit; TA indicators are auto-calculated from snapshots.
_AGENT_ROLE = """You are a backtest and trading strategies analyst. You understand standard trading and backtest terminology (candle, OHLC, in profit direction, in our favor, take profit, stop loss, resolution, etc.). Your task is to parse the user's strategy into the structured schema. 

CRITICAL: The system AUTOMATICALLY calculates technical indicators (RSI, EMA, MACD, Bollinger Bands, Stochastic RSI) from the snapshot price series. When user mentions "RSI", "EMA", "MACD", etc., you can use them directly in conditions (e.g., "rsi > 30", "ema_12 > price_up"). The system computes these on-the-fly from price_up series by default.

The Glossary and Mapping below are references and examples—not an exhaustive list. Use them together with the terminology library and your own domain knowledge. If you understand what the user means, map it confidently; do not second-guess or pick a safer default just because the exact phrase is not in the mapping. Only set clarification_needed when you genuinely cannot resolve after using all sources and your knowledge."""

# JSON schema for structured output (OpenAI). Used only when OPENAI is used (not OpenRouter).
_LLM_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "backtest_slots",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["backtest", "list_markets", "snapshot_at"]},
                "market_type": {"type": "string", "enum": ["5m", "15m", "1hr", "4hr", "24hr"]},
                "price_source": {"type": "string", "enum": ["token", "btc_price"]},
                "start_time": {"type": "string"},
                "end_time": {"type": "string"},
                "buy_triggers": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "condition": {"type": "string"},
                            "token": {"type": "string", "enum": ["up", "down"]},
                        },
                        "required": ["condition", "token"],
                        "additionalProperties": False,
                    },
                },
                "sell_condition": {"type": "string"},
                "entry_window_minutes": {"type": "integer"},
                "entry_window_anchor": {"type": "string", "enum": ["start", "end"]},
                "exit_on_pct_move": {"type": "number"},
                "exit_pct_move_ref": {"type": "string", "enum": ["token", "btc"]},
                "exit_pct_move_direction": {"type": "string", "enum": ["any", "favor", "against"]},
                "clarification_needed": {"type": "string"},
            },
            "required": ["action", "buy_triggers"],
            "additionalProperties": False,
        },
    },
}


def _load_doc_path(relative_path: str) -> str:
    """Load a doc from docs/<relative_path>; return content or empty string. Cached."""
    cache_key = f"path:{relative_path}"
    if cache_key in _doc_cache:
        return _doc_cache[cache_key]
    path = os.path.join(_DOCS_DIR, relative_path)
    try:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            _doc_cache[cache_key] = content
            return content
    except OSError:
        pass
    _doc_cache[cache_key] = ""
    return ""


def _load_extra_sources() -> str:
    """Load PolyBackTest (and other) docs; used only on retry when clarification_needed."""
    parts = []
    for rel in _EXTRA_SOURCE_PATHS:
        content = _load_doc_path(rel)
        if content.strip():
            parts.append(f"---\n### {rel}\n---\n{content}")
    return "\n\n".join(parts) if parts else ""


def _get_llm_client():
    """
    Return (client, model_id) for LLM calls. Prefers OpenRouter if OPENROUTER_API_KEY is set,
    else OpenAI. Same chat-completion API (OpenRouter is OpenAI-compatible).
    """
    try:
        from openai import OpenAI
    except ImportError:
        return None, ""

    def _timeout_seconds() -> float:
        raw = (
            os.environ.get("MOTOR_LLM_TIMEOUT_SECONDS")
            or os.environ.get("LLM_PARSE_TIMEOUT_SECONDS")
            or ""
        ).strip()
        try:
            v = float(raw)
            if v > 0:
                return v
        except ValueError:
            pass
        return 20.0

    timeout_s = _timeout_seconds()
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if openrouter_key:
        return (
            OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=openrouter_key,
                timeout=timeout_s,
                max_retries=0,
            ),
            os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
        )
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key:
        return (
            OpenAI(api_key=openai_key, timeout=timeout_s, max_retries=0),
            os.environ.get("OPENAI_LLM_MODEL", "gpt-4o-mini"),
        )
    return None, ""


def _load_doc(filename: str) -> str:
    """Load a doc file from docs/; return content or empty string. Result is cached."""
    if filename in _doc_cache:
        return _doc_cache[filename]
    path = os.path.join(_DOCS_DIR, filename)
    try:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            _doc_cache[filename] = content
            return content
    except OSError:
        pass
    _doc_cache[filename] = ""
    return ""


def _build_system_prompt(include_extra_sources: bool = False) -> str:
    """
    Build system prompt: role + glossary + mapping-rules (+ optional extra sources).
    First call: include_extra_sources=False. On clarification_needed, retry with include_extra_sources=True
    so the model can consult PolyBackTest docs etc. before asking the user.
    """
    glossary = _load_doc("glossary.md")
    mapping_rules = _load_doc("mapping-rules.md")
    terminology_lib = _load_doc("backtest-crypto-trading-terminology-library.md")
    if not glossary.strip() and not mapping_rules.strip():
        return _fallback_system_prompt(include_extra_sources)

    schema = """{
  "action": "backtest" | "list_markets" | "snapshot_at",
  "market_type": "5m" | "15m" | "1hr" | "4hr" | "24hr",
  "price_source": "token" | "btc_price",
  "start_time": "YYYY-MM-DD",
  "end_time": "YYYY-MM-DD",
  "buy_triggers": [{"condition": "string", "token": "up"|"down"}, ...],
  "sell_condition": "market_end" | "immediate" | or condition string, or null,
  "entry_window_minutes": number or null,
  "entry_window_anchor": "start" | "end",
  "exit_on_pct_move": number or null,
  "exit_pct_move_ref": "token" | "btc",
  "exit_pct_move_direction": "any" | "favor" | "against",
  "clarification_needed": null or short question only when genuinely ambiguous
}"""

    extra_block = ""
    if include_extra_sources:
        extra = _load_extra_sources()
        if extra:
            extra_block = f"""
---
## Additional sources (API / backtest context — use to resolve ambiguity)
---
{extra}

---
Use the additional sources above to resolve the ambiguity. If you still cannot map to the schema, set clarification_needed with a short, specific question.
"""

    terminology_block = ""
    if terminology_lib.strip():
        terminology_block = f"""
---
## Terminology library (backtest/crypto vocabulary — use to understand user terms)
---
{terminology_lib}
"""
    return f"""{_AGENT_ROLE}

Output valid JSON only, no markdown.

---
## Glossary (domain terms and user phrases → concept)
---
{glossary}

---
## Mapping rules (user phrase → domain field / slot)
---
{mapping_rules}
{terminology_block}
---
## Output schema
---
{schema}

---
## Examples (follow these patterns)
---
User: "if btc price dips 2% buy up in the first 3 minutes"
→ Entry is about BTC dipping 2%: use btc_pct_from_start <= -2 (not price_up). Entry window: first 3 minutes.

User: "when up token 2x from filling price sell"
→ Exit is "2x from entry": use sell_condition = "price_up >= 2 * entry_price". Use entry_price on the RHS, never price_up on both sides.

---
## Instructions
---
Glossary and Mapping are references; use them plus the terminology library and your trading/backtest knowledge. Interpret user phrases confidently (e.g. "in profit direction" → exit_pct_move_direction: favor). Use definments for defaults. action: backtest when user describes a buy/sell strategy. Only set clarification_needed when genuinely ambiguous.

Condition grammar: For BTC % use btc_pct_from_start (e.g. dips 2% → btc_pct_from_start <= -2). For token price use price_up or price_down. For "X from entry/filling" use entry_price on the RHS only (e.g. price_up >= 2 * entry_price). Never use the same field on both sides (e.g. price_up >= 2 * price_up is invalid).{extra_block}"""


def _fallback_system_prompt(include_extra_sources: bool = False) -> str:
    """When glossary/mapping cannot be loaded. Still add role and optionally extra sources."""
    base = f"""{_AGENT_ROLE}

Output valid JSON only, no markdown. Schema:
{
  "action": "backtest" | "list_markets" | "snapshot_at",
  "market_type": "5m" | "15m" | "1hr" | "4hr" | "24hr",
  "price_source": "token" | "btc_price",
  "start_time": "YYYY-MM-DD",
  "end_time": "YYYY-MM-DD",
  "buy_triggers": [{"condition": "string", "token": "up"|"down"}, ...],
  "sell_condition": "market_end" | "immediate" | or condition string (e.g. price_up >= 2 * entry_price for 2x from entry), or null,
  "entry_window_minutes": number or null,
  "entry_window_anchor": "start" | "end",
  "exit_on_pct_move": number or null,
  "exit_pct_move_ref": "token" | "btc",
  "exit_pct_move_direction": "any" | "favor" | "against",
  "clarification_needed": null or short question only when genuinely ambiguous
}

Mapping (user phrase → domain field; use definments when user does not specify):
1) Session: "5m","15m","1hr","4hr","24hr". Default: definments.timeframe.
2) Time range: Use "Today's date" from user message. "last N days" → start = today minus N, end = today. Default: definments.data_range_days.
3) Token: "up"/"down", "buy up"/"buy down". Default: definments.token.
4) Entry (buy_triggers): "above 0.XX" → price_up > 0.XX; "below 0.XX" → price_up < 0.XX; "X cent" → price_up <= 0.0X. Follow BTC → btc_pct conditions; Opposite BTC → tokens swapped.
5) Entry window: "in the last minute" → entry_window_minutes = 1 and entry_window_anchor="end". "in the first N minutes" → entry_window_minutes = N and entry_window_anchor="start".
6) Exit: "at close"/"market end" → market_end; "sell immediately" → immediate. "2x from filling/entry" → sell_condition = "price_up >= 2 * entry_price" (use entry_price on RHS, not price_up). Default: market_end.
7) Exit on % move: "sell when it moves X%" → exit_on_pct_move = X; "in our favor"/"when it moves in favor" → exit_pct_move_direction = "favor"; "against us"/"opposite side" → "against". Default direction "any".
Condition grammar: BTC % → btc_pct_from_start (e.g. dips 2% → btc_pct_from_start <= -2). Token price → price_up/price_down. "X from entry" → entry_price on RHS only. Never same field on both sides (e.g. price_up >= 2 * price_up is invalid).
Only set clarification_needed when intent is truly ambiguous."""
    if include_extra_sources:
        extra = _load_extra_sources()
        if extra:
            base += f"\n\n## Additional sources\n\n{extra}\n\nUse these to resolve ambiguity; if still unclear, set clarification_needed."
    return base


def _user_asked_indicator(user_text: str) -> str | None:
    """Check if user mentioned unsupported indicator in their query."""
    text_lower = user_text.lower()
    for indicator in _UNSUPPORTED_INDICATORS:
        if indicator in text_lower:
            return indicator
    return None


def parse_with_llm(user_text: str, defs: Definments) -> dict[str, Any] | None:
    """
    S3a: Call LLM with bounded context; return slots dict or None if LLM unavailable.
    Keys: action, market_type, token_direction, start_time, end_time, buy_condition, sell_condition, clarification_needed.
    """
    # Check if user text mentions an unsupported indicator
    unsupported = _user_asked_indicator(user_text)
    if unsupported:
        available = ", ".join(_SUPPORTED_FIELDS)
        return {
            "clarification_needed": f"'{unsupported.upper()}' is not available. Usable fields: {available}. Please specify a condition using price_up, price_down, btc_price, or btc_pct_from_start."
        }
    
    client, model = _get_llm_client()
    if not client:
        return None

    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    context = (
        f"Definments: platform={defs.platform}, topic={defs.topic}, pair={defs.pair}, "
        f"timeframe={defs.timeframe}, token={defs.token}, data_range_days={defs.data_range_days}, "
        f"data_platform={defs.data_platform}. Today's date (use for start_time/end_time): {today_iso}."
    )
    user_msg = f"{context}\n\nUser question: {user_text}"

    use_structured_output = not os.environ.get("OPENROUTER_API_KEY", "").strip()

    def _call_llm(include_extra_sources: bool) -> dict[str, Any] | None:
        system_content = _build_system_prompt(include_extra_sources=include_extra_sources)
        kwargs = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.1,
        }
        if use_structured_output:
            kwargs["response_format"] = _LLM_RESPONSE_SCHEMA
        try:
            resp = client.chat.completions.create(**kwargs)
            text = resp.choices[0].message.content or "{}"
            text = text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(l for l in lines if not l.strip().startswith("```"))
            return json.loads(text)
        except Exception:
            return None

    out = _call_llm(include_extra_sources=False)
    if out is None:
        return None
    if out.get("clarification_needed"):
        retry = _call_llm(include_extra_sources=True)
        if retry is not None:
            return retry
    return out


def _parse_llm_date(s: str) -> datetime | None:
    """Parse YYYY-MM-DD to datetime 00:00 UTC."""
    if not s or not isinstance(s, str):
        return None
    try:
        return datetime.strptime(s.strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def llm_slots_to_parsed_query(slots: dict[str, Any], defs: Definments) -> ParsedQuery:
    """Convert LLM slots dict to ParsedQuery (S3b: use when no clarification_needed)."""
    now = datetime.now(timezone.utc)
    start_d = _parse_llm_date(slots.get("start_time") or "")
    end_d = _parse_llm_date(slots.get("end_time") or "")
    if start_d is not None and end_d is not None and start_d <= end_d:
        start = start_d
        end = end_d.replace(hour=23, minute=59, second=59, microsecond=999999)
        if end > now:
            end = now
    else:
        days = min(defs.data_range_days, MAX_DATA_RANGE_DAYS)
        start = now - timedelta(days=days)
        end = now

    market_type = (slots.get("market_type") or defs.timeframe or "15m").lower()
    if market_type not in VALID_TIMEFRAMES:
        market_type = "15m"

    raw_triggers = slots.get("buy_triggers")
    buy_triggers = []
    if isinstance(raw_triggers, list):
        for t in raw_triggers:
            if isinstance(t, dict) and t.get("condition") and t.get("token") in ("up", "down"):
                cond = str(t["condition"])
                if "btc_pct" in cond and "btc_pct_from_start" not in cond:
                    cond = cond.replace("btc_pct", "btc_pct_from_start")
                buy_triggers.append({"condition": cond, "token": t["token"]})

    price_source = (slots.get("price_source") or "token").lower()
    if price_source not in ("token", "btc_price"):
        price_source = "token"
    if any("btc_pct_from_start" in (t.get("condition") or "") for t in buy_triggers):
        price_source = "btc_price"

    ew = slots.get("entry_window_minutes")
    entry_window_minutes = None
    if ew is not None:
        try:
            n = int(ew)
            if n > 0:
                entry_window_minutes = n
        except (TypeError, ValueError):
            pass
    entry_window_anchor = (slots.get("entry_window_anchor") or "end").lower()
    if entry_window_anchor not in ("start", "end"):
        entry_window_anchor = "end"

    exit_on_pct = None
    try:
        v = slots.get("exit_on_pct_move")
        if v is not None:
            f = float(v)
            if f > 0:
                exit_on_pct = f
    except (TypeError, ValueError):
        pass
    exit_pct_ref = (slots.get("exit_pct_move_ref") or "token").lower()
    if exit_pct_ref not in ("token", "btc"):
        exit_pct_ref = "token"
    exit_pct_dir = (slots.get("exit_pct_move_direction") or "any").lower()
    if exit_pct_dir not in ("any", "favor", "against"):
        exit_pct_dir = "any"

    return ParsedQuery(
        market_type=market_type,
        start_time=start,
        end_time=end,
        buy_triggers=buy_triggers,
        sell_condition=slots.get("sell_condition") or "market_end",
        action=slots.get("action") or "backtest",
        price_source=price_source,
        entry_window_minutes=entry_window_minutes,
        entry_window_anchor=entry_window_anchor,
        exit_on_pct_move=exit_on_pct,
        exit_pct_move_ref=exit_pct_ref,
        exit_pct_move_direction=exit_pct_dir,
    )


# Supported fields — only these may be used inside conditions
_SUPPORTED_FIELDS = [
    "price_up", "price_down", "btc_price", "btc_pct_from_start",
    "prev_5_btc_candles_same_color",
    # Technical Analysis indicators (now supported via pandas-ta)
    "rsi", "rsi_7", "stoch_rsi_k", "stoch_rsi_d",
    "ema_9", "ema_12", "ema_20", "ema_26", "ema_50",
    "macd", "macd_signal", "macd_hist",
    "bb_upper", "bb_middle", "bb_lower",
    "btc_rsi", "btc_ema_9", "btc_ema_12", "btc_ema_20"
]

# Unsupported indicators — if seen, clarification is required
# NOTE: RSI, EMA, MACD, Bollinger, Stochastic are now supported (see _SUPPORTED_FIELDS above)
_UNSUPPORTED_INDICATORS = [
    "vwap", "atr", "cci", "williams", "adx", "ichimoku", "fibonacci", "pivot",
    "support", "resistance", "volume", "obv", "mfi", "dmi"
]


def _condition_has_same_field_on_both_sides(condition: str) -> bool:
    """True if condition uses same field on both sides (e.g. price_up <= 0.98 * price_up). Invalid."""
    c = condition.strip()
    for field in ("price_up", "price_down"):
        if field not in c:
            continue
        # RHS has * field or / field → same field on both sides
        if re.search(r"[\*\/]\s*" + re.escape(field) + r"\b", c):
            return True
    return False


def _validate_conditions(slots: dict[str, Any]) -> str | None:
    """Check for unsupported indicators in conditions. Returns clarification message or None."""
    conditions = []
    raw_triggers = slots.get("buy_triggers", [])
    if isinstance(raw_triggers, list):
        for t in raw_triggers:
            if isinstance(t, dict) and t.get("condition"):
                conditions.append(str(t["condition"]))
    
    sell = slots.get("sell_condition")
    if sell and isinstance(sell, str) and sell not in ("market_end", "immediate"):
        conditions.append(sell)
    
    for cond in conditions:
        if _condition_has_same_field_on_both_sides(cond):
            return (
                "Same field used on both sides of condition (e.g. price_up >= 2 * price_up). "
                "Use btc_pct_from_start for BTC %, and entry_price on the right-hand side for entry price multiples."
            )
    
    cond_text = " ".join(conditions).lower()
    
    # Check for unsupported indicators
    for indicator in _UNSUPPORTED_INDICATORS:
        if indicator in cond_text:
            available = ", ".join(_SUPPORTED_FIELDS)
            return f"'{indicator.upper()}' is not available. Usable fields: {available}. Please specify another condition."
    
    return None


def needs_clarification(slots: dict[str, Any]) -> bool:
    """S3b: True if agent should ask the user (S2)."""
    if slots.get("clarification_needed"):
        return True
    
    # Unsupported indicator check
    if _validate_conditions(slots):
        return True
    
    action = (slots.get("action") or "backtest").lower()
    if action == "backtest":
        triggers = slots.get("buy_triggers")
        if not triggers or not isinstance(triggers, list) or len(triggers) == 0:
            return True
    return False


def get_clarification_message(slots: dict[str, Any]) -> str | None:
    """Message to show user when needs_clarification(slots) is True."""
    # Check for unsupported indicators first
    unsupported_msg = _validate_conditions(slots)
    if unsupported_msg:
        return unsupported_msg
    return slots.get("clarification_needed") or "I need a bit more detail to run this. What exactly do you want to buy/sell and when?"
