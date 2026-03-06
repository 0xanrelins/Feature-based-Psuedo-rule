# Get Market Details

> Source: https://docs.polybacktest.com/api-reference/v1--markets/get-market-by-id

Retrieve detailed information about a specific market by ID.

## Endpoint

```
GET /v1/markets/{market_id}
```

**Authentication:** Required (`X-API-Key` header).

## Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `market_id` | string | Yes | Market ID (e.g., `1051520`) |

## Response

### 200 — Successful Response

```json
{
  "market_id": "1051520",
  "event_id": "string",
  "slug": "btc-updown-24h-2026-01-01",
  "market_type": "24hr",
  "start_time": "2026-01-01T00:00:00Z",
  "end_time": "2026-01-02T00:00:00Z",
  "btc_price_start": 95000.0,
  "condition_id": "string",
  "clob_token_up": "string",
  "clob_token_down": "string",
  "winner": "Up",
  "final_volume": 12345.67,
  "final_liquidity": 5000.0,
  "btc_price_end": 96000.0,
  "resolved_at": "2026-01-02T00:00:00Z",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-02T00:00:00Z"
}
```

### Response Schema: `MarketResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `market_id` | string | Yes | Unique market identifier |
| `event_id` | string | Yes | Associated event identifier |
| `slug` | string | Yes | Human-readable market slug |
| `market_type` | string | Yes | Market type (5m, 15m, 1hr, 4hr, 24hr) |
| `start_time` | string (date-time) | Yes | Market start time |
| `end_time` | string (date-time) | Yes | Market end time |
| `btc_price_start` | number or null | No | BTC price at market start (USD) |
| `condition_id` | string or null | No | Polymarket condition ID |
| `clob_token_up` | string or null | No | CLOB token ID for UP outcome |
| `clob_token_down` | string or null | No | CLOB token ID for DOWN outcome |
| `winner` | string or null | No | Winning outcome ("Up" or "Down") |
| `final_volume` | number or null | No | Total trading volume |
| `final_liquidity` | number or null | No | Final liquidity |
| `btc_price_end` | number or null | No | BTC price at market end (USD) |
| `resolved_at` | string (date-time) or null | No | Resolution timestamp |
| `created_at` | string (date-time) or null | No | Creation timestamp |
| `updated_at` | string (date-time) or null | No | Last update timestamp |

### Error Responses

| Status | Description |
| :--- | :--- |
| `401` | Missing or invalid API key |
| `404` | Market not found |
| `422` | Validation error |
