# Strategy Analyzer LLM Skill
## Polymarket Trading Strategy Evaluation System

**Purpose:** Parse natural language strategies, run backtests with PolyBackTest data, and score with 0-100 system.
**Specialization:** Polymarket prediction markets, binary options, time-window strategies.

---

## Part 1: Strategy Parsing Framework

### Context for Parser

You are parsing **Polymarket crypto trading strategies** from natural language. Extract structured parameters for backtesting.

**What is Polymarket:**
- Binary prediction markets (YES/NO outcomes)
- Markets pay $1.00 if correct, $0 if wrong
- Price = implied probability (98c = 98% chance)
- Has expiration times: 15m, 1h, 4h, daily

### Pattern Recognition

**Time-Window Patterns:**
- "last X seconds" → time_window: "last_{X}_seconds"
- "before expiry" → time_window: "before_expiry"
- "final Y minutes" → time_window: "final_{Y}_minutes"
- "15m market" → timeframe: "15m"
- "hourly" → timeframe: "1h"
- "4h timeframe" → timeframe: "4h"

**Price-Threshold Patterns:**
- "98c+" → price_threshold: 0.98
- "above 95 cents" → price_threshold: 0.95
- "98 cent'ten" → price_threshold: 0.98 (Turkish)
- "<15s" → time_window: "less_than_15_seconds"

**Side-Selection Patterns:**
- "whichever side" → side_logic: "best_available"
- "buy whichever" → side_logic: "best_available"
- "up side" / "down side" → side_logic: "specified"
- "YES token" → side: "up"
- "NO token" → side: "down"

**Risk/Reward Understanding:**
- Buying at 98c = risking 98c to gain 2c (49:1 ratio)
- Requires >98% win rate to break even (mathematically unsustainable)
- 2% withdrawal fee makes entries above 97c unprofitable

### Extract Parameters

Parse to this structure:
```json
{
  "strategy_understanding": {
    "type": "time_window_binary",
    "description": "Human-readable summary",
    "risk_profile": "extreme_high_risk | high_risk | medium_risk | low_risk",
    "expected_behavior": "What the strategy attempts to do"
  },
  "backtest_parameters": {
    "timeframe": "15m | 1h | 4h | 1d",
    "market_type": "binary_updown | price_range | event_based",
    "entry_trigger": "condition for entering trade",
    "exit_trigger": "condition for exiting (usually expiry)",
    "time_window": "last_15_seconds | last_1_minute | anytime",
    "price_threshold": 0.0-1.0,
    "side_logic": "best_available | up_only | down_only",
    "position_size": "percentage or fixed amount"
  }
}
```

### Example Parse

**Input:** "Last 15 Seconds → Buy whichever side is 98c+ with <15s"

**Output:**
```json
{
  "strategy_understanding": {
    "type": "time_window_binary",
    "description": "Enter positions in final 15 seconds of 15m binary market, buying option trading at 98c or higher",
    "risk_profile": "extreme_high_risk",
    "expected_behavior": "Risks 98 cents to gain 2 cents (49:1 ratio), requiring >98% accuracy"
  },
  "backtest_parameters": {
    "timeframe": "15m",
    "market_type": "binary_updown",
    "entry_trigger": "price >= 0.98 AND time <= 15 seconds before expiry",
    "exit_trigger": "market_resolution",
    "time_window": "last_15_seconds",
    "price_threshold": 0.98,
    "side_logic": "best_available"
  }
}
```

---

## Part 2: PolyBackTest Context

### API Structure

**Endpoints:**
- `GET /v1/markets?market_type={type}&limit={n}` → Returns market list
- `GET /v1/markets/{market_id}/snapshots` → Returns historical data

**Snapshot Format:**
```json
{
  "timestamp": "2024-02-19T14:59:45Z",
  "price_up": 0.98,
  "price_down": 0.02,
  "volume": 15420,
  "liquidity_up": 5000,
  "liquidity_down": 4800
}
```

**Market Resolution:**
- Binary markets resolve to $1.00 (correct) or $0 (wrong)
- Outcome determined at expiry time
- 15m market = resolves 15 minutes after creation

### Backtest Simulation Logic

Given snapshots and strategy parameters:

1. **Timeline Analysis:**
   - Order snapshots chronologically
   - Identify market expiry times
   - Find "last 15 seconds" window

2. **Entry Detection:**
   - Check if price_up >= threshold OR price_down >= threshold
   - Must occur within specified time window
   - Record entry price and side

3. **Exit Simulation:**
   - At expiry, check outcome (UP or DOWN)
   - If entry side matches outcome: +$1 - entry_price = profit
   - If entry side doesn't match: lose entry_price

4. **Trade Log:**
   - entry_time, entry_price, side, outcome, pnl

5. **Metrics Calculation:**
   - Total trades, wins, losses
   - Gross profit (sum of all wins)
   - Gross loss (sum of all losses)
   - Profit Factor = Gross Profit / Gross Loss

---

## Part 3: Scoring Framework

### Base Score Calculation (0-100)

**Profit Factor Points:**
- ≥3.0 → 20 pts | 2.5-2.99 → 18 pts | 2.0-2.49 → 16 pts | 1.75-1.99 → 14 pts
- 1.5-1.74 → 10 pts | 1.25-1.49 → 6 pts | 1.0-1.24 → 2 pts | <1.0 → 0 pts

**Max Drawdown Points:**
- <5% → 20 pts | 5-9.99% → 18 pts | 10-14.99% → 16 pts | 15-19.99% → 14 pts
- 20-24.99% → 10 pts | 25-29.99% → 6 pts | 30-39.99% → 2 pts | ≥40% → 0 pts

**Sharpe Ratio Points:**
- ≥3.0 → 20 pts | 2.5-2.99 → 18 pts | 2.0-2.49 → 16 pts | 1.5-1.99 → 14 pts
- 1.0-1.49 → 10 pts | 0.5-0.99 → 6 pts | 0.0-0.49 → 2 pts | <0 → 0 pts

**CAGR Points:**
- ≥50% → 20 pts | 35-49.99% → 18 pts | 25-34.99% → 16 pts | 20-24.99% → 14 pts
- 15-19.99% → 10 pts | 10-14.99% → 6 pts | 5-9.99% → 2 pts | <5% → 0 pts

**Win Rate Points:**
- 65-74.99% → 20 pts | 60-64.99% → 18 pts | 55-59.99% → 16 pts | 50-54.99% → 14 pts
- 45-49.99% → 12 pts | 40-44.99% → 10 pts | 35-39.99% → 6 pts | <35% → 2 pts
- ≥75% → 8 pts (OVERFITTING PENALTY)

**BASE SCORE = Sum of 5 metrics (0-100)**

### Adjustments

**Bonus Points (Max +10):**
- +5: MDD <10% AND CAGR >25%
- +5: All 5 metrics ≥14 pts
- +3: Sharpe >2.0 AND MDD <15%

**Penalty Points (Max -10):**
- -5: Win Rate >75% OR PF >3.5
- -5: MDD >30% OR Sharpe <0.5
- -3: CAGR <10% AND MDD >20%

**FINAL SCORE = Base + Bonus - Penalty (0-100)**

### Categories
- 90-100: Exceptional 🌟
- 75-89: Excellent 🏆
- 60-74: Good ✅
- 40-59: Fair ⚠️
- 0-39: Poor ❌

---

## Part 4: Risk Assessment

### Critical Risks (Immediate Reject)
- Risking X to gain Y where X >> Y
- Requires >90% accuracy to break even
- Time window <30 seconds
- Single loss wipes out 10+ wins
- No stop loss or risk management

### Verdict Rules

**DEPLOY:**
- Final Score ≥75
- No critical risks
- ≥30 trades in backtest

**REJECT:**
- Final Score <40
- Any critical risk
- Negative expected value
- Catastrophic drawdown risk

**REVISE:**
- Final Score 40-74
- Good potential but needs improvement
- Insufficient data

---

## Part 5: Required Output Format

```json
{
  "strategy_name": "Brief descriptive name",
  "understanding": "What the strategy does",
  "market_analysis": "Analysis of market conditions",
  "risk_assessment": {
    "level": "LOW|MEDIUM|HIGH|CRITICAL",
    "factors": ["Risk 1", "Risk 2"],
    "warnings": ["Warning 1", "Warning 2"]
  },
  "score_breakdown": {
    "profit_factor_points": 0-20,
    "max_drawdown_points": 0-20,
    "sharpe_ratio_points": 0-20,
    "cagr_points": 0-20,
    "win_rate_points": 0-20,
    "bonus_points": 0-10,
    "penalty_points": 0-10,
    "base_score": 0-100,
    "final_score": 0-100
  },
  "metrics": {
    "profit_factor_value": "X.XX",
    "max_drawdown_value": "XX.X%",
    "sharpe_ratio_value": "X.XX",
    "cagr_value": "XX.X%",
    "win_rate_value": "XX.X%",
    "trade_count": 47
  },
  "evaluation": "Detailed analysis paragraph",
  "recommendation": "Actionable recommendation",
  "verdict": "DEPLOY|REJECT|REVISE",
  "confidence": 0-100
}
```

---

## Usage Flow

**Step 1 - Parse:**
Input: Natural language strategy
Output: Parsed parameters (backtest_parameters)

**Step 2 - Backtest:**
Use parsed parameters to simulate trades on PolyBackTest data
Calculate real metrics (PF, MDD, Sharpe, CAGR, Win Rate)

**Step 3 - Score:**
Apply scoring framework to calculated metrics
Generate final report with verdict

---

**Version:** 2.0 LLM-Optimized
**For:** Kimi k2.5 via OpenRouter
**Tokens:** ~3000
