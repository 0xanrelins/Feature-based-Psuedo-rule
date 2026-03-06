"use client";

import { ChatMessage, getScoreRating } from "../types";
import ScoreTable from "./ScoreTable";

interface ChatOutputProps {
  chat: ChatMessage | null;
  isLoading?: boolean;
  pendingApproval?: boolean;
  onApprove?: () => void;
  clarificationOptions?: string[];
  onClarificationSelect?: (selected: string) => void;
}

export default function ChatOutput({
  chat,
  isLoading = false,
  pendingApproval = false,
  onApprove,
  clarificationOptions = [],
  onClarificationSelect,
}: ChatOutputProps) {
  const hasClarificationOptions = !pendingApproval && clarificationOptions.length > 0 && !!onClarificationSelect;

  if (isLoading) {
    return (
      <div className="bg-bg-panel border border-border rounded-xl overflow-hidden h-full flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-none">
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            AI Analysis
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-yellow animate-pulse"></div>
            <span className="text-[10px] text-accent-yellow font-mono">Analyzing...</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-accent-orange rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-accent-orange rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-accent-orange rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-text-secondary font-mono text-sm">Processing strategy parameters...</p>
          <p className="text-text-muted font-mono text-xs mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="bg-bg-panel border border-border rounded-xl overflow-hidden h-full flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-none">
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            AI Analysis
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-text-muted"></div>
            <span className="text-[10px] text-text-muted font-mono">Waiting</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-text-muted font-mono text-sm mb-2">
              <span className="text-accent-green">➜</span> Waiting for input...
            </p>
            <p className="text-text-secondary font-mono text-xs">
              Ask a strategy question to get AI analysis
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { question, answer, scores, timestamp } = chat;
  const rating = getScoreRating(scores.total);
  const showScoring = !pendingApproval && !hasClarificationOptions;

  const lines = answer.split('\n');
  const summaryStart = lines.findIndex(l => l.includes('### Summary'));
  const riskStart = lines.findIndex(l => l.includes('### Risk Assessment'));
  const recStart = lines.findIndex(l => l.includes('### Recommendation'));

  const summary =
    summaryStart >= 0 && riskStart > summaryStart
      ? lines.slice(summaryStart + 1, riskStart).filter(l => l.trim()).join('\n')
      : '';
  const riskSection =
    riskStart >= 0 && recStart > riskStart
      ? lines.slice(riskStart + 1, recStart).filter(l => l.trim()).join('\n')
      : '';

  return (
    <div className="bg-bg-panel border border-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-none">
        <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
          AI Analysis
        </span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green"></div>
          <span className="text-[10px] text-text-muted font-mono">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="mb-3 p-2.5 bg-bg-secondary/50 rounded-lg border border-border/50">
          <span className="text-[10px] text-text-muted font-mono uppercase">Question</span>
          <p className="text-text-primary font-mono text-sm mt-1 leading-relaxed">{question}</p>
        </div>

        {showScoring && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <div className="text-2xl font-bold font-mono">
                <span className={rating.color}>{scores.total}</span>
                <span className="text-text-muted text-base">/100</span>
              </div>
              <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-bg-secondary ${rating.color}`}>
                {rating.icon} {rating.label}
              </div>
            </div>
            <div className="mb-3">
              <ScoreTable scores={scores} />
            </div>
          </>
        )}

        {summary && (
          <div className="mb-3">
            <h3 className="text-[10px] text-accent-orange font-mono uppercase tracking-wider mb-1.5">
              Summary
            </h3>
            <div className="text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
          </div>
        )}

        {riskSection && (
          <div className="mb-3">
            <h3 className="text-[10px] text-accent-orange font-mono uppercase tracking-wider mb-1.5">
              Risk Assessment
            </h3>
            <div className="text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
              {riskSection}
            </div>
          </div>
        )}

        <div className="mb-3">
          <h3 className="text-[10px] text-accent-orange font-mono uppercase tracking-wider mb-1.5">
            Details
          </h3>
          <div className="text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">
            {answer}
          </div>
        </div>

        {pendingApproval && (
          <div className="p-2.5 rounded-lg border border-accent-green/30 bg-accent-green/5">
            <p className="text-xs font-mono font-semibold text-accent-green mb-2">
              Onay verirsen backtest calisacak.
            </p>
            <button
              onClick={onApprove}
              className="px-3 py-1.5 border border-accent-green text-accent-green text-[10px] font-mono uppercase tracking-wider rounded hover:bg-accent-green hover:text-bg-primary transition-all"
            >
              APPROVE & RUN BACKTEST
            </button>
          </div>
        )}

        {hasClarificationOptions && (
          <div className="p-2.5 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5">
            <p className="text-xs font-mono font-semibold text-accent-yellow mb-2">
              Clarification needed. Quick options:
            </p>
            <div className="flex flex-wrap gap-2">
              {clarificationOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onClarificationSelect?.(opt)}
                  className="px-2 py-1 border border-accent-yellow text-accent-yellow text-[10px] font-mono rounded hover:bg-accent-yellow hover:text-bg-primary transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {showScoring && (
          <div className={`p-2.5 rounded-lg border ${scores.total >= 60 ? 'border-accent-green/30 bg-accent-green/5' : 'border-accent-yellow/30 bg-accent-yellow/5'}`}>
            <p className={`text-xs font-mono font-semibold ${scores.total >= 60 ? 'text-accent-green' : 'text-accent-yellow'}`}>
              {scores.total >= 60 ? '✓ APPROVED' : '⚠ CAUTION'}
              <span className="text-text-secondary font-normal ml-2">
                {scores.total >= 60
                  ? 'Suitable for implementation with specified risk controls.'
                  : 'Requires further optimization before live trading.'}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
