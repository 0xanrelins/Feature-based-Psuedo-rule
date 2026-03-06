"use client";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ value, onChange, onSubmit, isLoading }: ChatInputProps) {
  const handleSubmit = () => {
    if (value.trim() && !isLoading) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-bg-panel border border-border rounded-xl overflow-hidden">
      {/* Panel Header - Compact */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] text-accent-orange font-mono uppercase tracking-wider">
          Ask AI
        </span>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-accent-yellow animate-pulse' : 'bg-accent-green'}`}></div>
          <span className="text-[9px] text-text-muted font-mono">
            {isLoading ? 'Analyzing' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Input Area - Compact */}
      <div className="p-3">
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="w-full bg-bg-secondary border border-border rounded-lg p-3 pr-16 text-text-primary font-mono text-sm resize-none outline-none focus:border-accent-orange transition-colors min-h-[60px] disabled:opacity-50"
            placeholder="Ask about a trading strategy..."
            rows={2}
          />
          
          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !value.trim()}
            className="absolute top-2 right-2 px-3 py-1 bg-accent-orange/10 border border-accent-orange text-accent-orange text-[10px] font-mono uppercase tracking-wider rounded hover:bg-accent-orange hover:text-bg-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-1 bg-accent-orange rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-accent-orange rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-1 h-1 bg-accent-orange rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              </span>
            ) : (
              'RUN'
            )}
          </button>
        </div>

        {/* Helper text - Compact */}
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-text-muted text-[10px] font-mono">
            AI strategy analysis with 0-100 scoring
          </p>
          <p className="text-[9px] text-text-muted/50 font-mono">
            Enter ↵
          </p>
        </div>
      </div>
    </div>
  );
}
