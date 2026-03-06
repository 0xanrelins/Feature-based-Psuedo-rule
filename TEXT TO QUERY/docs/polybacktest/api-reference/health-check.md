# Service Health Check

> Source: https://docs.polybacktest.com/api-reference/health/health-check

Verify the API service is running and responsive.

## Endpoint

```
GET /health
```

**Authentication:** Not required.

## Response

### 200 — Successful Response

```json
{
  "status": "string",
  "timestamp": "2026-01-01T00:00:00Z"
}
```

### Response Schema: `HealthResponse`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `status` | string | Yes | Service status |
| `timestamp` | string (date-time) | Yes | Current server timestamp |
