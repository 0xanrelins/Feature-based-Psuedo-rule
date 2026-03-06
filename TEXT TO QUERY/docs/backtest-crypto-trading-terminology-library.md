# Backtest & Crypto Trading Terminology Library
# LLM Context Document for Trading Strategy Analysis
# Generated: 2026-02-28
# Source: last30days skill + Bird CLI research

---

## 1. BACKTEST FUNDAMENTALS

### What is Backtesting?
Backtesting is the process of testing a trading strategy on historical data to evaluate its performance before risking real capital. It simulates how a strategy would have performed in the past.

**Key Concept:** "Past performance doesn't guarantee future results, but it reveals strategy robustness."

### Backtesting vs Other Testing Methods
- **Backtesting:** Testing on historical data (past)
- **Paper Trading:** Simulated trading with real-time data (present, fake money)
- **Forward Testing:** Testing on live markets with small capital (present, real money)
- **Live Trading:** Full deployment with real capital

---

## 2. PERFORMANCE METRICS

### Win Rate
**Definition:** Percentage of profitable trades out of total trades.
**Formula:** (Winning Trades / Total Trades) × 100
**Example:** "78% win rate" means 78 out of 100 trades were profitable.
**Context:** High win rate alone doesn't guarantee profitability (see Risk/Reward).

### PnL (Profit and Loss)
**Definition:** Net profit or loss from trading activity.
**Types:**
- **Realized PnL:** Closed positions (actual profit/loss)
- **Unrealized PnL:** Open positions (paper profit/loss)
**Example:** "PnL +43.6%" means 43.6% profit on capital.

### Profit Factor
**Definition:** Gross profit divided by gross loss.
**Formula:** Total Profits / Total Losses
**Interpretation:**
- > 1.0: Profitable strategy
- > 2.0: Good strategy
- > 3.0: Excellent strategy
**Example:** "Profit Factor: 6.95" is exceptional performance.

### Average Profit Factor
**Definition:** Mean profit factor across multiple backtest periods or strategies.

### Maximum Drawdown (Max DD)
**Definition:** Largest peak-to-trough decline in portfolio value.
**Formula:** (Peak Value - Trough Value) / Peak Value × 100
**Example:** "Max Drawdown: -15%" means worst losing streak was 15%.
**Importance:** Measures risk and worst-case scenario.

### Sharpe Ratio
**Definition:** Risk-adjusted return metric.
**Formula:** (Return - Risk-Free Rate) / Standard Deviation of Returns
**Interpretation:**
- < 1.0: Poor risk-adjusted returns
- 1.0 - 2.0: Acceptable
- 2.0 - 3.0: Very good
- > 3.0: Excellent

### Return on Investment (ROI)
**Definition:** Percentage gain/loss relative to initial capital.
**Example:** "Return: +65,202%" means $200 → $130,604.

---

## 3. TRADING STRATEGY COMPONENTS

### Entry/Exit Rules
**Entry:** Conditions to open a position (e.g., "EMA 12 crosses above EMA 50")
**Exit:** Conditions to close a position (profit target, stop loss, trailing stop)

### Position Sizing
**Definition:** Determining how much capital to allocate per trade.
**Methods:**
- Fixed amount: "$100 per trade"
- Fixed percentage: "2% of portfolio per trade"
- Kelly Criterion: Mathematical optimal sizing
- Risk-based: "Risk $50 per trade"

**Quote:** "Risk in terms of $ amount" — Juicy Trades

### Timeframes
**Common Crypto Timeframes:**
- **1m:** 1-minute candles (scalping)
- **5m:** 5-minute candles (short-term)
- **15m:** 15-minute candles (intraday)
- **1h:** 1-hour candles (swing trading)
- **4h:** 4-hour candles (trend following)
- **1d:** Daily candles (position trading)

**Example:** "5m SHORT" means 5-minute chart, short position.

### Long vs Short
**Long (Buy):** Betting price will go up
**Short (Sell):** Betting price will go down
**Example:** "+43.6% · 5m SHORT · 21 trades"

---

## 4. TECHNICAL INDICATORS

### EMA (Exponential Moving Average)
**Definition:** Weighted moving average giving more importance to recent prices.
**Common Periods:**
- EMA 9: Short-term trend
- EMA 12: Short-term trend
- EMA 21: Medium-term trend
- EMA 50: Medium-long trend
- EMA 100: Long-term trend
- EMA 200: Very long-term trend

**Strategy Example:** "UNI + EMA_12_50" means UNI token with 12 and 50 EMA crossover strategy.

**Backtest Results Format:**
- 🟢+41.4% (positive return)
- 🔴-10.6% (negative return)

### Other Common Indicators
- **RSI:** Relative Strength Index (momentum)
- **MACD:** Moving Average Convergence Divergence
- **Bollinger Bands:** Volatility indicator
- **ATR:** Average True Range (volatility)
- **VWAP:** Volume Weighted Average Price

---

## 5. TRADING COSTS & REALITY

### Slippage
**Definition:** Difference between expected price and actual execution price.
**Causes:** Market volatility, low liquidity, large order size.
**Impact:** Can turn profitable backtest into losing live strategy.
**Quote:** "Slippage/fills terminology appears in backtesting vs paper trading debates."

### Fees
**Types:**
- **Maker Fee:** For adding liquidity (lower)
- **Taker Fee:** For removing liquidity (higher)
- **Round-trip:** Entry + Exit fees combined
**Example:** "0.01-0.04% round-trip fees"

### Latency
**Definition:** Time delay between signal generation and order execution.
**Impact:** Critical for high-frequency strategies.
**Quote:** "Every 0.3s on BTC 5-min charts means thousands of trades/day. Fees, slippage, and latency kill the tiny edges."

### Liquidity
**Definition:** Ability to enter/exit positions without significant price impact.
**Importance:** Low liquidity = higher slippage.

---

## 6. CRYPTO-SPECIFIC CONCEPTS

### Whale Tracking
**Definition:** Monitoring large wallet movements ("whales" = big holders).
**Tools:** Whale alert bots, on-chain analytics.
**Significance:** Large moves can signal market direction.

### MEV Protection
**Definition:** Protection against Maximal Extractable Value attacks.
**What is MEV:** Miners/validators front-running or sandwiching trades.
**Importance:** Prevents losses from predatory trading bots.

### No-Code Platforms
**Definition:** Visual builders for trading strategies without programming.
**Examples:** CoinQuantX, TradeHeroes.ai, DuckyAI
**Features:** Drag-and-drop strategy building, instant backtesting.

### AI Trading Signals
**Definition:** Algorithm-generated buy/sell recommendations.
**Metrics:** Win rate, consistency, backtested performance.
**Example:** "AI trading signals hit a solid 78% win rate"

### Strategy Automation
**Definition:** Executing trades automatically based on predefined rules.
**Benefits:** Removes emotion, 24/7 operation, instant execution.
**Risks:** Technical failures, API issues, over-optimization.

---

## 7. RISK MANAGEMENT

### Risk Per Trade
**Definition:** Maximum loss allowed on a single trade.
**Common Rule:** 1-2% of portfolio per trade.
**Quote:** "Risk Management is key" — Vito Fx

### Stop Loss (SL)
**Definition:** Automatic exit when loss reaches predetermined level.
**Types:**
- **Fixed:** "Stop at -5%"
- **Trailing:** Moves with price to lock profits
- **ATR-based:** Based on volatility

### Take Profit (TP)
**Definition:** Automatic exit when profit target reached.
**Methods:** Fixed price, R-multiples, trailing stops.

### Risk/Reward Ratio (R:R)
**Definition:** Potential profit vs potential loss.
**Example:** 1:3 means risk $1 to make $3.
**Rule of Thumb:** Minimum 1:2 for long-term profitability.

### Portfolio Heat
**Definition:** Total exposed risk across all open positions.
**Example:** "Max 6% portfolio heat" = 6% at risk at any time.

---

## 8. STRATEGY EVALUATION

### Curve Fitting (Overfitting)
**Definition:** Strategy optimized too perfectly for past data.
**Symptom:** Amazing backtest, poor live performance.
**Prevention:** Out-of-sample testing, walk-forward analysis.

### Robustness Testing
**Methods:**
- **Monte Carlo:** Randomizing trade sequences
- **Walk-Forward:** Rolling window optimization
- **Parameter Sensitivity:** Testing different settings

### Walk-Forward Analysis
**Definition:** Continuous re-optimization on rolling data windows.
**Purpose:** Ensures strategy adapts to changing market conditions.

---

## 9. JOURNALING & IMPROVEMENT

### Trade Journal
**Definition:** Record of all trades with notes and analysis.
**Components:**
- Entry/exit prices
- Rationale for trade
- Emotional state
- Market conditions
- Lessons learned

**Quote:** "BACKTEST! JOURNAL! Risk in terms of $ amount" — Juicy Trades

### Post-Trade Analysis
**Questions:**
- Why did this trade work/fail?
- Was entry/exit optimal?
- Did I follow my rules?
- What can I improve?

---

## 10. PLATFORM & TOOL TERMINOLOGY

### API (Application Programming Interface)
**Definition:** Interface for programmatic trading.
**Uses:** Automated execution, data retrieval, account management.
**Examples:** Binance API, Coinbase API, Polymarket API.

### Paper Trading API
**Definition:** Simulated trading environment for testing.
**Benefits:** Test strategies without real money.

### Backtest Engine
**Components:**
- Data feed (historical prices)
- Strategy logic
- Execution simulator
- Performance calculator

### Trading Bot
**Definition:** Automated software executing trades 24/7.
**Types:**
- **Grid Bot:** Buys low, sells high in a range
- **DCA Bot:** Dollar-cost averaging
- **Arbitrage Bot:** Exploits price differences
- **Market Making:** Provides liquidity

---

## 11. STATISTICAL CONCEPTS

### Sample Size
**Definition:** Number of trades in backtest.
**Rule:** Minimum 30-100 trades for statistical significance.
**Quote:** "21 trades" (small sample, high variance)

### Standard Deviation
**Definition:** Measure of return volatility.
**Use:** Calculating Sharpe ratio, risk assessment.

### Confidence Interval
**Definition:** Range where true performance likely falls.
**Example:** "95% confident true win rate is 65-85%"

### Statistical Significance
**Definition:** Probability results aren't due to chance.
**Common Threshold:** p-value < 0.05 (95% confidence)

---

## 12. COMMON STRATEGY TYPES

### Trend Following
**Concept:** Buy rising, sell falling.
**Indicators:** Moving averages, ADX, trendlines.
**Example:** EMA crossovers (EMA_12_50, EMA_21_100)

### Mean Reversion
**Concept:** Price returns to average over time.
**Indicators:** RSI, Bollinger Bands, Z-score.
**Risk:** Catching "falling knives"

### Breakout Trading
**Concept:** Enter when price breaks key levels.
**Levels:** Support/resistance, ATH, consolidation zones.

### Scalping
**Definition:** Very short-term trades (seconds to minutes).
**Requirements:** Low fees, high liquidity, fast execution.
**Timeframe:** 1m, 5m charts.

### Swing Trading
**Definition:** Holding positions for days to weeks.
**Timeframe:** 4h, daily charts.
**Goal:** Capture larger price moves.

---

## 13. DATA QUALITY & SOURCES

### OHLC Data
**Definition:** Open, High, Low, Close price data.
**Format:** Candlestick or bar data.
**Timeframes:** 1m, 5m, 15m, 1h, 4h, 1d.

### Tick Data
**Definition:** Every single trade (no aggregation).
**Use:** High-frequency strategies, precise backtests.
**Size:** Very large datasets.

### Adjusted Data
**Definition:** Prices adjusted for splits, dividends.
**Crypto Note:** Not applicable (no dividends, rare splits).

### Survivorship Bias
**Definition:** Only including assets that still exist.
**Problem:** Excludes delisted/failed coins.
**Solution:** Use point-in-time data.

---

## 14. MARKET MICROSTRUCTURE

### Order Types
- **Market Order:** Immediate execution at current price
- **Limit Order:** Execution at specified price or better
- **Stop Order:** Trigger at price, execute as market
- **Stop-Limit:** Trigger at price, execute as limit

### Bid/Ask Spread
**Definition:** Difference between buy and sell prices.
**Impact:** Trading cost, especially for frequent traders.
**Crypto:** Usually wider than traditional markets.

### Order Book
**Definition:** List of all buy/sell orders.
**Depth:** Volume at each price level.
**Analysis:** Support/resistance levels, liquidity zones.

### Market Depth
**Definition:** Volume available at different price levels.
**Importance:** Predicts slippage for large orders.

---

## 15. PSYCHOLOGY & DISCIPLINE

### FOMO (Fear Of Missing Out)
**Definition:** Emotional urge to enter trades due to missing gains.
**Danger:** Chasing pumps, buying tops.

### Revenge Trading
**Definition:** Trading aggressively after losses to "make it back."
**Result:** Usually larger losses.

### Analysis Paralysis
**Definition:** Over-analyzing, unable to make decisions.
**Solution:** Trust the system, follow the plan.

### Discipline
**Definition:** Following strategy rules regardless of emotions.
**Quote:** "Taking prop trading serious" — Michael

---

## 16. ADVANCED CONCEPTS

### Kelly Criterion
**Definition:** Mathematical formula for optimal bet sizing.
**Formula:** f = (bp - q) / b
**Purpose:** Maximize long-term growth while minimizing ruin risk.

### Expectancy
**Definition:** Average expected return per trade.
**Formula:** (Win% × Avg Win) - (Loss% × Avg Loss)
**Rule:** Must be positive for profitability.

### R-Multiples
**Definition:** Profit/loss expressed in risk units.
**Example:** 3R = 3 times the risked amount.
**Use:** Normalizing performance across different position sizes.

### Equity Curve
**Definition:** Graph of portfolio value over time.
**Analysis:** Smoothness, drawdowns, consistency.

### Underwater Curve
**Definition:** Drawdown amount over time.
**Use:** Visualizing losing periods.

---

## 17. CRYPTO-SPECIFIC RISKS

### Exchange Risk
**Definition:** Exchange bankruptcy, hacks, freezes.
**Mitigation:** Use reputable exchanges, withdraw to cold wallet.

### Regulatory Risk
**Definition:** Government crackdowns, bans.
**Impact:** Delistings, price crashes.

### Smart Contract Risk
**Definition:** Bugs in DeFi protocols.
**Result:** Loss of funds.

### Impermanent Loss
**Definition:** Loss from providing liquidity in AMMs.
**Cause:** Price divergence between paired assets.

---

## 18. TOOLING ECOSYSTEM

### Backtesting Platforms
- **Python:** Backtrader, Zipline, VectorBT
- **No-Code:** TradingView, CoinQuantX, DuckyAI
- **Professional:** QuantConnect, MetaTrader

### Data Providers
- **Free:** Yahoo Finance, CCXT, Binance public API
- **Paid:** Glassnode, CryptoCompare, CoinAPI

### Portfolio Trackers
- **Manual:** CoinTracker, Blockfolio
- **Automated:** APIs pulling from exchanges

---

## 19. QUERY EXAMPLES FOR LLM

### Understanding Backtest Results
"This backtest shows 78% win rate but -15% max drawdown. Is this good?"
→ Analysis: High win rate is positive, but 15% drawdown is significant. Need to see profit factor and risk/reward ratio.

### Strategy Comparison
"Compare EMA_12_50 vs EMA_21_100 on ADA 90-day backtest"
→ EMA_21_100: +3.0% (slight profit), EMA_12_50: Not in top 5 (likely worse). Longer timeframe more stable.

### Risk Assessment
"What does Profit Factor 6.95 mean?"
→ Exceptional. For every $1 lost, strategy gains $6.95. Very robust.

### Timeframe Selection
"Should I use 5m or 1h for crypto scalping?"
→ 5m for scalping (quick moves), 1h for swing trading. Consider fees and slippage on 5m.

### Position Sizing
"How much should I risk per trade with $10,000 capital?"
→ Standard: 1-2% = $100-200 per trade. Conservative: 0.5% = $50.

---

## 20. RED FLAGS & WARNINGS

### Too Good to Be True
- Win rates > 90%
- Profit factors > 10
- Returns > 1000% annually
- No losing months

### Data Issues
- Very small sample sizes (< 30 trades)
- Short backtest periods (< 6 months)
- Missing transaction costs
- No slippage modeling

### Overfitting Signs
- Too many parameters
- Perfect equity curve
- Only works on specific asset/timeframe
- No out-of-sample testing

---

## USAGE NOTES FOR LLM

This terminology library enables understanding of:
1. Backtest reports and performance metrics
2. Trading strategy descriptions
3. Risk management discussions
4. Platform/tool capabilities
5. Crypto-specific trading concepts

When analyzing queries:
- Map user questions to specific metrics/concepts
- Identify missing information needed for proper analysis
- Recognize red flags in reported performance
- Provide context-aware recommendations

Always emphasize: Backtesting estimates potential, not guarantees.
