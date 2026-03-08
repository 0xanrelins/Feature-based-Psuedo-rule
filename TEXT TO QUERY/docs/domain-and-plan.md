# Domain + Development plan (short summary)

## 1. Domain

**Backtest strategy definition:** The user describes in natural language "which market, which range, when to buy and when to sell?"; the system maps this to a structured model.

**Core concepts:**
- **Session (market):** One market’s lifetime (start_time → end_time; 15m, 1hr, etc.).
- **Time range:** Calendar interval the backtest covers (which sessions we look at).
- **Token / direction:** UP or DOWN.
- **Entry:** When and under what condition we buy.
  - Condition: price / BTC etc. (e.g. price_up >= 0.90).
  - Entry window (optional): full session or only a part (e.g. "last minute of session").
- **Exit:** When we sell (session end, next snapshot, or price condition).

**Sources:** Polymarket → market/session/API; traditional backtest sources → entry/exit, window, condition structure. There is no off-the-shelf "natural language → strategy model" library; the domain model and mapping are ours.

**Polymarket references:** [Polymarket Docs](https://docs.polymarket.com/) (Markets & Events, Resolution, Orderbook) · [Polymarket CLI](https://github.com/Polymarket/polymarket-cli) (markets, clob price/book). Single term source: [docs/glossary.md](glossary.md).

---

## 2. One-time structure setup

- **Single domain model:** Concepts above defined in one place; schema/slots follow.
- **Single glossary:** Short definitions for session, time range, entry window, resolution, etc.; LLM and rules reference it.
- **Single mapping source:** "last 7 days", "in the last minute", "price 0.90" → tied to the model via one rule set (e.g. mapping-rules); LLM prompt and any rule-based logic behave according to that source.
- **LLM role:** Fills slots knowing domain + glossary; when unclear, asks "which concept is missing?".

---

## 3. Development steps (suggested order)

1. **Glossary + domain model doc** ✅  
   **[docs/glossary.md](glossary.md)** — Session, time range, entry (condition + window), exit; Polymarket term mapping; "user expression → which concept" summary.

2. **Unify mapping source**  
   Align mapping-rules (or new doc) with domain model; collect "user expression → domain field" rules. Plan so LLM prompt and rule-based logic are fed from this source.

3. **Align schema / slots to domain**  
   Map existing buy_triggers, sell_condition, start_time, end_time to domain concepts; add fields like entry_window to the model if missing.

4. **Structure LLM prompt**  
   First glossary + domain summary, then schema, then mapping rules (from single source); remove scattered example rules.

5. **Tie rule-based to same source**  
   Parser patterns should be derivable from the single mapping doc where possible, or at least consistent with it.

6. **Test + iterate**  
   Validate "natural language → domain model → backtest" flow with example user sentences; add missing concepts to glossary/mapping.

---

## 4. Next steps

- **Unify mapping-rules with glossary** — User expression → domain field; same naming as glossary concepts.
- **Add glossary summary to LLM prompt** — Concepts first (session, time range, entry, entry window, exit), then schema, then mapping.
- **Align schema/slots to domain** — entry_window if missing; start_time/end_time, buy_triggers consistent with glossary.
