# Plan: 15m BTC Market — 30 Days Market Info in Under 1 Minute

**Goal:** Fetch all 15-minute BTC market metadata (market list) for the last 30 days in **under 1 minute**.

---

## What We’re Fetching

- **Market type:** 15m (BTC up/down on Polymarket = same list)
- **Range:** Last 30 days (start_time within 30 days)
- **Data:** Market list only (each record: market_id, slug, start_time, end_time, etc.) — no snapshots in this plan

---

## Rough Count

- 15m = one market every 15 minutes.
- 30 days = 30 × 24 × 4 = **2880** such markets (max).

So we need at most **2880 market records**.

---

## API Usage

- **Endpoint:** `GET /v1/markets?market_type=15m&limit=100&offset={offset}`
- **Limit:** 100 markets per request (list-markets max).
- **Requests needed:** ceil(2880 / 100) = **29 requests**.

---

## Time vs Limits

- **29 requests** << 2000/minute → fits in 1 minute.
- Burst: 100/sec → 29 requests in &lt; 1 second.
- **Conclusion:** Yes, 15m BTC market’s 30-day **market list** can be fetched in **under 1 minute** (in practice a few seconds).

---

## Step-by-Step Plan

| Step | Action | Requests |
| :--- | :--- | :--- |
| 1 | `GET /v1/markets?market_type=15m&limit=100&offset=0` → read `total` | 1 |
| 2 | Loop: `offset=100,200,...,2800` until you have all markets with `start_time >= (now - 30 days)` | 28 (or stop when last batch is older than 30 days) |
| 3 | (Optional) Filter client-side: keep only markets where `start_time` is in last 30 days | 0 |

**Total:** ≤ 29 requests. Run at ≤ 100/sec → **under 1 minute** (typically a few seconds).

---

## If You Also Want Snapshots

If “market bilgisi datasi” includes **snapshots** (e.g. first 1000 per market):

- 2880 markets × 1 snapshot-request each = **2880 snapshot requests**.
- Plus 29 list requests → **2909 total**.
- 2909 > 2000/minute → needs **2 minutes** (e.g. minute 1: 2000, minute 2: 909).

So: **market list only → under 1 minute. Market list + snapshots for all → about 2 minutes.**
