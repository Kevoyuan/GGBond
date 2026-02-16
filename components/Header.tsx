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
    <div className="flex flex-col w-full shrink-0 z-20 relative bg-card">
      <div className="h-[54px] w-full flex items-center justify-end px-4 drag-region shrink-0">
        <div className="flex items-center gap-4 no-drag">
          <GitBranchTag branch={currentBranch ?? null} />

          {stats && (
            <TokenUsageDisplay
              stats={stats}
              compact={true}
              floating={true}
              className="mr-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}
