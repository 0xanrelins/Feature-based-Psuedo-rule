# Plan: 15m BTC — Last 7 Days, Every Market’s Full Snapshots (Minimum Time)

**Goal:** Fetch all snapshots for every 15m BTC market in the last 7 days, as fast as rate limits allow.

---

## Scale

- **7 days, 15m** → 7 × 24 × 4 = **672 markets**
- **List:** ceil(672/100) = **7 requests**
- **Snapshots per market:** ~7–8 requests (≈7000 snapshots per 15m market, 1000 per request)
- **Total snapshot requests:** 672 × 8 ≈ **5376**
- **Total requests:** 7 + 5376 ≈ **5383**
- **Rate limit:** 2000/minute → **ceil(5383/2000) = 3 minutes** (3 rate-limit windows)

---

## Strategy (minimum time)

1. **Market list**  
   `GET /v1/markets?market_type=15m&limit=100&offset=0,100,...`  
   Keep only markets whose `start_time` is within the last 7 days. ≈7 requests.

2. **All snapshots per market**  
   Iterate over the market list; for each:  
   `GET /v1/markets/{market_id}/snapshots?limit=1000&offset=0,1000,...`  
   Increment offset until fewer than 1000 are returned. Each market is fully fetched.

3. **Pacing**  
   - **Burst:** At most 100 requests per second → 2000 requests in ≈20 seconds.  
   - **Per minute:** After 2000 requests in a minute, wait until the next minute window, then send remaining requests.

4. **Storage**  
   One file per market: `data/15m_7d_snapshots/{market_id}.json`  
   (A single large file is possible; separate files make resume and inspection easier.)

---

## Estimated time

- **Minute 1:** 7 (list) + 1993 (snapshots) = 2000 requests → ~20 seconds (within burst)
- **Minute 2:** 2000 requests → ~20 seconds
- **Minute 3:** 1383 requests → ~14 seconds  

**Total wall time:** ~3 minutes (due to rate windows; actual request time ~1 minute, rest is waiting).
