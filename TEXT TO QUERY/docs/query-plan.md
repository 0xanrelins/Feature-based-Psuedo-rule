# Query Plan — Minimum Time to Download Max Data

How to design requests so you pull the most data in the shortest time, within PolyBackTest limits.

---

## Limits (from docs)

| What | Value | Source |
| :--- | :--- | :--- |
| Requests per minute | 2000 | rate-limits |
| Requests per second (burst) | 100 | rate-limits |
| Markets per list request | max 100 | list-markets |
| Snapshots per request | max 1000 | get-market-snapshots |

---

## Target

- **Goal:** In the least wall-clock time, get **2000 market records** and **for each market the first 1000 snapshots**.
- **Constraint:** That needs **20 + 2000 = 2020 requests**, but only **2000 requests/minute** are allowed. So it takes **2 minutes** (two rate-limit windows).

---

## Recommendations (why this plan)

1. **Use list-markets at full page size**  
   Always use `limit=100` so each request gives 100 markets. Fewer requests for the same number of markets.

2. **Use snapshots at full page size**  
   Always use `limit=1000` per request. One request per market for “first 1000 snapshots” is optimal.

3. **Do market list first, then snapshots**  
   You need market IDs before you can request snapshots. So: spend the first N requests on list-markets (N = ceil(desired_markets / 100)), then use the rest of the 2000-request budget for snapshot calls. No “guess” market IDs.

4. **Respect burst (100/sec)**  
   If you send more than 100 requests in one second, you can hit burst limit before the minute limit. So pace at ≤100 req/sec (e.g. 100 per second for 20 seconds = 2000 requests in 20 seconds, then wait for the next minute for the next 20).

5. **Pack the first minute to 2000 exactly**  
   Minute 1: 20 list-markets (→ 2000 market infos) + 1980 snapshot requests (→ 1980 markets × 1000 snapshots). Minute 2: 20 snapshot requests (→ remaining 20 markets × 1000 snapshots). Total 2 minutes, and you have 2000 market infos + 2000 × 1000 snapshots.

6. **Optional: cache market list**  
   If you already have 2000 market IDs (e.g. from a previous run), you can use all 2000 requests in one minute for snapshots only → 2000 × 1000 snapshots in 1 minute.

---

## Query Plan (step-by-step)

### Option A — Full run from scratch (2000 markets + 2000 × 1000 snapshots)

**Minute 1**

| Step | Request | Count | Purpose |
| :--- | :--- | :--- | :--- |
| 1 | `GET /v1/markets?market_type={tf}&resolved={bool}&limit=100&offset=0` … offset=1900 | 20 | Fetch 2000 market records (100 per request). |
| 2 | For each of the first 1980 `market_id`: `GET /v1/markets/{market_id}/snapshots?limit=1000&offset=0` | 1980 | First 1000 snapshots for 1980 markets. |

Total minute 1: 20 + 1980 = **2000 requests**.  
Result: 2000 market infos, 1980 × 1000 snapshots.

**Minute 2**

| Step | Request | Count | Purpose |
| :--- | :--- | :--- | :--- |
| 3 | For each of the remaining 20 `market_id`: `GET /v1/markets/{market_id}/snapshots?limit=1000&offset=0` | 20 | First 1000 snapshots for the last 20 markets. |

Total minute 2: **20 requests**.  
Result: 20 × 1000 snapshots.

**Total wall-clock:** 2 minutes.  
**Total data:** 2000 market infos + 2000 × 1000 = 2,000,000 snapshots.

---

### Option B — Already have 2000 market IDs (e.g. cached)

**Minute 1**

| Step | Request | Count | Purpose |
| :--- | :--- | :--- | :--- |
| 1 | For each of 2000 `market_id`: `GET /v1/markets/{market_id}/snapshots?limit=1000&offset=0` | 2000 | First 1000 snapshots per market. |

**Total wall-clock:** 1 minute.  
**Total data:** 2000 × 1000 = 2,000,000 snapshots (no new market list in this minute).

---

## Pacing (avoid 429)

- **Per second:** Send at most **100** requests per second (burst limit).
- **Per minute:** Send at most **2000** requests per minute.
- Example: 2000 requests at 100/sec → 20 seconds of sends, then 40 seconds idle in that same minute. Next minute you can send the next 20 requests.

So "minimum time" = send requests within these limits and complete 2020 requests in 2 minutes (Option A) or 2000 requests in 1 minute (Option B).

---

## Summary

| Scenario | Requests | Time | Result |
| :--- | :--- | :--- | :--- |
| A: 2000 market list + 2000×1000 snapshots from scratch | 2020 | 2 min | 2000 markets + 2M snapshots |
| B: 2000×1000 snapshots only (IDs already known) | 2000 | 1 min | 2M snapshots |

Design principle: **Maximize data per request (list=100, snapshots=1000), then fit the request count into 2000/min and 100/sec.**
