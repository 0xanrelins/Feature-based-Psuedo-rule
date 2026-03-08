# Glossary — Domain terms + Polymarket mapping

> Single reference: all terms are defined here. LLM prompt and mapping rules follow this.
> **Sources:** [Polymarket Docs](https://docs.polymarket.com/), [Polymarket CLI](https://github.com/Polymarket/polymarket-cli)

---

## Platform side (Polymarket)

| Term | Definition | Polymarket equivalent |
| :--- | :--- | :--- |
| **Market** | A single yes/no question; has start and end time; two outcomes (Yes/No). | [Markets & Events](https://docs.polymarket.com/) — market = condition + outcomes; CLI: `polymarket markets get`, `markets list`. |
| **Event** | Structure grouping related markets (e.g. "2024 Election"). | CLI: `polymarket events list`, `events get`. In our backtest, one market = one session. |
| **Token** | Tradeable share tied to one outcome. Ours: UP (price up) / DOWN (price down). | Polymarket Yes/No token; CLOB has `tokenID`, price 0–1. CLI: `clob price`, `clob book`. |
| **Resolution** | Market close; winning outcome is determined. | [Resolution](https://docs.polymarket.com/) — after resolution, winning token = 1, other = 0. |
| **CLOB** | Central limit order book; prices and orders live here. | [Orderbook](https://docs.polymarket.com/) — price history, order book. Our snapshots are CLOB price time series. |
| **Candle** | In trading/backtest: a price bar over a time period (open, high, low, close). "Same color" = same direction (green = close > open, red = close < open). In our system we have **snapshots** (point-in-time: time, price_up, price_down, btc_price); one snapshot = one "candle" close. "Candle" can mean: (1) one snapshot (token or btc price), or (2) external BTC OHLC bar. For "N candle sequence same color", infer from context; only ask if unclear: token snapshots vs BTC candles. | Snapshot = our data; candle = standard term. |

---

## Backtest domain (our model)

| Term | Definition | Slot / field |
| :--- | :--- | :--- |
| **Session** | One market's lifetime: `start_time` → `end_time`. Duration depends on market_type (5m, 15m, 1hr, 4hr, 24hr). | `market_type` defines session length; each resolved market = one session. |
| **Time range** | **Calendar interval** the backtest covers. Which sessions we look at (which date range of markets). | `start_time`, `end_time` (YYYY-MM-DD or datetime). |
| **Entry** | When and under what condition **buy** happens. | `buy_triggers`: list of `{ condition, token }`; first trigger wins. |
| **Entry condition** | Condition required for entry (price, BTC %, etc.). | `buy_triggers[i].condition` (e.g. `price_up >= 0.90`). |
| **Entry window** | **Time window** within the session when entry is allowed. E.g. "only in the last minute" = relative to session end; "only in the first 10 minutes" = relative to session start. | `entry_window_minutes` + `entry_window_anchor` (`end`=last N, `start`=first N). |
| **Exit** | When to **sell** (close position). | `sell_condition`: `market_end` \| `immediate` \| or price condition. |
| **market_end** | Close at session end; by resolution, winning token = 1, losing = 0. | `sell_condition = "market_end"`. |
| **entry_price** | Price at entry (filling). Use on the **right-hand side** in exit conditions for "X times entry price". | E.g. `sell_condition = "price_up >= 2 * entry_price"`. |
| **Exit on % move** | Sell when a **percent move** from entry price (or BTC price) occurs. E.g. "sell after 0.2% move" = exit when price moves 0.2% from entry. | `exit_on_pct_move` (number, e.g. 0.2), `exit_pct_move_ref` (token / btc), `exit_pct_move_direction` (any / favor / against). |
| **exit_pct_move_direction** | **Direction** of the % move that triggers exit: **any** = X% either way, **favor** = X% in our favor, **against** = X% against us (opposite side). | `"any"` \| `"favor"` \| `"against"`. |

---

## User expressions → which concept

- "Last 7 days", "last 3 days" → **time range** (calendar interval).
- "In the last minute", "last minute of the session" → **entry window** (relative to session; not data range).
- "Price 0.90", "above 0.60" → **entry condition**.
- "Sell at close", "market end", "resolution" → **exit** = `market_end`.
- "2x from filling/entry", "sell at 2x entry price" → **exit** condition: `price_up >= 2 * entry_price` (RHS `entry_price`; LHS current price).
- "Sell after 0.2% move", "exit when price moves X%" → **exit on % move** (`exit_on_pct_move` = X; direction defaults to `any`).
- "Moves opposite side", "when it moves against us" → **exit on % move** + direction = **against**.
- "In our favor", "when it moves in favor" → **exit on % move** + direction = **favor**.
- "UP" / "DOWN" → **token** (direction).

---

## Data source note

- **PolyBackTest API:** Historical snapshots we use in the backtest (per-market price series, resolution). Derivative of Polymarket CLOB history.
- **Polymarket CLI / Docs:** Reference for market structure, token, resolution, order book. Live/historical API may differ; our engine follows PolyBackTest.
