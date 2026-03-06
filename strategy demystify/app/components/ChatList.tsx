"use client";

import { ChatMessage, formatTimeAgo, getScoreRating } from "../types";
import ScoreTable from "./ScoreTable";

interface ChatListProps {
  chats: ChatMessage[];
  onToggleExpand: (chatId: string) => void;
  onSelectChat: (chat: ChatMessage) => void;
  currentChatId: string | null;
}

interface ChatListItemProps {
  chat: ChatMessage;
  onToggleExpand: (chatId: string) => void;
  onSelectChat: (chat: ChatMessage) => void;
  isSelected: boolean;
  rank: number;
}

function ChatListItem({ chat, onToggleExpand, onSelectChat, isSelected, rank }: ChatListItemProps) {
  const rating = getScoreRating(chat.scores.total);
  const timeAgo = formatTimeAgo(chat.timestamp);
  
  // Truncate question for preview
  const preview = chat.question.length > 40 
    ? chat.question.substring(0, 40) + "..." 
    : chat.question;

  const handleClick = () => {
    onSelectChat(chat);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(chat.id);
  };

  return (
    <div 
      className={`border-b border-border/50 transition-all duration-200 ${
        isSelected ? 'bg-accent-orange/5' : 'hover:bg-bg-secondary/30'
      }`}
    >
      {/* Main Row - Always Visible */}
      <div 
        onClick={handleClick}
        className="px-3 py-2.5 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          {/* Rank + Question */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="text-[10px] text-text-muted font-mono w-4 shrink-0 pt-0.5">
              #{rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-text-primary truncate leading-snug">
                {preview}
              </p>
              <p className="text-[9px] text-text-muted font-mono mt-0.5">
                {timeAgo}
              </p>
            </div>
          </div>

          {/* Total Score + Expand Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`text-base font-mono font-bold ${rating.color}`}>
              {chat.scores.total}
            </div>
            <button
              onClick={handleExpandClick}
              className="p-0.5 hover:bg-border/50 rounded transition-colors"
            >
              <svg 
                className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${chat.isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-out ${
          chat.isExpanded ? 'max-h-[250px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-2.5 pt-1 border-t border-border/30">
          {/* Full Question */}
          <div className="mb-2">
            <span className="text-[9px] text-accent-orange font-mono uppercase">Question</span>
            <p className="text-[10px] font-mono text-text-secondary mt-0.5 leading-relaxed">{chat.question}</p>
          </div>

          {/* Compact Score Table */}
          <div className="mb-2">
            <ScoreTable scores={chat.scores} compact />
          </div>

          {/* View Full Button */}
          <button 
            onClick={handleClick}
            className="text-[9px] text-accent-orange font-mono hover:text-accent-orange-hover transition-colors"
          >
            View full analysis →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatList({ 
  chats, 
  onToggleExpand, 
  onSelectChat,
  currentChatId 
}: ChatListProps) {
  const hasChats = chats.length > 0;

  return (
    <div className="bg-bg-panel border border-border rounded-xl overflow-hidden h-full flex flex-col">
      {/* Header - Compact */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-bg-panel flex-none">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-accent-orange font-mono uppercase tracking-wider">
            Rankings
          </span>
          <span className="text-[9px] text-text-muted font-mono">
            (by Score)
          </span>
        </div>
        <span className="text-[10px] text-text-muted font-mono">
          {chats.length}
        </span>
      </div>

      {/* List Content - Fills remaining space */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {hasChats ? (
          <div>
            {chats.map((chat, index) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                onToggleExpand={onToggleExpand}
                onSelectChat={onSelectChat}
                isSelected={chat.id === currentChatId}
                rank={index + 1}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 border-2 border-border rounded-full flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-xs text-text-secondary font-mono mb-0.5">
              No strategies yet
            </p>
            <p className="text-[10px] text-text-muted font-mono">
              Ask your first question
            </p>
          </div>
        )}
      </div>

      {/* Footer with Legend - Compact */}
      {hasChats && (
        <div className="px-3 py-1.5 border-t border-border flex items-center justify-between text-[9px] font-mono flex-none">
          <div className="flex items-center gap-2">
            <span className="text-accent-green">●70+</span>
            <span className="text-accent-yellow">●50</span>
            <span className="text-accent-red">●&lt;50</span>
          </div>
          <span className="text-text-muted/70">High→Low</span>
        </div>
      )}
    </div>
  );
}
