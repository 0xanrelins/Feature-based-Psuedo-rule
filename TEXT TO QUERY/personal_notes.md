---

Feature-based Pseudo-rule

---

- Technical Analysis–based
- definments = bounded context
- user natural language to database query
- Mapping rules doc
- **NLP / intent parsing + domain model**
- The "Agent" part here is not a separate agent orchestration; in practice it's 1 LLM parse call + deterministic backtest pipeline.

---

### "TA"

### 3 structures **industry standard**:

- Trend Following
- Breakout
- Mean Reversion

These three **cover the entire systematic trading universe**.

---

Notes;

- ❌ OHLC → does not produce real volume
- ✅ Professionals **choose one of the 3 structures**
- ✅ Mean Reversion **is very strong on BTC**
- ❌ But **only in the right market regime**

---

Optional next steps:

- 🔬 **Backtest framework for Mean Reversion**
- 🧠 **Market regime detection (rule-based)**
- 🧩 **Price-only → feature engineering**

---

## 3.3 How do professionals break Mean Reversion?

Where most people lose:

❌ **Trying mean reversion in a trend market**  
❌ **Not using a stop**  
❌ **Assuming "it will dip a bit more then reverse"**

Professionals:

- Use **ATR stop**
- Use **time stop** (e.g. exit if no reversal in 10 candles)
- Accept **high win rate / low RR**

---

## Simple but realistic Pseudo-Rule

```
IF
  EMA200 slope ≈ 0
  RSI < 28
  Close < BB lower
THEN
  Long
  TP = BB mid
  SL = Entry - 1.2 × ATR
```

---

This accepts:

- High win rate
- Low Risk/Reward
- But systematic

> The professional edge starts here.

---

Indicators are **tools**, not rules.

---

## How to write a Pseudo-Rule (general template)

```
IF
  Market regime = X
  Condition A
  Condition B
THEN
  Action
  Exit logic
  Risk logic
```

---

Summary (very clear)

- ✅ Pseudo-Rule = **formalizing** the strategy
- ✅ **Common language** for human + machine
- ❌ Not the "I saw it on the chart" approach
- ✅ Opens to backtest, optimization, deployment

---

- User asks (natural language)
- System parses to structured rule
- Agent/UI returns human-form summary ("Here's how I understood it")
- After confirmation, execution/backtest runs.

---

### METRICS (most critical part)

What we look at:

- Win rate ❌ meaningless alone
- Expectancy ✅
- Max drawdown ✅
- Time per trade
- Which market it works in / dies in

---

## 1.2 Questions asked in professional backtest

> "Does it win?" ❌  
> "**When does it win, when does it die?**" ✅

Example result interpretation:

- Trend market → **loss**
- Sideways → **stable**  
→ So **regime filter is required**

---

## Rule-Based Regime Detection (price-only)

### Example Pseudo-Rule:

```
IF
  abs(EMA200_slope) < ε
  ATR_normalized < threshold
THEN
  Market = RANGE
```

```
IF
  EMA50 > EMA200
  Higher High + Higher Low
THEN
  Market = TREND_UP
```

---

# How do the 3 steps work together?

```
Market Regime
   ↓
Strategy selection
   ↓
Pseudo-Rule
   ↓
Backtest
   ↓
Optimize / Kill
```

---

## Implementation architecture

```
Raw data (OHLCV + OB + Funding)
        ↓
Feature engineering (50+ features)
        ↓
Model training (XGBoost / Random Forest)
        ↓
Pseudo-Rule extraction (SHAP / Rule Extraction)
        ↓
Backtest → Paper Trade → Live Trade
```

---

The system weights different features in the data (color, size, frequency, context, etc.) to reach a decision.

---

Feature-based Pseudo-rule

---

Your system will effectively become a **"Filter Finder"**. When you say "RSI < 10", the system will split those RSI < 10 moments into two buckets: "Successful" and "Unsuccessful". It will find common features in the successful bucket (high volume, morning hours, etc.) and report them to you.

---

This is called **"Feature Importance" (feature importance analysis)**. Even without writing code, the logic is: **Which secondary feature improves the success of the main rule?**
