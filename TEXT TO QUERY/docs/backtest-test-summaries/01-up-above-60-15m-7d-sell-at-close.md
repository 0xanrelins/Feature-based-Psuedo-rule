# Test 1: UP above 0.60, 15m, last 7 days, sell at close

**Date:** 2026-02-27

## Question (user query)
"What if I bought UP above 0.60 in 15m markets over the last 7 days and sold at close?"

## Parse result
| Field | Value |
|------|--------|
| action | backtest |
| timeframe | 15m |
| token | up |
| range | 2026-02-20 → 2026-02-27 |
| buy_when | price_up > 0.60 |
| sell_when | market_end |

## Data source
- Local cache: `data/market_snapshot/` (disk)
- Resolved market list: API (list_markets)

## Results
| Metric | Value |
|--------|--------|
| Total Trades | 542 |
| Wins | 11 |
| Losses | 531 |
| Win Rate | 2.0% |
| Total P&L | -319.6690 |
| Avg P&L | -0.5898 |

## Summary
Strategy: buy UP on first touch above 0.60, sell at market close. Over the last 7 days 671 resolved markets were scanned, 542 trades (condition met + close found). In most trades the market resolved DOWN (exit 0.00–0.01); in 11 trades UP won.
