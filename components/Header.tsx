import React from 'react';
import { Zap, Coins } from 'lucide-react';

interface HeaderProps {
  stats?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
  };
  onShowStats?: () => void;
}

export function Header({ stats, onShowStats }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 z-20 relative">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-lg tracking-tight">Gemini Chat</span>
      </div>

      <div className="flex items-center gap-4">
        {stats && stats.totalTokens > 0 && (
          <button
            onClick={onShowStats}
            className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/40 hover:bg-muted/60 hover:border-border/60 hover:text-foreground transition-all cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-1.5" title="Total Tokens">
              <Zap className="w-3.5 h-3.5" />
              <span className="font-medium">{stats.totalTokens.toLocaleString()}</span>
            </div>

            <span className="w-px h-3 bg-border" />

            <div className="flex items-center gap-1.5" title="Total Cost">
              <Coins className="w-3.5 h-3.5" />
              <span className="font-medium">${stats.totalCost.toFixed(4)}</span>
            </div>
          </button>
        )}

        {/* Mode control moved to ChatInput toolbar */}
      </div>
    </header>
  );
}
