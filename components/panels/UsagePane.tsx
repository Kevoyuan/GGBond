'use client';

import React, { Suspense, lazy, memo } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';

const AnalyticsDashboard = lazy(() => import('@/components/modules/analytics/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const NerdStatsPanel = lazy(() => import('@/components/modules/analytics/NerdStatsPanel').then(m => ({ default: m.NerdStatsPanel })));
const PerformancePanel = lazy(() => import('@/components/modules/analytics/PerformancePanel').then(m => ({ default: m.PerformancePanel })));
const ToolStatsPanel = lazy(() => import('@/components/modules/analytics/ToolStatsPanel').then(m => ({ default: m.ToolStatsPanel })));
const FileHeatmapPanel = lazy(() => import('@/components/modules/analytics/FileHeatmapPanel').then(m => ({ default: m.FileHeatmapPanel })));

const ModuleLoader = memo(function ModuleLoader() {
  return (
    <div className="flex items-center justify-center py-12 border border-dashed rounded-lg bg-muted/5">
      <Loader2 size={20} className="animate-spin text-primary/40" />
    </div>
  );
});

interface UsagePaneProps {
  currentSessionId?: string | null;
}

export const UsagePane = memo(function UsagePane({ currentSessionId }: UsagePaneProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/40 shrink-0 bg-gradient-to-b from-muted/[0.03] to-transparent flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-subtle)]">
          <TrendingUp className="h-3 w-3 text-[var(--accent)]" />
        </div>
        Usage & Analytics
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        <Suspense fallback={<ModuleLoader />}>
          <div className="space-y-5">
            <NerdStatsPanel currentSessionId={currentSessionId} />
            <AnalyticsDashboard />
            <PerformancePanel />
            <ToolStatsPanel />
            <FileHeatmapPanel />
          </div>
        </Suspense>
      </div>
    </div>
  );
});
