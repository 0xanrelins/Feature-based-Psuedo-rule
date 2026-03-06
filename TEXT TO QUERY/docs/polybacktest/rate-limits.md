# Rate Limits & Data

> Source: https://docs.polybacktest.com/rate-limits

Understanding API limits and data sources.

## API Rate Limits

To ensure fair usage and system stability, the PolyBackTest API implements rate limiting on a per-key basis.

| Limit Type | Value | Description |
| :--- | :--- | :--- |
| **Standard Rate** | 2000 requests/minute | The baseline limit for all API keys. |
| **Burst Limit** | 100 requests/second | Allows for short bursts of high-volume traffic. |

If you exceed these limits, the API will return a `429 Too Many Requests` error. The response headers will include details about your current usage and when the limit will reset:

- `X-RateLimit-Limit`: Your total request limit per minute.
- `X-RateLimit-Remaining`: The number of requests you have left in the current window.
- `X-RateLimit-Reset`: The time at which the current window resets.

## Data Retention & Scale

- **Retention Period**: Data is stored for the past **31 days**.
- **Market Coverage**: Over **5000+ markets** specifically tracked.
- **Data Volume**: Access to over **60 million+ snapshots** across various timeframes.

## Data Sources & Accuracy

### Bitcoin Price

- **Standard Markets**: Sourced directly from **Binance**.
- **5m & 15m Markets**: Tracks **Chainlink** prices directly to ensure 100% alignment with Polymarket's resolution criteria.

### Market Resolution

For **5-minute** and **15-minute** markets, PolyBackTest aligns with **Polymarket**, which uses **Chainlink** as its oracle for resolution. Since Chainlink prices are tracked for these markets, data is fully consistent with the settlement prices.

**Key points:**

- **Orderbooks**: Captured directly from the market and are consistent.
- **Resolution Data**: Uses the official resolution data, so settlement outcomes are accurate.
- **Price Accuracy**: With Chainlink integration for short-term markets, price data is highly accurate to the settlement source.
