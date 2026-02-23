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
    <div className="flex flex-col w-full shrink-0 z-20 relative bg-card">
      <div data-tauri-drag-region className="absolute inset-0 z-0" />
      <div className="h-[54px] w-full flex items-center justify-end pr-4 shrink-0 relative z-10 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <GitBranchTag branch={currentBranch ?? null} />

          {stats && (
            <TokenUsageDisplay
              stats={stats}
              compact={true}
              floating={true}
              label="Session"
              hideContextPercentage={true}
              className="mr-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}
