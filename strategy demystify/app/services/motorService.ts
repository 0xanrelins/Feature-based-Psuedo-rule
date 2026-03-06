"use client";

import { ChatMessage, generateId } from "../types";

export interface ParsedStrategy {
  market_type: string;
  time_range: string;
  buy_triggers: Array<{ token: string; condition: string }>;
  sell_condition: string;
  entry_window_minutes?: number | null;
  entry_window_anchor?: "start" | "end" | null;
  exit_on_pct_move?: number | null;
}

export interface BacktestResult {
  total_markets: number;
  executed_trades: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate: number;
  avg_pnl_per_trade: number;
  total_pnl: number;
  max_drawdown: number | null;
  profit_factor: number | null;
  score: number;
  average_holding_minutes?: number | null;
  skipped_markets_no_signal?: number;
  skipped_markets_no_entry_snapshot?: number;
  skipped_markets_no_exit_snapshot?: number;
  skipped_markets_missing_snapshots?: number;
}

export interface MotorResult {
  success: boolean;
  message: string;
  parsed_strategy?: ParsedStrategy;
  backtest?: BacktestResult;
  score_breakdown?: {
    pt: number;
    pro: number;
    sr: number;
    card: number;
    ae: number;
    total: number;
  };
  error?: string;
  warning?: string;
  hint?: string;
  parser_mode?: string;
  raw?: Record<string, unknown>;
  clarification_needed?: boolean;
  missing_fields?: string[];
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function motorParse(question: string): Promise<MotorResult> {
  const response = await fetch("/api/motor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, dry_run: true }),
  });
  return response.json();
}

export async function motorBacktest(question: string): Promise<MotorResult> {
  const response = await fetch("/api/motor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return response.json();
}

export function motorResultToChatMessage(question: string, result: MotorResult): ChatMessage {
  if (!result.success) {
    const parserModeNote =
      result.parser_mode === "fallback"
        ? "\n\n⚠️ Parser mode: fallback (LLM unavailable, rule-based parser used)."
        : "";
    const warningNote = result.warning ? `\n\n⚠️ ${result.warning}` : "";
    const hintNote = result.hint ? `\nHint: ${result.hint}` : "";
    const rawNote = result.raw ? `\n\nRaw parser output:\n\`\`\`json\n${JSON.stringify(result.raw, null, 2)}\n\`\`\`` : "";

    if (result.clarification_needed) {
      const missing = (result.missing_fields || []).join(", ") || "details";
      return {
        id: generateId(),
        question,
        answer: `❓ Clarification needed before running.\nMissing: ${missing}\n\n${result.message}${hintNote}${parserModeNote}${warningNote}${rawNote}`,
        scores: { pt: 0, pro: 0, sr: 0, card: 0, ae: 0, total: 0 },
        timestamp: Date.now(),
        isExpanded: false,
      };
    }
    return {
      id: generateId(),
      question,
      answer: `❌ ${result.message}${hintNote}${parserModeNote}${warningNote}${rawNote}`,
      scores: { pt: 0, pro: 0, sr: 0, card: 0, ae: 0, total: 0 },
      timestamp: Date.now(),
      isExpanded: false,
    };
  }

  const bt = result.backtest || {
    total_markets: 0,
    executed_trades: 0,
    win_rate: 0,
    avg_pnl_per_trade: 0,
    total_pnl: 0,
    max_drawdown: 0,
    profit_factor: 0,
    score: 0,
  };

  const score = result.score_breakdown || {
    pt: 0,
    pro: 0,
    sr: 0,
    card: 0,
    ae: 0,
    total: bt.score || 0,
  };

  const parserModeNote =
    result.parser_mode === "fallback"
      ? "\n\n⚠️ Parser mode: fallback (LLM unavailable, rule-based parser used)."
      : "";
  const warningNote = result.warning ? `\n\n⚠️ ${result.warning}` : "";

  const avgPnlPct = normalizeNumber(bt.avg_pnl_per_trade);
  const totalPnlPct = normalizeNumber(bt.total_pnl);
  const maxDdPct = normalizeNumber(bt.max_drawdown);
  const profitFactor = normalizeNumber(bt.profit_factor);
  const winningTrades = normalizeNumber(bt.winning_trades);
  const losingTrades = normalizeNumber(bt.losing_trades);
  const avgHoldMinutes = normalizeNumber(bt.average_holding_minutes);
  const avgHoldLabel =
    avgHoldMinutes === undefined
      ? "N/A"
      : avgHoldMinutes < 1
        ? `${(avgHoldMinutes * 60).toFixed(1)}s`
        : `${avgHoldMinutes.toFixed(1)}m`;

  const skippedNoSignal = normalizeNumber(bt.skipped_markets_no_signal) ?? 0;
  const skippedNoEntry = normalizeNumber(bt.skipped_markets_no_entry_snapshot) ?? 0;
  const skippedNoExit = normalizeNumber(bt.skipped_markets_no_exit_snapshot) ?? 0;
  const skippedMissing = normalizeNumber(bt.skipped_markets_missing_snapshots) ?? 0;

  const answer = `### Summary
Executed ${bt.executed_trades} trades on ${bt.total_markets} markets.
Wins/Losses: ${(winningTrades ?? 0).toFixed(0)} / ${(losingTrades ?? 0).toFixed(0)}
Score: ${score.total}/100
Average hold time: ${avgHoldLabel}
Skipped markets -> no signal: ${skippedNoSignal}, no entry snapshot: ${skippedNoEntry}, no exit snapshot: ${skippedNoExit}, missing snapshots: ${skippedMissing}

### Risk Assessment
Win Rate: ${bt.win_rate.toFixed(2)}%
Profit Factor: ${profitFactor === undefined ? "N/A" : profitFactor.toFixed(2)}
Max Drawdown: ${maxDdPct === undefined ? "N/A" : `${maxDdPct.toFixed(2)}%`}
Avg PnL/Trade: ${avgPnlPct === undefined ? "N/A" : `${avgPnlPct.toFixed(2)}%`}
Total PnL: ${totalPnlPct === undefined ? "N/A" : `${totalPnlPct.toFixed(2)}%`}

### Recommendation
${score.total >= 60 ? "✅ Strategy passed threshold." : "⚠️ Strategy below threshold, revise conditions."}${parserModeNote}${warningNote}`;

  return {
    id: generateId(),
    question,
    answer,
    scores: score,
    timestamp: Date.now(),
    isExpanded: false,
  };
}
