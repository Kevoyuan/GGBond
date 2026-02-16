import React from 'react';
import { Zap, Coins } from 'lucide-react';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { GitBranchTag } from './GitBranchTag';

interface HeaderProps {
  stats?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
  };
  onShowStats?: () => void;
  currentBranch?: string | null;
}

export function Header({ stats, onShowStats, currentBranch }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 z-20 relative w-full drag-region">
      <div className="flex items-center gap-4">
        {/* Title removed */}
      </div>

      <div className="flex items-center gap-4">
        <GitBranchTag branch={currentBranch ?? null} />

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
