import React from 'react';
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

export function Header({
  stats,
  onShowStats,
  currentBranch,
}: HeaderProps) {
  return (
    // DEBUG: 黄色边框 - Header 区域
    <div className="flex flex-col w-full shrink-0 z-20 relative bg-card drag-region border-2 border-yellow-500">
      <div className="h-[54px] w-full flex items-center justify-end pr-4 shrink-0">
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
        </div>
      </div>
    </div>
  );
}
