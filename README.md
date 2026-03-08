# Feature-based Psuedo-rule

Unified local workspace for strategy parsing, backtesting, and UI orchestration.

[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#prerequisites)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](#prerequisites)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.12-000000?logo=nextdotjs&logoColor=white)](#architecture)
[![Status](https://img.shields.io/badge/Status-Local%20Integrated%20Workspace-4caf50)](#architecture)

This repository groups two tightly-coupled projects:

- `strategy demystify` (Next.js app: UI + API routes)
- `TEXT TO QUERY` (Python engine: parse + backtest + sync scripts)

---

## Quick Start

| Step | Command | Notes |
|---|---|---|
| 1. Install app deps | `cd "strategy demystify" && npm install` | Run once per machine |
| 2. Configure env | Create `TEXT TO QUERY/.env` and `strategy demystify/.env.local` | Keys + `TEXT_TO_QUERY_PATH` |
| 3. Build app | `cd "strategy demystify" && npm run build` | Production-safe startup |
| 4. Start app | `cd "strategy demystify" && PORT=3020 npm run start` | Open `http://localhost:3020` |
| 5. Smoke test parse | `curl -X POST "http://localhost:3020/api/motor" -H "Content-Type: application/json" -d '{"question":"buy UP at 0.60 when RSI < 30 in 15m markets last 3 days","dry_run":true}'` | Expect success JSON |

---

## Architecture

### 1) App Layer (`strategy demystify`)

- Renders UI and user flows.
- Exposes API routes:
  - `app/api/motor/route.ts`
  - `app/api/sync-cache/route.ts`
- Calls Python engine as subprocesses.

### 2) Engine Layer (`TEXT TO QUERY`)

- Core modules under `src/`:
  - strategy parsing (`llm_parse.py`)
  - query orchestration (`main.py`)
  - backtest simulation (`backtest.py`)
  - API client (`client.py`)
- Data tooling under `scripts/`.
- Local data in `data/`.

---

## End-to-End Flow

1. User sends a strategy query in the UI.
2. Next API (`/api/motor`) runs `python -m src.main --json`.
3. Engine parses strategy (LLM or fallback), runs backtest, returns JSON.
4. Next API normalizes fields for frontend.
5. UI shows confirmation, score, and risk metrics.

Data sync flow:

1. User triggers sync from UI.
2. Next API (`/api/sync-cache`) runs sync script in engine project.
3. Route returns sync stats/degraded status.

---

## Directory Layout

```text
Feature-based Psuedo-rule/
├─ README.md
├─ agent.md
├─ strategy demystify/
│  ├─ app/
│  ├─ package.json
│  └─ .env.local
└─ TEXT TO QUERY/
   ├─ src/
   ├─ scripts/
   ├─ data/
   └─ .env
```

---

## Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm
- Python 3.10+
- Network access for:
  - PolyBackTest API
  - OpenRouter or OpenAI (for LLM parsing)

---

## Environment Configuration

### `TEXT TO QUERY/.env`

Required:

```env
POLYBACKTEST_API_KEY=...
```

LLM provider (choose at least one):

```env
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

or

```env
OPENAI_API_KEY=...
OPENAI_LLM_MODEL=gpt-4o-mini
```

### `strategy demystify/.env.local`

Required:

```env
TEXT_TO_QUERY_PATH=/Users/0xanrelins/Documents/Feature-based Psuedo-rule/TEXT TO QUERY
```

Optional:

```env
MOTOR_PYTHON_BIN=python3
```

---

## Run Instructions

### Stable (recommended)

```bash
cd "/Users/0xanrelins/Documents/Feature-based Psuedo-rule/strategy demystify"
npm run build
PORT=3020 npm run start
```

Open: `http://localhost:3020`

### Development

```bash
cd "/Users/0xanrelins/Documents/Feature-based Psuedo-rule/strategy demystify"
npm run dev
```

Note: for long sessions and fewer hot-reload artifacts, prefer stable mode.

### Engine smoke test

```bash
cd "/Users/0xanrelins/Documents/Feature-based Psuedo-rule/TEXT TO QUERY"
python3 -m src.main "buy UP at 0.60 when RSI < 30 in 15m markets last 3 days" --json --dry-run
```

---

## API Smoke Tests

### Parse (dry-run)

```bash
curl -X POST "http://localhost:3020/api/motor" \
  -H "Content-Type: application/json" \
  -d '{"question":"buy UP at 0.60 when RSI < 30 in 15m markets last 3 days","dry_run":true}'
```

### Backtest

```bash
curl -X POST "http://localhost:3020/api/motor" \
  -H "Content-Type: application/json" \
  -d '{"question":"buy UP at 0.60 when RSI < 30 in 15m markets last 3 days"}'
```

---

## Data Notes

- Primary data root:
  - `TEXT TO QUERY/data`
- Snapshot payloads are stored as one JSON per market id in snapshot directory.
- Market index/history JSON files are used to locate and filter available markets.

---

## Troubleshooting

### `Cannot find module './331.js'` (Next.js runtime)

Cause: stale/corrupt `.next` artifacts (usually during hot reload churn).

Fix:

```bash
cd "/Users/0xanrelins/Documents/Feature-based Psuedo-rule/strategy demystify"
pkill -f "next dev" || true
rm -rf .next
npm run build
PORT=3020 npm run start
```

If this repeats, ensure only one Next process is running for this app.

### Parser shows fallback mode

Cause: LLM key/model/auth issue.

Checks:
- Validate `OPENROUTER_API_KEY` or `OPENAI_API_KEY` in `TEXT TO QUERY/.env`.
- Verify provider call from engine project.

### Sync route returns degraded/failed

Cause: upstream API issues, auth, or long-running sync script.

Checks:
- `POLYBACKTEST_API_KEY` validity
- engine script output
- route timeout behavior

---

## Change Management Guidelines

When editing behavior:

1. Update both layers if integration paths change.
2. Keep `TEXT_TO_QUERY_PATH` consistent with filesystem location.
3. Re-run:
   - `npm run build` in app
   - `/api/motor` dry-run smoke test
4. Avoid hardcoding legacy paths unless used as fallback.

5. Validate both integration routes after any path/config change:
   - `/api/motor`
   - `/api/sync-cache`

---

## Security

- Do not commit `.env` or `.env.local`.
- Do not expose API keys in logs/screenshots.
- Treat snapshot data as local runtime data, not source code.

---

## Operational Notes

- `strategy demystify` depends on `TEXT TO QUERY` at runtime.
- If folders are moved, update `TEXT_TO_QUERY_PATH` first.
- LLM parse mode requires valid provider keys (`OPENROUTER_API_KEY` or `OPENAI_API_KEY`).
- Sync can be long-running depending on upstream API conditions.
