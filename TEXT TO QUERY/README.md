# Text-to-Query Backtest Assistant

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Natural language to structured backtest queries for prediction markets.

This project transforms free-form trading strategy descriptions into executable backtests against historical prediction market data.

## Features

- **Natural Language Parsing** — Describe strategies like "buy UP at 60 cents and sell when RSI hits 70"
- **Technical Analysis Support** — RSI, EMA, MACD, Bollinger Bands, Stochastic RSI calculated on-the-fly
- **Crossover Detection** — "EMA 12 crosses above price" patterns
- **BTC Correlation** — Entry/exit based on BTC price movements
- **Entry Windows** — "First 5 minutes" or "last 10 minutes" session constraints
- **Percentage-Based Exits** — "Sell when 0.1% in our favor"

## Quick Start

```bash
# Clone the repository
git clone https://github.com/0xanrelins/Text-to-Query-Backtest-Assistant.git
cd text-to-query

# Install dependencies
pip install -r requirements.txt

# Set your API key
cp .env.example .env
# Edit .env and add your PolyBackTest API key

# Run a backtest
python -c "
from src.main import run_text_to_query
result = run_text_to_query('buy UP at 0.60 when RSI < 30 in 15m markets last 7 days')
print(result)
"
```

## Example Queries

| Natural Language | What It Does |
|----------------|--------------|
| `buy UP at 6 cents in 15m markets last 7 days` | Simple entry at price threshold |
| `buy when BTC moves 0.1% and sell at double profit` | BTC-correlated entry, profit target exit |
| `buy if price touches 13 EMA and go to session end` | Moving average crossover entry |
| `buy first minute if price 0.30, sell at 0.74 or resolution` | Entry window + conditional exit |
| `buy when RSI crosses above 30 in 5m markets` | Technical indicator crossover |

## Architecture

```
User Query → LLM Parser → ParsedQuery → Backtest Engine → Results
                ↓
         [Mapping Rules, Glossary, TA Library]
```

- **`src/llm_parse.py`** — LLM-based query parsing with schema validation
- **`src/backtest.py`** — Core backtesting engine with TA indicator calculation
- **`src/indicators.py`** — Pure Python TA implementation (RSI, EMA, MACD, etc.)
- **`docs/`** — Domain glossary, mapping rules, terminology library

## Supported Technical Indicators

| Indicator | Fields Available |
|-----------|------------------|
| RSI | `rsi` (14), `rsi_7` |
| EMA | `ema_9`, `ema_12`, `ema_20`, `ema_26`, `ema_50` |
| MACD | `macd`, `macd_signal`, `macd_hist` |
| Bollinger Bands | `bb_upper`, `bb_middle`, `bb_lower` |
| Stochastic RSI | `stoch_rsi_k`, `stoch_rsi_d` |
| BTC Indicators | `btc_rsi`, `btc_ema_*` |

## Project Structure

```
.
├── src/
│   ├── main.py           # Orchestrator
│   ├── llm_parse.py      # LLM query parser
│   ├── backtest.py       # Backtest engine
│   ├── indicators.py     # TA calculations
│   ├── parser.py         # Rule-based parser (legacy)
│   ├── client.py         # PolyBackTest API client
│   └── config.py         # Configuration
├── docs/
│   ├── glossary.md       # Domain terminology
│   ├── mapping-rules.md  # User expression mappings
│   ├── skill-schema.md   # Schema documentation
│   └── backtest-crypto-trading-terminology-library.md
├── data/                 # Cached market data (not in repo)
├── requirements.txt
├── .env.example
└── README.md
```

## Local Data Sync (Incremental)

Use this when running in local-data-only mode.

```bash
python scripts/sync_15m_local_cache.py
```

What it does:
- Maintains `data/15m-btc-markets-history.json` (growing historical archive)
- Downloads only missing/corrupted snapshot files in `data/15m_30d_snapshots/`
- Keeps existing valid snapshot files (no re-download)

## Requirements

- Python 3.12+
- PolyBackTest API key (for historical data)
- OpenAI API key (for LLM parsing)

## License

MIT License — see [LICENSE](LICENSE) file.

---

Built for systematic prediction market strategy validation.