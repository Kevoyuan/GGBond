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
  const startDrag = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch {
      // noop outside Tauri
    }
  };

  return (
    <div onMouseDown={startDrag} className="flex flex-col w-full shrink-0 z-20 relative bg-[var(--bg-primary)]">
      <div className="h-[54px] w-full flex items-center justify-end pr-4 shrink-0 relative z-10">
        <div className="flex items-center gap-4" onMouseDown={(e) => e.stopPropagation()}>
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
