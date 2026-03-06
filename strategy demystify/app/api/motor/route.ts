import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const PYTHON_BIN = process.env.MOTOR_PYTHON_BIN || "python3";
const DEFAULT_TEXT_TO_QUERY_PATH = process.env.TEXT_TO_QUERY_PATH || "/Users/0xanrelins/Desktop/Feature-based Psuedo-rule/TEXT TO QUERY";
const MAIN_MODULE = "src.main";

function loadTextToQueryEnvVars(textToQueryPath: string): Record<string, string> {
  const envPath = path.resolve(textToQueryPath, ".env");
  const picked: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return picked;
  try {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const [k, ...rest] = line.split("=");
      const v = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (k === "OPENROUTER_API_KEY" || k === "OPENROUTER_MODEL" || k === "OPENAI_API_KEY" || k === "OPENAI_LLM_MODEL") {
        picked[k] = v;
      }
    }
  } catch {
    return picked;
  }
  return picked;
}

interface ParsedStrategy {
  market_type: string;
  time_range: string;
  buy_triggers: Array<{ token: string; condition: string }>;
  sell_condition: string;
  entry_window_minutes?: number | null;
  entry_window_anchor?: "start" | "end" | null;
  exit_on_pct_move?: number | null;
}

interface MotorOutput {
  success: boolean;
  parsed_strategy?: ParsedStrategy;
  backtest?: Record<string, unknown>;
  trades?: Array<Record<string, unknown>>;
  warning?: string;
  error?: string;
  message?: string;
  parser_mode?: string;
  clarification_needed?: boolean;
  missing_fields?: string[];
}

function isParsedStrategy(value: unknown): value is ParsedStrategy {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.market_type !== "string") return false;
  if (typeof v.time_range !== "string") return false;
  if (!Array.isArray(v.buy_triggers) || v.buy_triggers.length === 0) return false;
  if (typeof v.sell_condition !== "string") return false;
  return v.buy_triggers.every((t) => {
    if (!t || typeof t !== "object") return false;
    const tr = t as Record<string, unknown>;
    return typeof tr.token === "string" && typeof tr.condition === "string";
  });
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("LLM output is empty");
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error("LLM output is not valid JSON");
  }
}

function runMotorJson(question: string, dryRun: boolean): MotorOutput {
  const textToQueryPath = DEFAULT_TEXT_TO_QUERY_PATH;
  const srcMainPath = path.resolve(textToQueryPath, "src/main.py");
  if (!fs.existsSync(srcMainPath)) {
    throw new Error(`MOTOR module not found: ${srcMainPath}`);
  }

  const args = ["-m", MAIN_MODULE, question, "--json"];
  if (dryRun) args.push("--dry-run");

  const llmEnv = loadTextToQueryEnvVars(textToQueryPath);

  const result = spawnSync(
    PYTHON_BIN,
    args,
    {
      cwd: textToQueryPath,
      env: {
        ...process.env,
        ...llmEnv,
        USE_CACHE_ONLY: process.env.USE_CACHE_ONLY || "1",
        LOCAL_DATA_ONLY: process.env.LOCAL_DATA_ONLY || "1",
        PYTHONPATH: [path.resolve(textToQueryPath, "src"), process.env.PYTHONPATH || ""].filter(Boolean).join(":"),
      },
      encoding: "utf-8",
      timeout: dryRun ? 120000 : 300000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(`Parse command failed (${result.status}): ${stderr || stdout || "unknown error"}`);
  }

  const stdout = (result.stdout || "").trim();
  if (!stdout) throw new Error("MOTOR returned empty output");
  return extractJsonObject(stdout) as MotorOutput;
}

function toNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const n = Number(input.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function scoreFromBacktest(backtest: Record<string, unknown>) {
  const winRate = toNumber(backtest.win_rate) ?? 0;
  const totalPnl = toNumber(backtest.total_pnl) ?? 0;
  const avgPnl = toNumber(backtest.avg_pnl) ?? 0;
  const totalTrades = toNumber(backtest.total_trades) ?? 0;

  const pt = Math.max(0, Math.min(20, Math.round((Math.max(-100, totalPnl) + 100) / 10)));
  const pro = Math.max(0, Math.min(20, Math.round(winRate / 5)));
  const sr = Math.max(0, Math.min(20, Math.round((avgPnl + 1) * 10)));
  const card = Math.max(0, Math.min(20, totalTrades >= 50 ? 20 : Math.round((totalTrades / 50) * 20)));
  const ae = Math.max(0, Math.min(20, Math.round((avgPnl + 0.5) * 20)));
  const total = Math.max(0, Math.min(100, pt + pro + sr + card + ae));

  return { pt, pro, sr, card, ae, total };
}

function parseIsoToMs(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = (body?.question || "").trim();
    const dryRun = Boolean(body?.dry_run);
    if (!question) {
      return NextResponse.json(
        { success: false, error: "missing_question", message: "Question is required." },
        { status: 400 }
      );
    }

    let parsedStrategy: ParsedStrategy | undefined;
    let parseWarning: string | undefined;
    let parserMode: string | undefined;
    let parsedOutput: MotorOutput;
    try {
      parsedOutput = runMotorJson(question, true);
      parsedStrategy = parsedOutput.parsed_strategy;
      parseWarning = parsedOutput.warning;
      parserMode = parsedOutput.parser_mode;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse strategy.";
      return NextResponse.json(
        {
          success: false,
          clarification_needed: true,
          error: "parse_error",
          message,
          missing_fields: ["market_type", "time_range", "buy_triggers", "sell_condition"],
        },
        { status: 400 }
      );
    }

    if (!parsedOutput.success) {
      const status = parsedOutput.error === "unsupported_timeframe_for_local_cache" ? 400 : 200;
      return NextResponse.json(
        {
          success: false,
          clarification_needed: Boolean(parsedOutput.clarification_needed),
          error: parsedOutput.error || "parse_error",
          message: parsedOutput.message || "Failed to parse strategy.",
          missing_fields: parsedOutput.missing_fields || ["market_type", "time_range", "buy_triggers", "sell_condition"],
          parser_mode: parsedOutput.parser_mode,
          warning: parsedOutput.warning,
          hint: parsedOutput.error === "unsupported_timeframe_for_local_cache" ? "Please switch the query timeframe to 15m." : undefined,
        },
        { status }
      );
    }

    if (!parsedStrategy || !isParsedStrategy(parsedStrategy)) {
      return NextResponse.json(
        {
          success: false,
          clarification_needed: true,
          error: "parse_error",
          message: "Parser did not return a valid strategy schema.",
          missing_fields: ["market_type", "time_range", "buy_triggers", "sell_condition"],
          parser_mode: parserMode,
          warning: parseWarning,
          raw: parsedOutput,
        },
        { status: 400 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: "Parsed strategy. Waiting for approval before backtest.",
        parsed_strategy: parsedStrategy,
        parser_mode: parserMode,
        warning: parseWarning,
      });
    }

    let output: MotorOutput;
    try {
      output = runMotorJson(question, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to run backtest.";
      return NextResponse.json(
        {
          success: false,
          error: "backtest_error",
          message,
          parsed_strategy: parsedStrategy,
          parser_mode: parserMode,
          warning: parseWarning,
        },
        { status: 500 }
      );
    }

    if (!output.success) {
      return NextResponse.json(
        {
          success: false,
          error: output.error || "motor_failed",
          message: output.message || "MOTOR failed.",
          parsed_strategy: parsedStrategy,
          parser_mode: output.parser_mode || parserMode,
          warning: output.warning || parseWarning,
        },
        { status: 500 }
      );
    }

    const bt = output.backtest || {};
    const trades = Array.isArray(output.trades) ? output.trades : [];
    const totalTrades = toNumber((bt as Record<string, unknown>).total_trades) ?? trades.length;
    const skippedMarkets = toNumber((bt as Record<string, unknown>).skipped_markets) ?? 0;
    const winsFromBacktest = toNumber((bt as Record<string, unknown>).wins);
    const lossesFromBacktest = toNumber((bt as Record<string, unknown>).losses);

    let wins = winsFromBacktest ?? 0;
    let losses = lossesFromBacktest ?? 0;
    let grossProfit = 0;
    let grossLoss = 0;
    const holdingDurationsMin: number[] = [];

    for (const t of trades) {
      const pnl = toNumber((t as Record<string, unknown>).pnl) ?? 0;
      const isWinRaw = (t as Record<string, unknown>).is_win;
      const isWin = typeof isWinRaw === "boolean" ? isWinRaw : pnl > 0;
      if (winsFromBacktest === null && isWin) wins += 1;
      if (lossesFromBacktest === null && !isWin) losses += 1;
      if (pnl > 0) grossProfit += pnl;
      if (pnl < 0) grossLoss += Math.abs(pnl);

      const entryMs = parseIsoToMs((t as Record<string, unknown>).entry_time);
      const exitMs = parseIsoToMs((t as Record<string, unknown>).exit_time);
      if (entryMs !== null && exitMs !== null && exitMs >= entryMs) {
        holdingDurationsMin.push((exitMs - entryMs) / (1000 * 60));
      }
    }

    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : null;
    const averageHoldingMinutes =
      holdingDurationsMin.length > 0
        ? holdingDurationsMin.reduce((a, b) => a + b, 0) / holdingDurationsMin.length
        : null;

    const scoreBreakdown = scoreFromBacktest(bt);

    return NextResponse.json({
      success: true,
      message: "Backtest completed.",
      parsed_strategy: parsedStrategy,
      backtest: {
        total_markets: totalTrades + skippedMarkets,
        executed_trades: totalTrades,
        winning_trades: wins,
        losing_trades: losses,
        win_rate: toNumber((bt as Record<string, unknown>).win_rate) ?? 0,
        avg_pnl_per_trade: toNumber((bt as Record<string, unknown>).avg_pnl) ?? 0,
        total_pnl: toNumber((bt as Record<string, unknown>).total_pnl) ?? 0,
        max_drawdown: null,
        profit_factor: profitFactor,
        average_holding_minutes: averageHoldingMinutes,
        skipped_markets_no_signal: skippedMarkets,
        skipped_markets_no_entry_snapshot: 0,
        skipped_markets_no_exit_snapshot: 0,
        skipped_markets_missing_snapshots: 0,
        score: scoreBreakdown.total,
        summary: (bt as Record<string, unknown>).summary,
      },
      score_breakdown: scoreBreakdown,
      warning: output.warning || parseWarning,
      parser_mode: output.parser_mode || parserMode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json(
      { success: false, error: "server_error", message },
      { status: 500 }
    );
  }
}
