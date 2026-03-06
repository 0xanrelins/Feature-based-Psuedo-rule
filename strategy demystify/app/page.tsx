"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChatMessage, generateId } from "./types";
import {
  motorParse,
  motorBacktest,
  motorResultToChatMessage,
  ParsedStrategy,
  MotorResult,
} from "./services/motorService";
import ChatInput from "./components/ChatInput";
import ChatOutput from "./components/ChatOutput";
import ChatList from "./components/ChatList";

const CHAT_HISTORY_STORAGE_KEY = "sd_chat_history_v1";
const CHAT_HISTORY_LIMIT = 200;
const SYNC_STATUS_STORAGE_KEY = "sd_sync_status_v1";

function formatStrategyForConfirmation(
  strategy: ParsedStrategy,
  parserMode?: string,
  warning?: string | null
): string {
  const triggers = strategy.buy_triggers
    .map((t) => `**BUY ${t.token?.toUpperCase()}** when \`${t.condition}\``)
    .join("\n");

  const entryWindow =
    strategy.entry_window_minutes && strategy.entry_window_minutes > 0
      ? `**Entry Window:** ${strategy.entry_window_anchor === "start" ? "first" : "last"} ${strategy.entry_window_minutes} minute(s) of each session\n\n`
      : "";

  const exitOnPct = strategy.exit_on_pct_move;
  const exitLine = (() => {
    if (exitOnPct && exitOnPct > 0) {
      if (strategy.sell_condition === "market_end") {
        return `**Exit:** +${exitOnPct}% move or market_end (whichever comes first)\n\n`;
      }
      return `**Exit:** ${strategy.sell_condition} or +${exitOnPct}% move (whichever comes first; otherwise market_end)\n\n`;
    }
    if (strategy.sell_condition === "market_end") {
      return "**Exit:** market_end\n\n";
    }
    return `**Exit:** ${strategy.sell_condition} (otherwise market_end)\n\n`;
  })();

  const parserNotice = parserMode === "fallback"
    ? `\n⚠️ LLM unavailable, rule-based parser used.\n\n`
    : "";
  const warningNotice = warning ? `\n⚠️ ${warning}\n\n` : "";

  const machineForm = {
    market_type: strategy.market_type,
    time_range: strategy.time_range,
    buy_triggers: strategy.buy_triggers,
    sell_condition: strategy.sell_condition,
    entry_window_minutes: strategy.entry_window_minutes ?? null,
    entry_window_anchor: strategy.entry_window_anchor ?? null,
    exit_on_pct_move: strategy.exit_on_pct_move ?? null,
  };
  const machineBlock =
    `\n### Machine Form (Structured)\n\n` +
    "```json\n" +
    `${JSON.stringify(machineForm, null, 2)}\n` +
    "```";

  return `## 🤔 Şöyle anladım, doğru mu?\n\n` +
    parserNotice +
    warningNotice +
    `**Market:** ${strategy.market_type}\n` +
    `**Time Range:** ${strategy.time_range}\n\n` +
    `**Entry Strategy:**\n${triggers}\n\n` +
    entryWindow +
    exitLine +
    `_Onaylarsan backtest çalıştırılacak._` +
    machineBlock;
}

export default function StrategyDashboard() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatMessage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<ChatMessage | null>(null);
  const [inputText, setInputText] = useState("buy UP at 0.60 when RSI < 30 in 15m markets last 7 days");

  const [parsedStrategy, setParsedStrategy] = useState<ParsedStrategy | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string>("");
  const [clarificationBaseQuestion, setClarificationBaseQuestion] = useState<string>("");
  const [clarificationOptions, setClarificationOptions] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const storageLoadedRef = useRef(false);
  const chatPersistSkipRef = useRef(true);
  const syncPersistSkipRef = useRef(true);

  // 1) Her mount'ta (tab açıldığında / sayfa yüklendiğinde) localStorage'dan oku. Unmount'ta ref'leri sıfırla ki Strict Mode ikinci mount'ta tekrar okusun.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (storageLoadedRef.current) return;
    storageLoadedRef.current = true;
    try {
      const rawHistory = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (m: unknown) => m && typeof m === "object" && "id" in m && "question" in m && "answer" in m
          );
          setChatHistory(valid as ChatMessage[]);
        }
      }
      const rawSync = localStorage.getItem(SYNC_STATUS_STORAGE_KEY);
      if (rawSync && typeof rawSync === "string") setSyncStatus(rawSync);
    } catch (e) {
      console.warn("Storage load failed:", e);
    }
    return () => {
      storageLoadedRef.current = false;
      chatPersistSkipRef.current = true;
      syncPersistSkipRef.current = true;
    };
  }, []);

  // 2) Chat değişince yaz. İlk çalışmayı atla; boş array asla yazma.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chatPersistSkipRef.current) {
      chatPersistSkipRef.current = false;
      return;
    }
    if (chatHistory.length === 0) return;
    try {
      const trimmed = chatHistory.slice(0, CHAT_HISTORY_LIMIT);
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn("Chat persist failed:", e);
    }
  }, [chatHistory]);

  // 3) Sync mesajı değişince yaz. İlk çalışmayı atla; removeItem asla; sadece doluysa setItem.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (syncPersistSkipRef.current) {
      syncPersistSkipRef.current = false;
      return;
    }
    if (!syncStatus) return;
    try {
      localStorage.setItem(SYNC_STATUS_STORAGE_KEY, syncStatus);
    } catch (e) {
      console.warn("Sync status persist failed:", e);
    }
  }, [syncStatus]);

  const buildClarificationOptions = useCallback((message: string): string[] => {
    const lower = (message || "").toLowerCase();
    const options = new Set<string>();

    if (lower.includes("token") || lower.includes("up") || lower.includes("down")) {
      options.add("BUY UP");
      options.add("BUY DOWN");
    }
    if (lower.includes("timeframe") || lower.includes("15m") || lower.includes("1hr")) {
      options.add("15m");
      options.add("1hr");
    }
    if (lower.includes("exit") || lower.includes("sell")) {
      options.add("sell at market_end");
      options.add("sell immediately");
    }
    if (lower.includes("condition") || lower.includes("entry") || lower.includes("price")) {
      options.add("entry: price_up >= 0.70");
      options.add("entry: rsi < 30");
    }
    if (options.size === 0) {
      options.add("15m");
      options.add("BUY UP");
      options.add("entry: rsi < 30");
      options.add("sell at market_end");
    }
    return Array.from(options).slice(0, 6);
  }, []);

  const handleSubmit = useCallback(async (question: string) => {
    if (!question.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setPendingApproval(null);
    setParsedStrategy(null);
    setPendingQuestion("");
    setClarificationBaseQuestion("");
    setClarificationOptions([]);
    try {
      const parseResult = await motorParse(question);
      if (parseResult.success && parseResult.parsed_strategy) {
        const strategy = parseResult.parsed_strategy;
        const confirmChat: ChatMessage = {
          id: generateId(),
          question: question.trim(),
          answer: formatStrategyForConfirmation(
            strategy,
            parseResult.parser_mode,
            parseResult.warning ?? null
          ),
          scores: { pt: 0, pro: 0, sr: 0, card: 0, ae: 0, total: 0 },
          timestamp: Date.now(),
          isExpanded: false,
        };
        setCurrentChat(confirmChat);
        setParsedStrategy(strategy);
        setPendingQuestion(question);
        setPendingApproval(confirmChat);
      } else {
        const errorChat = motorResultToChatMessage(question, parseResult);
        setCurrentChat(errorChat);
        setPendingApproval(null);
        if ((parseResult as MotorResult).error === "unsupported_timeframe_for_local_cache") {
          setClarificationBaseQuestion(question);
          setClarificationOptions(["Use 15m"]);
        } else if ((parseResult as MotorResult).clarification_needed) {
          setClarificationBaseQuestion(question);
          setClarificationOptions(buildClarificationOptions(parseResult.message || ""));
        }
      }
    } catch (error) {
      console.error("Motor failed:", error);
      setPendingApproval(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, buildClarificationOptions]);

  const handleClarificationSelect = useCallback((selected: string) => {
    const base = clarificationBaseQuestion || inputText || "";
    const followUp =
      selected === "Use 15m"
        ? `${base}\nTimeframe: 15m`
        : `${base}\nClarification: ${selected}`;
    setInputText(followUp);
    handleSubmit(followUp);
  }, [clarificationBaseQuestion, inputText, handleSubmit]);

  const handleApprove = useCallback(async () => {
    if (!parsedStrategy || !pendingQuestion) return;
    setIsAnalyzing(true);
    try {
      const result = await motorBacktest(pendingQuestion);
      const newChat = motorResultToChatMessage(pendingQuestion, result);
      setChatHistory(prev => {
        const updated = [...prev, newChat];
        return updated.sort((a, b) => b.scores.total - a.scores.total);
      });
      setCurrentChat(newChat);
      setPendingApproval(null);
      setParsedStrategy(null);
      setPendingQuestion("");
    } catch (error) {
      console.error("Backtest failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [parsedStrategy, pendingQuestion]);

  const handleSyncData = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus("Syncing local cache...");
    try {
      const res = await fetch("/api/sync-cache", { method: "POST" });
      const data = await res.json();
      if (data?.success) {
        const stats = data?.stats || {};
        const valid = stats?.valid;
        const fetched = stats?.fetched_repaired;
        const failures = stats?.failures;
        const coverageDays = stats?.coverage_days;
        const coverageStart = stats?.coverage_start;
        const coverageEnd = stats?.coverage_end;
        const snapshotsComplete = stats?.snapshots_complete;
        const snapshotsTotal = stats?.snapshots_total;
        const unusableAfterFetch = stats?.unusable_after_fetch;
        const details = [
          coverageDays !== null && coverageDays !== undefined
            ? `coverage=${coverageDays}d${coverageStart && coverageEnd ? ` (${coverageStart}→${coverageEnd})` : ""}`
            : null,
          snapshotsComplete !== null && snapshotsComplete !== undefined && snapshotsTotal !== null && snapshotsTotal !== undefined
            ? `snapshots=${snapshotsComplete}/${snapshotsTotal}`
            : null,
          valid !== null && valid !== undefined ? `valid=${valid}` : null,
          fetched !== null && fetched !== undefined ? `fetched/repaired=${fetched}` : null,
          failures !== null && failures !== undefined ? `failures=${failures}` : null,
          unusableAfterFetch !== null && unusableAfterFetch !== undefined ? `unusable=${unusableAfterFetch}` : null,
        ].filter(Boolean).join(" | ");
        setSyncStatus(
          details
            ? `Local cache updated successfully. ${details}`
            : "Local cache updated successfully."
        );
      } else {
        const msg = data?.message || data?.error || "Sync failed";
        setSyncStatus(`Sync failed: ${msg}`);
      }
    } catch {
      setSyncStatus("Sync failed: network/server error");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const handleToggleExpand = useCallback((chatId: string) => {
    setChatHistory(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, isExpanded: !chat.isExpanded }
          : { ...chat, isExpanded: false }
      )
    );
  }, []);

  const handleSelectChat = useCallback((chat: ChatMessage) => {
    setCurrentChat(chat);
  }, []);

  return (
    <main className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      <header className="flex-none px-6 py-4 border-b border-border bg-bg-primary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary font-mono">Strategy Demystify</h1>
            <p className="text-text-secondary text-xs mt-0.5 font-mono">
              AI-powered trading strategy backtesting & scoring
            </p>
            {syncStatus && (
              <p className="text-[10px] text-text-muted font-mono mt-1">{syncStatus}</p>
            )}
          </div>
          <button
            onClick={handleSyncData}
            disabled={isSyncing}
            className="px-3 py-1.5 border border-accent-orange text-accent-orange text-[10px] font-mono uppercase tracking-wider rounded hover:bg-accent-orange hover:text-bg-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Fetch/rebuild missing or stale local cache snapshots"
          >
            {isSyncing ? "SYNCING..." : "SYNC DATA"}
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex-none">
            <ChatInput
              value={inputText}
              onChange={setInputText}
              onSubmit={handleSubmit}
              isLoading={isAnalyzing}
            />
          </div>
          <div className="flex-1 min-h-0">
            <ChatOutput
              chat={currentChat}
              isLoading={isAnalyzing}
              pendingApproval={!!pendingApproval}
              onApprove={handleApprove}
              clarificationOptions={clarificationOptions}
              onClarificationSelect={handleClarificationSelect}
            />
          </div>
        </div>

        <div className="min-h-0 h-full">
          <ChatList
            chats={chatHistory}
            onToggleExpand={handleToggleExpand}
            onSelectChat={handleSelectChat}
            currentChatId={currentChat?.id || null}
          />
        </div>
      </div>

      <footer className="flex-none px-6 py-2 border-t border-border text-center text-[10px] text-text-muted bg-bg-primary">
        <p className="font-mono">Strategy Demystify | Motor + Local Cache | 0-100 Scoring Framework</p>
      </footer>
    </main>
  );
}
