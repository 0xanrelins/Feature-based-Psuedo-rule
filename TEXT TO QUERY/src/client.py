import httpx
from datetime import datetime

from .config import API_BASE_URL, get_api_key


class PolyBackTestClient:

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or get_api_key()
        self._client = httpx.Client(
            base_url=API_BASE_URL,
            # v2 works reliably with Bearer auth; keep x-api-key for compatibility.
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "x-api-key": self.api_key,
            },
            timeout=30.0,
        )

    def _get(self, path: str, params: dict | None = None) -> dict:
        resp = self._client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    def health(self) -> dict:
        return self._get("/health")

    def list_markets(
        self,
        market_type: str | None = None,
        resolved: bool | None = None,
        coin: str | None = "btc",
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        params = {"limit": limit, "offset": offset}
        if coin:
            params["coin"] = coin
        if market_type:
            params["market_type"] = market_type
        if resolved is not None:
            params["resolved"] = str(resolved).lower()
        return self._get("/v2/markets", params)

    def get_market_by_id(self, market_id: str) -> dict:
        return self._get(f"/v2/markets/{market_id}")

    def get_market_by_slug(self, slug: str) -> dict:
        return self._get(f"/v2/markets/by-slug/{slug}")

    def get_snapshots(
        self,
        market_id: str,
        include_orderbook: bool = False,
        limit: int = 1000,
        offset: int = 0,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> dict:
        params = {
            "include_orderbook": str(include_orderbook).lower(),
            "limit": limit,
            "offset": offset,
        }
        if start_time:
            params["start_time"] = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        if end_time:
            params["end_time"] = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self._get(f"/v2/markets/{market_id}/snapshots", params)

    def get_snapshot_at(self, market_id: str, timestamp: datetime) -> dict:
        ts = timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self._get(f"/v2/markets/{market_id}/snapshot-at/{ts}")

    def get_all_snapshots(
        self,
        market_id: str,
        include_orderbook: bool = False,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[dict]:
        """Fetch all snapshots for a market, handling pagination automatically."""
        all_snapshots = []
        offset = 0
        limit = 1000

        while True:
            data = self.get_snapshots(
                market_id, include_orderbook, limit, offset, start_time, end_time
            )
            snapshots = data.get("snapshots", [])
            all_snapshots.extend(snapshots)

            if len(snapshots) < limit:
                break
            offset += limit

        return all_snapshots

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
