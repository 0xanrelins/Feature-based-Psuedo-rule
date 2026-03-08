---
name: score-strategy
description: Backtest and score BTC + Polymarket strategies from natural language or metrics
argument-hint: '"Buy when RSI 30, sell at 70" OR --pf 2.3 --mdd 15 --sharpe 1.8 --cagr 22 --winrate 58'
allowed-tools: Bash, Read, Write
---

# score-strategy

Backtest and score BTC + Polymarket trading strategies.

## Two Usage Modes

### Mode 1: Natural Language Strategy (Automatic Backtest)

Describe your strategy in plain language - the skill will parse it, backtest it, and score it:

```
score-strategy "Buy when RSI 30, sell at 70"
score-strategy "Buy when price crosses above 50-day MA, sell when below"
```

**Requirements:**
- Set API key: `export POLYBACKTEST_API_KEY='your_key'`
- Automatically fetches BTC OHLCV data
- Runs backtest with backtrader
- Calculates and scores metrics

### Mode 2: Direct Metrics Scoring

Provide metrics directly if you already have backtest results:

```
score-strategy --pf 2.3 --mdd 15 --sharpe 1.8 --cagr 22 --winrate 58
```

Add metadata for a complete report:

```
score-strategy \
  --name "BTC Mean Reversion v2" \
  --timeframe "1h" \
  --period "Jan-Mar 2024" \
  --trades 47 \
  --pf 2.3 \
  --mdd 15 \
  --sharpe 1.8 \
  --cagr 22 \
  --winrate 58
```

## Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `--pf` | Profit Factor | 2.3 |
| `--mdd` | Maximum Drawdown (%) | 15 |
| `--sharpe` | Sharpe Ratio | 1.8 |
| `--cagr` | CAGR (%) | 22 |
| `--winrate` | Win Rate (%) | 58 |

## Optional Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `--name` | Strategy name | "BTC Mean Reversion" |
| `--timeframe` | Candle timeframe | "1h", "4h", "1d" |
| `--period` | Backtest period | "Jan-Mar 2024" |
| `--trades` | Number of trades | 47 |
| `--exchange` | Data source | "Binance", "Coinbase" |
| `--polymarket` | Polymarket market | "BTC $50k+ by March" |
| `--output` | Output format | "terminal", "md", "json" |

## Output

The skill provides:

- **Score:** 0-100 points
- **Category:** Exceptional 🌟 / Excellent 🏆 / Good ✅ / Fair ⚠️ / Poor ❌
- **Breakdown:** Points for each metric
- **Recommendation:** Deploy or revise
- **Red Flags:** Potential issues detected
- **Next Steps:** Validation checklist

## Examples

### Example 1: Excellent Strategy

```
score-strategy --pf 2.8 --mdd 8.2 --sharpe 2.4 --cagr 31 --winrate 64
```

Output:
```
Score: 88/100
Category: Excellent 🏆
Recommendation: Deploy after validation
```

### Example 2: Good Strategy

```
score-strategy --pf 1.9 --mdd 16 --sharpe 1.4 --cagr 18 --winrate 53
```

Output:
```
Score: 62/100
Category: Good ✅
Recommendation: Deploy with caution
```

### Example 3: Poor Strategy

```
score-strategy --pf 1.55 --mdd 24 --sharpe 1.0 --cagr 12 --winrate 48
```

Output:
```
Score: 48/100
Category: Fair ⚠️
Recommendation: Do NOT deploy - Revise strategy
```

## Scoring System

Each metric is scored 0-20 points:

- **90-100:** Exceptional 🌟 - Deploy with confidence
- **75-89:** Excellent 🏆 - Deploy after validation
- **60-74:** Good ✅ - Deploy with caution
- **40-59:** Fair ⚠️ - Do NOT deploy, revise first
- **0-39:** Poor ❌ - Reject, fundamentally flawed

## Bonus & Penalty Points

**Bonus Points (max +10):**
- Low Risk + High Return: MDD <10% AND CAGR >25% → +5
- Consistent Excellence: ALL metrics ≥14 pts → +5
- Risk Management: Sharpe >2.0 AND MDD <15% → +3

**Penalty Points (max -10):**
- Overfitting: Win Rate >75% OR PF >3.5 → -5
- Excessive Risk: MDD >30% OR Sharpe <0.5 → -5
- Poor Returns: CAGR <10% AND MDD >20% → -3

## Red Flags Detected

The skill automatically checks for:

- ⚠️ Sample size <30 trades
- ⚠️ Win rate >75% (overfitting risk)
- ⚠️ Profit factor >3.5 (overfitting risk)
- ❌ Max drawdown >30% (excessive risk)
- ❌ Poor risk/reward ratio

## Notes

Based on the `strategy_scoring_framework.md` framework created on Feb 19, 2026.

For BTC + Polymarket combined strategies using technical analysis and orderbook data.

## Execution

When invoked, run:

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-$HOME/.cursor/skills/score-strategy}/scripts/main.py" "$ARGUMENTS"
```

## Technical Details

This skill uses Python scripts in the `scripts/` folder:
- `main.py` - Main entry point and mode detection
- `strategy_parser.py` - LLM-based strategy parsing
- `data_fetcher.py` - PolyBackTest API client
- `backtest_engine.py` - Backtrader integration
- `validate.py` - Input validation
- `score.py` - Scoring logic

**Dependencies:**
- `backtrader` - Backtesting library
- `pandas` - Data processing

**API Requirements:**
- PolyBackTest API key for historical data
- Set: `export POLYBACKTEST_API_KEY='your_key'`

Framework Version: 4.0 (Automatic Backtest + 0-100 Scoring)
