# Mapping Rules

> **User expression → domain field** examples and guide. This file is **not restrictive**: the LLM should confidently map terms it understands from the glossary, terminology library, and domain knowledge (in profit direction, in our favor, take profit, resolution, etc.); it should not hold back because "it's not in the mapping".
> **Domain terms:** [docs/glossary.md](glossary.md) — session, time range, entry, exit.

---

## 0. Definments (Bounded Context)

User should define these or the agent should ask. Defaults:

| Definment | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `platform` | Prediction market platform | polymarket | polymarket |
| `topic` | Topic | crypto | crypto |
| `pair` | Pair | btc | btc |
| `timeframe` | Session length type (market_type) | 15m | 5m, 15m, 1hr, 4hr, 24hr |
| `token` | Default direction (UP/DOWN) | up | up, down |
| `data_range` | Default time range | last 30 days | last 7 days, last 30 days |
| `data_platform` | Data source | polybacktest | polybacktest |

---

## 1. Session (market_type)

**Domain:** What session length type? (Glossary: Session = one market's lifetime; `market_type` defines duration.)

| User expression | Domain field | Slot / API |
| :--- | :--- | :--- |
| "5 minutes", "5min", "5m" | market_type | `5m` |
| "15 minutes", "15m", "quarter hour" | market_type | `15m` |
| "1 hour", "hourly", "1hr" | market_type | `1hr` |
| "4 hours", "4hr" | market_type | `4hr` |
| "daily", "24 hours", "24hr", "1 day" | market_type | `24hr` |

If not specified → definments.timeframe (default 15m).

---

## 2. Time range (start_time, end_time)

**Domain:** Which calendar range of sessions should the backtest use? (Glossary: Time range.)

| User expression | Domain field | Computation |
| :--- | :--- | :--- |
| "last N days", "past N days", "over the last N days" | start_time, end_time | start = today − N days, end = today (YYYY-MM-DD). N 1–31. |
| "past week", "this week" | start_time, end_time | start = today − 7, end = today |
| "past month", "last month" | start_time, end_time | start = today − 30, end = today |
| "since yesterday" | start_time, end_time | start = yesterday 00:00 UTC, end = now |
| "today" | start_time, end_time | start = today 00:00 UTC, end = now |
| "since {date}", "between {date1} and {date2}" | start_time, end_time | Given dates (ISO8601). |

**Rule:** If end_time is omitted = now. **Limit:** Max 31 days; older requests are rejected.  
**If not specified:** definments.data_range (e.g. last 30 days). **Reference date:** Pass "Today's date" to the LLM in context; year is not guessed.

---

## 3. Token (direction)

**Domain:** Which token (UP/DOWN)? (Glossary: Token.)

| User expression | Domain field | Slot |
| :--- | :--- | :--- |
| "up", "UP", "goes up", "rises", "buy up", "bullish" | token | `up` → price_up |
| "down", "DOWN", "goes down", "drops", "buy down", "bearish" | token | `down` → price_down |

If not specified → definments.token (default up).  
**Note:** UP = bet on BTC up, DOWN = down; price 0–1 (probability).

---

## 4. Entry condition (buy_triggers[].condition)

**Domain:** Entry condition — at what price/BTC condition do we buy? (Glossary: Entry condition.)

| User expression | Domain field | Condition (example, for UP) |
| :--- | :--- | :--- |
| "above 0.XX", "price > 0.XX", "crosses 0.XX" | entry condition | `price_up > 0.XX` |
| "below 0.XX", "under 0.XX", "price < 0.XX" | entry condition | `price_up < 0.XX` |
| "price 0.XX", "at 0.XX", "if price 0.XX" (no above/below) | entry condition | `price_up >= 0.XX` (entry when price reaches 0.XX) |
| "X cent", "touch X cent", "first touch 6 cent" | entry condition | `price_up <= 0.0X` (6 cent → 0.06) |
| "when cheap", "when low" | entry condition | `price_up < 0.40` |
| "when expensive", "when high" | entry condition | `price_up > 0.60` |
| "around 0.50" | entry condition | `0.48 <= price_up <= 0.52` |

For DOWN use `price_down` instead of `price_up`.  
**Multiple conditions (trigger list):** "Follow BTC X%" → two triggers (btc_pct >= X → up, btc_pct <= -X → down); "opposite BTC" → same conditions, tokens swapped. First trigger wins.

---

## 5. Entry window (optional)

**Domain:** Should entry be allowed only in a specific time window within the session? (Glossary: Entry window.)

| User expression | Domain field | Note |
| :--- | :--- | :--- |
| "in the last minute", "last N minutes of the session" | entry window | Relative to session end. **Slot:** `entry_window_minutes=N`, `entry_window_anchor="end"`. |
| "in the first minute", "first N minutes of the session" | entry window | Relative to session start. **Slot:** `entry_window_minutes=N`, `entry_window_anchor="start"`. |

Single mapping source for this field: glossary "User expressions → which concept" (entry window = relative to session, not data range).

---

## 6. Exit (sell_condition)

**Domain:** When to sell? (Glossary: Exit, market_end.)

| User expression | Domain field | Slot |
| :--- | :--- | :--- |
| "at close", "market end", "resolution", "session end", "sell at close" | exit | `sell_condition = "market_end"` |
| "sell immediately", "exit right away" | exit | `sell_condition = "immediate"` |
| "sell when price above 0.XX" | exit | `sell_condition = "price_up > 0.XX"` (or price_down) |
| "2x from filling/entry", "double from entry", "when price 2x from fill" | exit | `sell_condition = "price_up >= 2 * entry_price"` (use price_down for DOWN) |

**Entry price in exit condition:** If user says "X times filling price", "2x from entry", always use `entry_price` on the **right-hand side**; current price field (`price_up` / `price_down`) only on the **left**. Example: `price_up >= 2 * entry_price`. Wrong: `price_up >= 2 * price_up`.

If not specified → `market_end`.

**Exit on % move (exit_on_pct_move, exit_pct_move_direction):** Exit when price moves X% from entry.

| User expression | Domain field | Slot |
| :--- | :--- | :--- |
| "sell after 0.2% move", "exit when price moves X%", "sell when it moves X%" | exit_on_pct_move | number (e.g. 0.2) |
| "moves opposite side", "when it moves against us", "sell when it goes against" | exit_pct_move_direction | `against` |
| "in our favor", "when it moves in favor" | exit_pct_move_direction | `favor` |
| If direction not specified | exit_pct_move_direction | `any` |
| "when BTC moves X%" | exit_pct_move_ref | `btc` (otherwise `token`) |

**Direction / opposite (entry):** "Opposite side", "fade BTC", "opposite of BTC" → which side to buy: opposite of BTC (Opposite BTC trigger list; tokens swapped).

---

## 7. Entry logic (scan, first trigger wins)

**Domain:** Entry = first snapshot (in time order) where entry condition (and optional entry window) is satisfied. Scan from session start; cap by market timeframe. If condition is never satisfied, no trade in that market. **Trigger list:** If multiple `{ condition, token }`, evaluate in order; first true one defines entry token and entry.

---

## 8. Endpoint selection

| User intent | Rule | API flow |
| :--- | :--- | :--- |
| "list markets", "which markets" | List | `GET /v1/markets?market_type=...&resolved=...` |
| Specific date + timeframe | Single market | `GET /v1/markets/by-slug/...` |
| "backtest", "what if I bought", "test strategy" | Backtest | `GET /v1/markets` (resolved) → per market `GET /v1/markets/{id}/snapshots` → apply entry/exit conditions |
| "right now", "at that exact time" | Snapshot-at | `GET /v1/markets/{id}/snapshot-at/{timestamp}` |

---

## 9. Exit price (market_end)

When **sell_condition = market_end**, exit price comes from **market.winner**: winning token = 1.0, losing = 0.0. Snapshots do not have winner; read from market object.

---

## 10. Example: User question → domain + flow

| User question | Time range | Session | Token | Entry condition | Exit | Flow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| "What if I bought UP above 0.60 in 15m over the last 7 days and sold at close?" | last 7 days | 15m | up | price_up > 0.60 | market_end | Backtest: list markets → snapshots → first trigger |
| "Buy first touch 6 cent, sell at session end" | (definments) | (definments) | up | price_up <= 0.06 | market_end | Same |
| "What's the current UP price in 1hr market?" | — | 1hr | up | — | — | Snapshot-at now |

---

## 11. Errors / missing info

| Situation | Agent behavior |
| :--- | :--- |
| Missing definment (e.g. no timeframe) | Ask: "Which timeframe? (5m, 15m, 1hr, 4hr, 24hr)" |
| Request older than 31 days | Warn: "At most 31 days of data are supported." |
| Ambiguous condition | Use default, inform user |
| API 401 / 404 / 429 | Return appropriate error (key, not found, rate limit) |
