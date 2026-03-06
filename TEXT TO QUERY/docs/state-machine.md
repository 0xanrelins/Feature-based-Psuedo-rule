# State Machine

> Defines the agent's step-by-step flow when processing a user query.
> Each state describes: what the agent checks, what it does, and where it goes next.

---

## Overview

```
USER QUERY
    │
    ▼
┌─────────────┐     missing     ┌─────────────────────────┐
│  S1: VERIFY │ ──────────────► │ S2: ASK USER            │
│  DEFINMENTS │                 │ (missing or unclear)     │
└──────┬──────┘                 └────────────┬─────────────┘
       │ complete                            │ user responds
       ▼                                     │
┌─────────────┐◄─────────────────────────────┘
│ S3a: LLM    │
│   PARSE     │  (definements + user text → slots)
└──────┬──────┘
       │
       ▼
┌─────────────┐   clarification   ┌─────────────────────────┐
│ S3b: CHECK  │ ────────────────► │ S2: ASK USER            │
│   SLOTS     │   needed          │ (clarification_needed)  │
└──────┬──────┘                   └─────────────────────────┘
       │ all filled & clear
       ▼
┌──────────────┐
│ S4: SELECT   │
│   ENDPOINT   │
└──────┬───────┘
       │
       ▼
┌──────────────┐     error      ┌─────────────────┐
│ S5: BUILD    │ ──────────────►│ S6: HANDLE      │
│    OUTPUT    │                │    ERROR        │
└──────┬───────┘                └─────────────────┘
       │ success
       ▼
┌──────────────┐
│ S7: DELIVER  │
│    RESULT    │
└──────────────┘
```

---

## State Definitions

### S1: VERIFY DEFINMENTS

**Purpose:** Check if all required definments are set before processing.

| Check | Required | Default |
| :--- | :--- | :--- |
| `platform` | Yes | polymarket |
| `topic` | Yes | crypto |
| `pair` | Yes | btc |
| `timeframe` | Yes | 15m |
| `token` | Yes | up |
| `data_range` | Yes | last 30 days |
| `data_platform` | Yes | polybacktest |

**Transitions:**
- All definments present → go to **S3a**
- One or more missing → go to **S2**

---

### S2: ASK USER (missing definments or clarification)

**Purpose:** Get missing or unclear information from the user. Two triggers:
1. **S1 → S2:** One or more definments are missing.
2. **S3b → S2:** LLM returned `clarification_needed` or a required slot is empty/ambiguous.

**Behavior:**
- **Missing definments:** Ask in one prompt (e.g. timeframe, token, range). Fill gaps from response.
- **Clarification (from LLM):** Show the LLM’s `clarification_needed` message (e.g. "Do you mean: sell at market end, or at a specific price?"). Use the user’s reply as additional context and go back to S3a (re-run LLM parse with original question + reply, or with reply only for that slot).

**Example prompts:**
> "I need a few details: Timeframe (5m, 15m, 1hr, 4hr, 24hr)? Token: UP or DOWN?"
> "I’m not sure what you mean by ‘sell’. Do you mean: at market end (resolution), or when price hits a certain level?"

**Transitions:**
- User provides values / clarification → go to **S3a** (or S1 if only definments were filled)
- User unclear or cancels → stay in **S2**, re-ask

---

### S3a: LLM PARSE (fill slots)

**Purpose:** Use an LLM with **bounded context (definements)** to turn the user’s natural language into structured slots. The LLM must not invent outside definments; it only maps the sentence into the schema.

**Input:** User query text + current definments (platform, topic, pair, timeframe, token, data_range, data_platform).

**Output:** A structured object with slots, and optionally `clarification_needed`:

| Slot | Description | Example |
| :--- | :--- | :--- |
| `action` | backtest \| list_markets \| snapshot_at | `"backtest"` |
| `market_type` | 15m, 5m, 1hr, 4hr, 24hr | `"15m"` |
| `start_time` / `end_time` | ISO8601 or derived from data_range | — |
| `buy_triggers` | List of `{condition, token}`; **first trigger that fires wins** | See below |
| `sell_condition` | market_end \| immediate \| or condition | — |
| `clarification_needed` | Optional. If unclear or required slot missing, LLM sets this and may leave slots empty. | `"Do you mean sell at market end or at a price?"` |

**Trigger-list model:** Strategy is expressed as `buy_triggers: [{ "condition": "string", "token": "up"|"down" }, ...]`. Backtest evaluates conditions in order; the first that is true sets the entry token (and we buy that side). Examples: single side = one element; follow BTC (e.g. 0.5% move) = `[{condition: "btc_pct_from_start >= 0.5", token: "up"}, {condition: "btc_pct_from_start <= -0.5", token: "down"}]`; opposite BTC = same conditions with tokens swapped.

**Example output (no clarification):**
```json
{
  "action": "backtest",
  "market_type": "15m",
  "start_time": "2026-01-28",
  "end_time": "2026-02-27",
  "buy_triggers": [{"condition": "price_up <= 0.30", "token": "up"}],
  "sell_condition": "market_end"
}
```

**Example output (clarification needed):**
```json
{
  "action": "backtest",
  "buy_triggers": [],
  "sell_condition": null,
  "clarification_needed": "When do you want to sell: at market end (resolution), or when price hits a target?"
}
```

**Transitions:**
- LLM returns filled slots → go to **S3b**
- (Implementation may validate before S3b.)

---

### S3b: CHECK SLOTS

**Purpose:** Decide if parsing is complete or the agent must ask the user.

**Checks:**
- Required slots for the inferred `action` are present and valid (e.g. backtest needs buy_triggers non-empty, sell_condition, market_type, range).
- No `clarification_needed` from LLM.

**Transitions:**
- All required slots filled and no `clarification_needed` → go to **S4**
- Missing required slot or `clarification_needed` set → go to **S2** (ask user; show clarification message or "I need: …")

---

### S4: SELECT ENDPOINT

**Purpose:** Determine which API endpoint(s) to call based on the parsed parameters. Uses Mapping Rules Section 7.

| Parsed Action | Endpoint Rule | API Call |
| :--- | :--- | :--- |
| List/explore markets | Rule 1 | `GET /v1/markets` |
| Lookup specific market | Rule 2 | `GET /v1/markets/by-slug/{slug}` |
| Backtest strategy | Rule 3 | `GET /v1/markets` → `GET /v1/markets/{id}/snapshots` |
| Point-in-time lookup | Rule 4 | `GET /v1/markets/{id}/snapshot-at/{timestamp}` |

**Transitions:**
- Endpoint determined → go to **S5**

---

### S4b: CONFIRM STRATEGY (Backtest only) — MANDATORY

**Purpose:** Before running a backtest, the agent must share what it understood and the exact query, then get explicit user approval. No backtest run before confirmation.

**Required flow (do not skip):**

1. **Share parse and query**
   - Show the parsed parameters in a clear table (action, timeframe, token, range, buy_when, sell_when).
   - Optionally: "I understood the strategy as: [list each trigger: BUY {token} when {condition}]. First trigger that fires wins. SELL at {sell_condition}. Timeframe: {tf}. Data: {start} → {end}."

2. **Ask for confirmation**
   - Explicitly ask: "Is this correct? Confirm to run the backtest." (or equivalent).

3. **Run only after confirmation**
   - Do **not** run the backtest, write scripts, or save test summaries until the user confirms (e.g. "yes", "do it", "run it", or re-run with `--confirm`).
   - If the user corrects the interpretation, re-parse and show the new query, then ask again.

**Rule:** Every backtest request follows this flow. The agent never assumes confirmation; it always shows understanding first and waits for approval.

**Transitions:**
- User confirms → go to **S5** (build/run).
- User does not confirm or corrects → do not run; stay at summary or re-parse.

---

### S5: BUILD OUTPUT

**Purpose:** Generate the final output — either an API call sequence, a script, or a direct answer.

**Output types:**

#### Type A: Single API Call
When the user just needs data (market info, current price).
```bash
curl -X GET "https://api.polybacktest.com/v1/markets/by-slug/btc-updown-15m-2026-02-27-09" \
  -H "X-API-Key: $API_KEY"
```

#### Type B: Multi-Step Script (Backtest)
When the user wants to test a strategy across multiple markets.
```
1. Fetch resolved markets:
   GET /v1/markets?market_type=15m&resolved=true&limit=100

2. For each market, fetch snapshots:
   GET /v1/markets/{market_id}/snapshots?include_orderbook=false

3. Apply strategy logic:
   - Scan snapshots; evaluate buy_triggers in order; first condition that is true sets entry token and entry price
   - Find exit point (market end or sell_condition)
   - Calculate P&L per market

4. Aggregate results:
   - Total trades, win rate, total P&L
```

#### Type C: Direct Answer
When the agent can answer from context without an API call (e.g., "what timeframes are available?").

**Transitions:**
- Output built successfully → go to **S7**
- Error during build (invalid params, impossible query) → go to **S6**

---

### S6: HANDLE ERROR

**Purpose:** Handle errors gracefully and guide the user.

| Error Type | Response |
| :--- | :--- |
| Data range > 31 days | "PolyBackTest supports max 31 days. Please shorten your range." |
| Invalid market_type | "Valid options: 5m, 15m, 1hr, 4hr, 24hr." |
| No matching endpoint | "I couldn't determine what API call to make. Can you rephrase?" |
| API auth error (401) | "Your API key is missing or invalid." |
| Market not found (404) | "That market doesn't exist. Check the date and timeframe." |
| Rate limited (429) | "Rate limit hit. Wait and retry." |

**Transitions:**
- User provides corrected input → go to **S3**
- Unrecoverable error → end with error message

---

### S7: DELIVER RESULT

**Purpose:** Present the final output to the user.

**Behavior:**
- Show the generated script/query/answer
- Brief explanation of what it does
- Suggest next steps if applicable (e.g., "Run this script to get data, then we can analyze the results")

**Transitions:**
- User asks a follow-up → go to **S3** (re-parse with existing definments)
- User is satisfied → end

---

## State Transition Summary

| From | To | Condition |
| :--- | :--- | :--- |
| S1 | S2 | Missing definments |
| S1 | S3a | All definments present |
| S2 | S3a | User provides missing values or clarification |
| S2 | S2 | User response unclear, re-ask |
| S3a | S3b | LLM returned slot object |
| S3b | S4 | All required slots filled, no clarification_needed |
| S3b | S2 | clarification_needed or required slot missing |
| S4 | S4b | Backtest endpoint selected |
| S4 | S5 | Non-backtest endpoint selected |
| S4b | S5 | User confirms backtest |
| S5 | S7 | Output built successfully |
| S5 | S6 | Error during build |
| S6 | S3a | User corrects input |
| S7 | S3a | User asks follow-up |
| S7 | END | Done |
