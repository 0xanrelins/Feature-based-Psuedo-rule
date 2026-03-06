# List All Markets

> Source: https://docs.polybacktest.com/api-reference/v1--markets/list-markets

Retrieve a paginated list of prediction markets with optional filtering.

## Endpoint

```
GET /v1/markets
```

**Authentication:** Required (`X-API-Key` header).

## Overview

Returns all available prediction markets. Use filtering parameters to narrow down results by market type or resolution status. Markets are sorted by `start_time` descending (newest first).

## Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | integer | No | 50 | Number of results to return (min: 1, max: 100) |
| `offset` | integer | No | 0 | Pagination offset (min: 0) |
| `market_type` | string | No | — | Filter by market type: `5m`, `15m`, `1hr`, `4hr`, `24hr` |
| `resolved` | boolean | No | — | Filter by resolution status |

## Response

### 200 — Successful Response

```json
{
  "markets": [
    {
      "market_id": "string",
      "event_id": "string",
      "slug": "string",
      "market_type": "string",
      "start_time": "2026-01-01T00:00:00Z",
      "end_time": "2026-01-01T00:00:00Z",
      "btc_price_start": 95000.0,
      "condition_id": "string",
      "clob_token_up": "string",
      "clob_token_down": "string",
      "winner": "Up",
      "final_volume": 12345.67,
      "final_liquidity": 5000.0,
      "btc_price_end": 96000.0,
      "resolved_at": "2026-01-01T00:00:00Z",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Response Schema: `MarketsListResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `markets` | array of objects | Yes | List of market objects |
| `total` | integer | Yes | Total number of markets matching the query |
| `limit` | integer | Yes | Number of results returned |
| `offset` | integer | Yes | Pagination offset used |

### Error Responses

| Status | Description |
| :--- | :--- |
| `401` | Missing or invalid API key |
| `422` | Validation error (invalid parameters) |
