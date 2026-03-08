# Agent Operating Guide

This document is the operational contract for AI agents working in:

- `/Users/0xanrelins/Documents/Feature-based Psuedo-rule/strategy demystify`
- `/Users/0xanrelins/Documents/Feature-based Psuedo-rule/TEXT TO QUERY`

It defines architecture, runtime dependencies, environment policy, execution runbooks, and safe change procedures.

---

## 1) System Overview

The platform is a two-tier local system:

1. **Application tier (Next.js)**: `strategy demystify`
   - Provides UI, API routes, and orchestration.
2. **Engine tier (Python)**: `TEXT TO QUERY`
   - Provides strategy parsing, backtest simulation, local data sync, and scoring inputs.

`strategy demystify` is not standalone. It invokes Python subprocesses from `TEXT TO QUERY`.

---

## 2) Architecture and Data Flow

### 2.1 Parse/Backtest flow

1. User enters query in UI.
2. Next route `app/api/motor/route.ts` receives request.
3. Route runs Python: `python3 -m src.main "<query>" --json [--dry-run]`.
4. Python engine parses, backtests, and returns JSON.
5. Next route normalizes response and returns app-safe schema.
6. UI renders confirmation/backtest output and history.

### 2.2 Sync flow

1. User presses `SYNC DATA`.
2. Next route `app/api/sync-cache/route.ts` runs:
   - `scripts/sync_15m_local_cache.py`
3. Route parses script output and returns sync status/coverage.

---

## 3) Directory Responsibilities

### 3.1 `strategy demystify`

- `app/page.tsx`: main UI shell and action wiring.
- `app/components/`: UI components.
- `app/services/motorService.ts`: frontend service adapter to `/api/motor`.
- `app/api/motor/route.ts`: bridge to Python engine.
- `app/api/sync-cache/route.ts`: bridge to cache sync scripts.
- `.env.local`: app-side environment and engine path.

### 3.2 `TEXT TO QUERY`

- `src/main.py`: primary parse/backtest orchestrator.
- `src/llm_parse.py`: LLM parsing and fallback behavior.
- `src/backtest.py`: trade simulation logic.
- `src/client.py`: PolyBackTest API client.
- `scripts/`: data fetch/sync utilities.
- `data/`: local market index + snapshots.
- `.env`: engine/API/LLM keys.

---

## 4) Runtime Dependency Contract

The app must know where the engine is located.

Required in `strategy demystify/.env.local`:

`TEXT_TO_QUERY_PATH=/Users/0xanrelins/Documents/Feature-based Psuedo-rule/TEXT TO QUERY`

If this path is wrong, `/api/motor` and `/api/sync-cache` fail.

---

## 5) Environment Variable Standard

### 5.1 Engine env (`TEXT TO QUERY/.env`)

Mandatory:
- `POLYBACKTEST_API_KEY`

LLM options (one provider is enough):
- OpenRouter:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_MODEL` (recommended: `openai/gpt-4o-mini`)
- or OpenAI:
  - `OPENAI_API_KEY`
  - `OPENAI_LLM_MODEL`

### 5.2 App env (`strategy demystify/.env.local`)

Mandatory:
- `TEXT_TO_QUERY_PATH`

Optional:
- API keys can exist here, but engine routes prefer/consume values from `TEXT TO QUERY/.env` for consistency.

---

## 6) Data Model and Storage

Engine local data root:
- `TEXT TO QUERY/data`

Current core assets:
- Market history index JSON
- Recent market index JSON
- Snapshot folder containing per-market JSON files

Rule:
- Snapshot folder contains one file per market id.
- API sync/backtest should never assume single-file snapshot storage.

---

## 7) Standard Runbook

### 7.1 Stable run (recommended)

In `strategy demystify`:
1. `npm run build`
2. `npm run start`

### 7.2 Dev run (faster iteration)

In `strategy demystify`:
1. `npm run dev`

If Next.js chunk corruption appears (`Cannot find module './331.js'`):
1. Stop all Next processes
2. Delete `.next`
3. Start again

### 7.3 Engine-only smoke test

In `TEXT TO QUERY`:
1. `python3 -m src.main "buy UP at 0.60 in 15m last 3 days" --json --dry-run`

Expected:
- JSON response
- `parser_mode` should be `llm` when keys are valid

---

## 8) Health Check Checklist

Minimum acceptance after any change:

1. `strategy demystify` build passes.
2. Home page returns `200`.
3. `POST /api/motor` dry-run returns success JSON.
4. `parser_mode` is correct (`llm` preferred, `fallback` only when LLM unavailable).
5. Sync route returns structured status (success or degraded, never silent crash).

---

## 9) Known Failure Modes and Responses

### 9.1 `Cannot find module './331.js'`
- Cause: stale/corrupt `.next` artifacts.
- Fix: stop processes, clear `.next`, rebuild/restart.

### 9.2 `parser_mode: fallback`
- Cause: LLM auth/model/env issue.
- Check: direct OpenRouter/OpenAI call from engine context.
- Fix: refresh keys/model in `TEXT TO QUERY/.env`.

### 9.3 Sync route hangs or errors
- Cause: long-running remote sync, API failure, auth mismatch.
- Fix: verify `POLYBACKTEST_API_KEY`, route timeout handling, degraded-mode response.

---

## 10) Change Management Policy

When modifying cross-project behavior:

1. Update app route code and engine code together.
2. Update env path assumptions in both locations.
3. Run app build + API smoke tests.
4. Validate from the moved/real filesystem paths (not assumed legacy paths).

Do not introduce hardcoded legacy absolute paths unless required as fallback.

---

## 11) Security and Safety

- Never commit secrets from `.env` or `.env.local`.
- Keep API keys in local env files only.
- Avoid destructive file operations on data snapshots unless explicitly requested.
- Prefer additive/migratory changes over destructive renames.

---

## 12) Agent Quick Commands

From `strategy demystify`:
- Build: `npm run build`
- Prod start: `npm run start`
- Dev start: `npm run dev`

From `TEXT TO QUERY`:
- Parse dry-run: `python3 -m src.main "<query>" --json --dry-run`
- Full run: `python3 -m src.main "<query>" --json`
- Sync cache: `python3 scripts/sync_15m_local_cache.py`
