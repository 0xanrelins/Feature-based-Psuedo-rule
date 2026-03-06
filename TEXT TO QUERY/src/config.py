import os
from dataclasses import dataclass, field

VALID_TIMEFRAMES = ("5m", "15m", "1hr", "4hr", "24hr")
VALID_TOKENS = ("up", "down")
MAX_DATA_RANGE_DAYS = 31

# Max snapshots to scan per market when looking for entry (paginate until condition or cap).
# Derived from typical market length; API returns max 1000 per request.
SCAN_CAP_BY_TIMEFRAME = {
    "5m": 10_000,
    "15m": 20_000,
    "1hr": 60_000,
    "4hr": 200_000,
    "24hr": 500_000,
}
SNAPSHOTS_PAGE_SIZE = 1000  # API max per request

API_BASE_URL = "https://api.polybacktest.com"


def get_scan_cap(timeframe: str) -> int:
    """Max snapshots to scan per market before stopping (no entry found)."""
    return SCAN_CAP_BY_TIMEFRAME.get(timeframe, 20_000)


@dataclass
class Definments:
    platform: str = "polymarket"
    topic: str = "crypto"
    pair: str = "btc"
    timeframe: str = "15m"
    token: str = "up"
    data_range_days: int = 30
    data_platform: str = "polybacktest"

    def validate(self) -> list[str]:
        errors = []
        if self.timeframe not in VALID_TIMEFRAMES:
            errors.append(f"Invalid timeframe '{self.timeframe}'. Valid: {VALID_TIMEFRAMES}")
        if self.token not in VALID_TOKENS:
            errors.append(f"Invalid token '{self.token}'. Valid: {VALID_TOKENS}")
        if self.data_range_days > MAX_DATA_RANGE_DAYS:
            errors.append(f"Data range {self.data_range_days}d exceeds max {MAX_DATA_RANGE_DAYS}d.")
        if self.data_range_days < 1:
            errors.append("Data range must be at least 1 day.")
        return errors

    @property
    def is_valid(self) -> bool:
        return len(self.validate()) == 0


def get_api_key() -> str:
    key = os.environ.get("POLYBACKTEST_API_KEY", "")
    if not key:
        raise EnvironmentError(
            "POLYBACKTEST_API_KEY not set. "
            "Get one at https://polybacktest.com/dashboard"
        )
    return key
