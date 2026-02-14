import React from 'react';
import { Zap, Coins } from 'lucide-react';
import { TokenUsageDisplay } from './TokenUsageDisplay';

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
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 z-20 relative w-full">
      <div className="flex items-center gap-4">
        {/* Title removed */}
      </div>

      <div className="flex items-center gap-4">
        {stats && (
          <TokenUsageDisplay
            stats={stats}
            compact={true}
            floating={true}
            className="mr-2"
          />
        )}

        {/* Mode control moved to ChatInput toolbar */}
      </div>
    </header>
  );
}
