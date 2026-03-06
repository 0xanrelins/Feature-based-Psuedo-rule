# Get Market By Slug

> Source: https://docs.polybacktest.com/api-reference/v1--markets/get-market-by-slug

Retrieve market details using a human-readable slug identifier.

## Endpoint

```
GET /v1/markets/by-slug/{slug}
```

**Authentication:** Required (`X-API-Key` header).

## Slug Format

Market slugs follow a consistent naming pattern based on the market type and timing.

**Examples:**
- `btc-updown-24h-2026-01-01`
- `btc-updown-1hr-2026-01-01-09`

## Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `slug` | string | Yes | Human-readable market slug (e.g., `btc-updown-24h-2026-01-01`) |

## Response

### 200 — Successful Response

Returns a `MarketResponse` object (same schema as [Get Market Details](get-market-by-id.md)).

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

### Error Responses

| Status | Description |
| :--- | :--- |
| `401` | Missing or invalid API key |
| `404` | Market not found |
| `422` | Validation error |
