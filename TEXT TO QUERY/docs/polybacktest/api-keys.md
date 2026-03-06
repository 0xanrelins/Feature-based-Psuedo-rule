# API Keys

> Source: https://docs.polybacktest.com/api-keys

How to generate and use API keys.

## Overview

PolyBackTest uses API keys to authenticate requests. You can view and manage your API keys in the [Dashboard](https://polybacktest.com/dashboard).

Your API keys carry many privileges, so be sure to keep them secure! Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, and so forth.

## Generate an API Key

1. Log in to your [PolyBackTest account](https://polybacktest.com/login).
2. Navigate to the [Dashboard](https://polybacktest.com/dashboard).
3. Select the **API Keys** tab from the sidebar.
4. Click the **Create New Key** button.
5. Enter a name for your key (e.g., "Production Bot") and set an expiration if desired.
6. Click **Create Key**.
7. **Copy your key immediately.** It will only be shown once.

> **Warning:** If you lose your API key, you will need to revoke it and generate a new one. We do not store the full key for security reasons.

## Using the API Key

You must include the API key in the `X-API-Key` header with every request.

### Header Example

```bash
curl -X GET "https://api.polybacktest.com/v1/markets" \
  -H "X-API-Key: pdm_your_api_key_here"
```

### Authentication Errors

| Status Code | Description |
| :--- | :--- |
| `401 Unauthorized` | The API key is missing, invalid, or expired. |
| `403 Forbidden` | The API key does not have permission to access the requested resource. |

## Best Practices

- **Use distinct keys**: Create separate API keys for different applications or environments (e.g., development vs. production).
- **Set expirations**: For added security, set expiration dates on your keys and rotate them periodically.
- **Revoke unused keys**: Delete keys that are no longer in use to reduce your attack surface.
