# Get Snapshot At Timestamp

> Source: https://docs.polybacktest.com/api-reference/v1--snapshots/get-snapshot-at-timestamp

Find the exact market state at a specific point in time.

## Endpoint

```
GET /v1/markets/{market_id}/snapshot-at/{timestamp}
```

**Authentication:** Required (`X-API-Key` header).

## Precision Lookup

This endpoint finds the closest snapshot within a **±2 second tolerance** of your target timestamp. Perfect for:
- Point-in-time analysis
- Correlating with external events
- Backtesting trade entries/exits

> **Warning:** Returns 404 if no snapshot exists within the 2-second tolerance window.

## Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `market_id` | string | Yes | Market ID (e.g., `1051520`) |
| `timestamp` | string (date-time) | Yes | Target timestamp in ISO8601 format (e.g., `2026-01-01T12:30:00Z`) |

## Response

### 200 — Successful Response

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
      "id": 42,
      "time": "2026-01-01T12:30:00Z",
      "market_id": "1051520",
      "btc_price": 95500.25,
      "price_up": 0.55,
      "price_down": 0.45,
      "orderbook_up": null,
      "orderbook_down": null
    }
  ]
}
```

### Response Schema: `SnapshotAtTimestampResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `market` | MarketResponse | Yes | Market details |
| `snapshots` | array of SnapshotResponse | Yes | Array containing 0 or 1 snapshot closest to the requested timestamp |

> **Note:** Snapshots are always returned as an array. If no snapshot is found within ±2 seconds, the array will be empty (and a 404 is returned).

### Error Responses

| Status | Description |
| :--- | :--- |
| `401` | Missing or invalid API key |
| `404` | No snapshot found within ±2 seconds of timestamp |
| `422` | Validation error |
