# LLM model choice — Backtest parsing

In this project, natural language → structured strategy (ParsedQuery) is done via **OpenRouter** with an LLM. Currently **Claude Sonnet 4.6** (`anthropic/claude-sonnet-4.6`) is used. Whether Perplexity models add value for this task is summarized below.

---

## Current usage

- **Task:** User sentence + definments + glossary/mapping → **single JSON** (action, market_type, buy_triggers, sell_condition, exit_on_pct_move, etc.).
- **Context:** Only the text we provide (definments, "Today's date", user message). **No web search.**
- **Output:** Schema-compliant, consistent slot filling; if ambiguous, set `clarification_needed`.

So we need: **bounded context + instruction following + structured output**. Micro-development speed depends largely on **prompt/glossary/mapping** quality and the model’s instruction/schema adherence.

---

## Perplexity models on OpenRouter (summary)

Models on [OpenRouter – Perplexity](https://openrouter.ai/perplexity) roughly:

| Model | Feature | Price (approx) | For this project |
|--------|----------|----------------|------------------|
| **Sonar** | Light, fast, citation; optional web search | $1/M input, $1/M output | Good for low-cost trial |
| **Sonar Pro** | Deeper queries, more citation, large context | $3/M input, $15/M output + search cost | Unnecessarily expensive for parsing |
| **Sonar Pro Search** | Multi-step search + reasoning | $3/M input, $15/M output + **$18/1k request** | Search-focused; overkill for parsing |
| **Sonar Reasoning / Deep Research** | Multi-step research, many searches | Extra search + reasoning fee | For research reports; not slot filling |

Perplexity’s strength: **searching the web and producing answers with citations**. Our task is **slot filling from a fixed domain (glossary + mapping)**; we don’t query the outside world.

---

## Perplexity, micro-development, and system development

- **Micro-development:** For each new phrase ("sell after 0.2% move", "moves opposite side"), **glossary + mapping-rules + LLM prompt** are updated first. The main gain is clear docs and the model following instructions/schema. **What you write** (single source, consistent terms) matters more than **which model** you use.
- **Switching to Perplexity** doesn’t naturally make this slot-filling task “easier” because:
  - We don’t use web search → Sonar Pro Search / Deep Research advantages are unused.
  - We don’t need citations → Perplexity’s strength there is extra cost (especially Pro/Search models).
- **Where Perplexity could help:** If you later add **external context + search** (“research strategy on the web”, “find similar strategies”, “summarize analyst views”), then **Perplexity (Sonar Pro / Sonar Pro Search)** becomes relevant. Not required for the current “text → ParsedQuery” pipeline.

**Summary:** Switching to Perplexity just for backtest strategy domain parsing doesn’t by itself ease system or micro-development. The main lever is keeping glossary, mapping-rules, and prompt as the single reference.

---

## When to use which model

| Goal | Recommendation |
|------|----------------|
| **Current parsing (text → JSON slots)** | **Claude Sonnet 4.6** is a good default; strong on instructions and structured output. |
| **Cost / speed experiment** | Try **Perplexity Sonar** (`perplexity/sonar`); same API via OpenRouter, only change `OPENROUTER_MODEL`. |
| **Future “fetch strategy/market info from web”** | Then **Sonar Pro** or **Sonar Pro Search** can be considered as an extra layer. |

---

## Quick try: Perplexity Sonar

Same code and API; only env var:

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=perplexity/sonar
```

Current model list and pricing on OpenRouter: [OpenRouter – Perplexity](https://openrouter.ai/perplexity).  
Sonar: light, cheap, fast; may be enough for slot filling. Test consistency with a few example phrases (entry window, exit on % move, opposite side, etc.).

---

## Short answer

- **“Would using Perplexity make micro / system development easier?”**  
  For the **current task** in this project (backtest strategy parsing, no web): **no**; don’t expect a simplifying advantage. The advantage is in making glossary + mapping + prompt the single source.
- **“When should we use Perplexity?”**  
  When you want **web search / external sources / citations** (e.g. “what’s similar to this strategy?”, “BTC commentary last week”), Perplexity models (Sonar Pro / Sonar Pro Search) become a reasonable extra option.
