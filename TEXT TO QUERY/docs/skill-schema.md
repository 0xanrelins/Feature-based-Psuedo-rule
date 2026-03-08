# Text-to-Query Backtest Skill — Schema summary

User sentence → Parse (LLM or rule-based) → **ParsedQuery** → Backtest.

---

## ParsedQuery (main schema)

| Field | Type | Description |
|------|-----|----------|
| `market_type` | str | `5m` \| `15m` \| `1hr` \| `4hr` \| `24hr` |
| `start_time`, `end_time` | datetime | Backtest date range |
| `buy_triggers` | list[dict] | `[{ "condition": str, "token": "up" \| "down" }, ...]` — first trigger wins |
| `sell_condition` | str | `market_end` \| `immediate` \| or price/indicator condition |
| `price_source` | str | `token` \| `btc_price` |
| `entry_window_minutes` | int \| null | Entry only within N minutes of session (null = full session) |
| `entry_window_anchor` | str | `start` \| `end` (first / last N minutes) |
| `exit_on_pct_move` | float \| null | Exit when % move from entry (e.g. 0.2 = 0.2%) |
| `exit_pct_move_ref` | str | `token` \| `btc` |
| `exit_pct_move_direction` | str | `any` \| `favor` \| `against` |
| `action` | str | `backtest` \| `list_markets` \| `snapshot_at` |

---

## Condition expressions

- **Comparison:** `price_up > 0.60`, `rsi < 30`, `macd_hist > 0`
- **Equality:** `prev_5_btc_candles_same_color == "green"`
- **Range:** `0.40 <= price_up <= 0.60`
- **Crossover:** `ema_12 crosses_above price_up`, `rsi crosses_above 30` (previous snapshot required)

---

## Supported fields (snapshot)

**Price:** `price_up`, `price_down`, `btc_price`, `btc_pct_from_start`  
**Special:** `prev_5_btc_candles_same_color`  
**TA:** `rsi`, `rsi_7`, `ema_9`, `ema_12`, `ema_20`, `ema_26`, `ema_50`, `macd`, `macd_signal`, `macd_hist`, `bb_upper`, `bb_middle`, `bb_lower`, `stoch_rsi_k`, `stoch_rsi_d`, `btc_rsi`, `btc_ema_9`, `btc_ema_12`, `btc_ema_20`

Unsupported (clarification): vwap, atr, cci, williams, volume, obv, mfi, dmi, etc.

---

## Flow

1. **Parse:** User text + definments → LLM slots (or rule-based) → `ParsedQuery`
2. **Backtest:** List markets → load snapshots per market → enrich with TA (if needed) → evaluate entry/exit conditions → Trade list
3. **Output:** Win rate, PnL, trade details

---

## References

- Slot rules: `docs/mapping-rules.md`
- Terms: `docs/glossary.md`
- TA terms: `docs/backtest-crypto-trading-terminology-library.md`
