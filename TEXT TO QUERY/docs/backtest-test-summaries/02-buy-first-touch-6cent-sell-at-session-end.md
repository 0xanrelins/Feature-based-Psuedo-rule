# Test 2: Buy first price touch to 6 cent, sell at end of session

**Date:** 2026-02-27

## Question (user query)
"buy first price touch to 6cent and go to end to the session"

## Parse result
| Field | Value |
|------|--------|
| action | backtest |
| timeframe | 15m |
| token | up |
| range | 2026-01-28 → 2026-02-27 (default 30 days) |
| buy_when | price_up <= 0.06 |
| sell_when | market_end |

## Notes
- "6 cent" → 0.06 (parser rule: X cent → 0.0X).
- "First price touch to 6 cent" → buy when price first touches 0.06 or below.
- "Go to end of session" → sell at close (market_end).
- Token not specified → default UP (price_up <= 0.06).

## Data source
- Local cache: `data/market_snapshot/`
- Resolved market list: API (list_markets)
- **For results:** Run used last 7 days (671 markets, all on disk; 30 days = 2847 markets + missing cache made it too slow).

## Results (last 7 days: 2026-02-20 → 2026-02-27)

**Note:** Exit price at close is now computed from `market.winner` (winning token = 1.0, losing = 0.0). Previously the last snapshot price was used, so some UP-winning markets were incorrectly counted as losses (exit ~0.22). Using winner gives the correct win count.

| Metric | Value |
|--------|--------|
| Total Trades | 329 |
| Wins | 17 |
| Losses | 312 |
| Win Rate | 5.2% |
| Total P&L | -1.8900 |
| Avg P&L | -0.0057 |

Summary: buy UP on first touch at or below 0.06, sell at close. 329 trades in 7 days; UP won in 17 (exit = 1.0), DOWN in 312 (exit = 0.0).
