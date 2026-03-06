# Introduction

> Source: https://docs.polybacktest.com/

Access real-time prediction market data and historical snapshots for backtesting.

## Welcome to PolyBackTest

PolyBackTest provides comprehensive access to prediction market data, enabling you to build trading strategies, analyze market movements, and backtest your ideas with historical snapshots.

## What you can build

- **Trading Bots** — Build automated strategies with real-time market data and order book depth.
- **Backtesting Systems** — Test your strategies against historical snapshots with sub-second precision.
- **Market Analytics** — Analyze price movements, volume trends, and market dynamics.
- **Research Tools** — Study market behavior and correlations with BTC price movements.

## Quick example

Fetch the latest Bitcoin prediction markets:

```bash
curl -X GET "https://api.polybacktest.com/v1/markets?market_type=24hr&limit=10" \
  -H "X-API-Key: your_api_key"
```
