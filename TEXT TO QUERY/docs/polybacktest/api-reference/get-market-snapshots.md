# Get Market Snapshots

> Source: https://docs.polybacktest.com/api-reference/v1--snapshots/get-market-snapshots

Retrieve paginated historical snapshots for backtesting and analysis.

## Endpoint

```
GET /v1/markets/{market_id}/snapshots
```

**Authentication:** Required (`X-API-Key` header).

## Snapshot Data

Snapshots capture the market state at regular intervals, including:
- **Price data**: Bid/ask prices for UP and DOWN tokens
- **Order book**: Full order book depth at capture time
- **BTC price**: Bitcoin price at snapshot time

> **Note:** Orderbooks are not returned by default (`include_orderbook=false`). Set `include_orderbook=true` when you need full orderbook depth.

> **Tip:** Use `start_time` and `end_time` filters to focus on specific time windows for backtesting.

## Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `market_id` | string | Yes | Market ID (e.g., `1051520`) |

## Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `include_orderbook` | boolean | No | false | Include full orderbook JSON in each snapshot |
| `limit` | integer | No | 100 | Number of results to return (min: 1, max: 1000) |
| `offset` | integer | No | 0 | Pagination offset (min: 0) |
| `start_time` | string (date-time) | No | — | Filter snapshots after this time (ISO8601) |
| `end_time` | string (date-time) | No | — | Filter snapshots before this time (ISO8601) |

## Response

### 200 — Successful Response

Returns snapshots sorted by time ascending (oldest first).

```json
{
  "market": {
    "market_id": "1051520",
    "event_id": "string",
    "slug": "btc-updown-24h-2026-01-01",
    "market_type": "24hr",
    "start_time": "2026-01-01T00:00:00Z",
    "end_time": "2026-01-02T00:00:00Z"
  },
  "snapshots": [
    {
      "id": 1,
      "time": "2026-01-01T00:01:00Z",
      "market_id": "1051520",
      "btc_price": 95100.50,
      "price_up": 0.52,
      "price_down": 0.48,
      "orderbook_up": null,
      "orderbook_down": null
    }
  ],
  "total": 1440,
  "limit": 100,
  "offset": 0
}
```

### Response Schema: `SnapshotsListResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `market` | MarketResponse | Yes | Market details |
| `snapshots` | array of SnapshotResponse | Yes | Array of market snapshots |
| `total` | integer | Yes | Total number of snapshots available for this market |
| `limit` | integer | Yes | Number of results returned in this response |
| `offset` | integer | Yes | Pagination offset used for this request |

### Snapshot Schema: `SnapshotResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | integer | Yes | Unique snapshot identifier |
| `time` | string (date-time) | Yes | Timestamp when the snapshot was captured (ISO8601) |
| `market_id` | string | Yes | ID of the market this snapshot belongs to |
| `btc_price` | number or null | No | Bitcoin price at the time of snapshot (USD) |
| `price_up` | number or null | No | Best price for the UP token (0-1 range) |
| `price_down` | number or null | No | Best price for the DOWN token (0-1 range) |
| `orderbook_up` | OrderBookResponse or null | No | Full order book for the UP token |
| `orderbook_down` | OrderBookResponse or null | No | Full order book for the DOWN token |

### OrderBook Schema: `OrderBookResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `bids` | array of OrderBookEntry | Yes | Buy orders, sorted by price descending |
| `asks` | array of OrderBookEntry | Yes | Sell orders, sorted by price ascending |

### OrderBookEntry Schema

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `price` | number | Yes | Order price (0-1 range) |
| `size` | number | Yes | Order size in tokens |

### Error Responses

| Status | Description |
| :--- | :--- |
| `401` | Missing or invalid API key |
| `404` | Market not found |
| `422` | Validation error |
