# State Machine

> **Reference only.** This document describes the agent flow as implemented by the engine (TEXT TO QUERY `main.py`) and the Strategy Demystify UI. No code reads this file; it is for humans to understand and align behavior.
>
> Each state: what is checked, what is done, where we go next.

---

## Overview

```
USER QUERY
    │
    ▼
┌─────────────┐     invalid      ┌─────────────────────────┐
│  S1: CHECK  │ ──────────────► │ S2: REPORT TO USER      │
│  DEFINMENTS │                  │ (errors or clarification)│
└──────┬──────┘                  └────────────┬─────────────┘
       │ valid                                 │ user responds
       ▼                                       │ (fix / rephrase)
┌─────────────┐◄────────────────────────────────┘
│ S3a: PARSE  │
│ (LLM or     │  definments + user text → slots
│  fallback)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐   clarification   ┌─────────────────────────┐
│ S3b: CHECK  │ ────────────────►│ S2: REPORT TO USER      │
│   SLOTS     │   needed          │ (clarification_needed)   │
└──────┬──────┘                   └─────────────────────────┘
       │ all filled & clear
       ▼
┌──────────────┐
│ S4: SELECT   │
│   ENDPOINT   │
└──────┬───────┘
       │
       ├── backtest ──► ┌──────────────┐  confirm   ┌──────────────┐
       │                │ S4b: CONFIRM │ ────────► │ S5: BUILD    │
       │                │ (show parse) │            │   & RUN      │
       │                └─────────────┘            └──────┬───────┘
       │                                                    │
       └── other ──────────────────────────────────────────►│
                                                             ▼
                    ┌─────────────────┐     error    ┌──────────────┐
                    │ S6: HANDLE ERROR │ ◄───────────┤ S7: DELIVER  │
                    └─────────────────┘             │   RESULT     │
                                                     └──────────────┘
```

---

## Implementation notes

- **Definments:** Defaults come from config (e.g. timeframe=15m, token=up, data_range_days=30). S1 only **validates**; we do not interactively prompt for each definment. If validation fails, we report and stop (or return error in API).
- **Clarification:** When the LLM sets `clarification_needed` or a required slot is missing, we show that message to the user (S2). User rephrases or clarifies; we re-parse (S3a).
- **Confirmation (backtest):** Before running a backtest, we always show what we understood. **CLI:** summary is printed; user must re-run with `--confirm` to execute. **UI:** "Here's how I understood it — correct?" and "If you confirm, the backtest will run"; backtest runs only after user confirms.
- **API:** The JSON API (e.g. used by Strategy Demystify) supports backtest flow; other actions (list_markets, snapshot_at) may be engine-only or not exposed in the UI.

---

## State definitions

### S1: CHECK DEFINMENTS

**Purpose:** Ensure definments are valid before parsing. Definments have defaults; we only validate.

| Check | Default (from config) | Validation |
| :--- | :--- | :--- |
| `platform` | polymarket | — |
| `topic` | crypto | — |
| `pair` | btc | — |
| `timeframe` | 15m | Must be one of 5m, 15m, 1hr, 4hr, 24hr |
| `token` | up | Must be up or down |
| `data_range_days` | 30 | 1–31 |
| `data_platform` | polybacktest | — |

**Transitions:**
- Valid → **S3a**
- Invalid → **S2** (report errors; user fixes config/env or re-runs)

---

### S2: REPORT TO USER (errors or clarification)

**Purpose:** When the flow cannot continue, report to the user so they can fix or clarify.

**Two triggers:**
1. **S1 → S2:** Definment validation failed (e.g. invalid timeframe, range > 31 days). Show errors; user fixes and re-runs.
2. **S3b → S2:** LLM returned `clarification_needed` or a required slot is empty/ambiguous. Show the message (e.g. "When do you want to sell: at market end or at a price?"). User rephrases or answers; we go back to **S3a** with the new input.

**Transitions:**
- User provides fix / clarification → **S3a**
- (No automatic retry; user must respond.)

---

### S3a: PARSE (LLM or fallback)

**Purpose:** Turn user text + definments into structured slots. Uses LLM with glossary and mapping-rules; if LLM unavailable, rule-based fallback parser is used.

**Input:** User query + current definments.

**Output:** Slots (action, market_type, start_time, end_time, buy_triggers, sell_condition, …) and optionally `clarification_needed`.

**Transitions:**
- Slots returned → **S3b**

---

### S3b: CHECK SLOTS

**Purpose:** Decide if parsing is complete or we must ask the user.

**Checks:**
- For the inferred `action`, required slots are present and valid (e.g. backtest needs non-empty buy_triggers, sell_condition, market_type, time range).
- No `clarification_needed` from the LLM.

**Transitions:**
- All required slots filled, no clarification → **S4**
- Missing slot or `clarification_needed` set → **S2** (show message to user)

---

### S4: SELECT ENDPOINT

**Purpose:** Choose which flow to run from the parsed action.

| Parsed action | Flow | In practice |
| :--- | :--- | :--- |
| backtest | Backtest (list markets → snapshots → apply strategy → P&L) | Supported in engine and UI |
| list_markets / lookup | List or lookup | Engine supports; API/UI may expose only backtest |
| snapshot_at | Point-in-time snapshot | Engine supports |

**Transitions:**
- Backtest selected → **S4b**
- Other → **S5** (build output for that action)

---

### S4b: CONFIRM STRATEGY (backtest only)

**Purpose:** Before running a backtest, show what we understood and get explicit user approval. No backtest run before confirmation.

**Behavior:**
1. Show parsed strategy (timeframe, token, range, buy triggers, sell condition).
2. Ask for confirmation (e.g. "Here's how I understood it — correct?" / "If you confirm, the backtest will run.").
3. Run backtest only after user confirms.

**CLI:** User sees summary; must re-run with `--confirm` to execute.  
**UI:** User sees summary and confirms in the interface; then backtest runs.

**Transitions:**
- User confirms → **S5** (run backtest)
- User does not confirm or corrects → do not run; stay at summary or re-parse

---

### S5: BUILD OUTPUT / RUN

**Purpose:** Execute the chosen flow (e.g. run backtest, call API, build script).

**For backtest:** Fetch markets and snapshots (or use local cache), evaluate entry/exit, compute P&L, build result.

**Transitions:**
- Success → **S7**
- Error (e.g. API failure, invalid params) → **S6**

---

### S6: HANDLE ERROR

**Purpose:** Return or show a clear error so the user can correct.

| Error type | Example response |
| :--- | :--- |
| Data range > 31 days | "PolyBackTest supports max 31 days. Please shorten your range." |
| Invalid market_type | "Valid options: 5m, 15m, 1hr, 4hr, 24hr." |
| Unsupported action (e.g. via API) | "Only backtest flow is supported via JSON API." |
| API auth (401) | "Your API key is missing or invalid." |
| Market not found (404) | "That market doesn't exist. Check the date and timeframe." |
| Rate limited (429) | "Rate limit hit. Wait and retry." |

**Transitions:**
- User corrects and retries → flow restarts (e.g. **S3a**)
- Unrecoverable → end with error message

---

### S7: DELIVER RESULT

**Purpose:** Present the result to the user (e.g. backtest summary, win rate, P&L, trade list).

**Transitions:**
- User asks follow-up → re-parse (**S3a**)
- Done → end

---

## State transition summary

| From | To | Condition |
| :--- | :--- | :--- |
| S1 | S2 | Definment validation failed |
| S1 | S3a | Definments valid |
| S2 | S3a | User provided fix or clarification |
| S3a | S3b | Parse returned slots |
| S3b | S4 | All required slots filled, no clarification_needed |
| S3b | S2 | clarification_needed or required slot missing |
| S4 | S4b | Backtest selected |
| S4 | S5 | Non-backtest selected |
| S4b | S5 | User confirmed backtest |
| S5 | S7 | Success |
| S5 | S6 | Error during build/run |
| S6 | S3a | User corrects and retries |
| S7 | S3a | User follow-up |
| S7 | END | Done |
