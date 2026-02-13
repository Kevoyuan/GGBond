'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { CheckCircle2, XCircle, Clock, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';

interface ToolStatsData {
  toolName: string;
  success: number;
  failed: number;
  total: number;
  successRate: number;
  avgDurationMs: number;
}

export function ToolStatsPanel() {
  const [stats, setStats] = useState<ToolStatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/analytics/tool-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data.tools || []);
      })
      .catch(err => {
        console.error('Failed to load tool stats:', err);
        setError('Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      </ModuleCard>
    );
  }

  if (error) {
    return (
      <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
        <div className="text-center py-8 text-muted-foreground text-sm">
          <AlertTriangle size={16} className="mx-auto mb-2" />
          {error}
        </div>
      </ModuleCard>
    );
  }

  if (stats.length === 0) {
    return (
      <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
        <div className="text-center py-8 text-muted-foreground text-sm">
          No tool execution data yet
        </div>
      </ModuleCard>
    );
  }

  const totalExecutions = stats.reduce((sum, t) => sum + t.total, 0);
  const totalSuccesses = stats.reduce((sum, t) => sum + t.success, 0);
  const overallSuccessRate = totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0;

  return (
    <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
      <div className="space-y-3">
        {/* Overall stats */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-sm font-medium">Overall Success Rate</span>
          </div>
          <span className={`text-lg font-bold ${overallSuccessRate >= 90 ? 'text-emerald-500' : overallSuccessRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
            {overallSuccessRate.toFixed(1)}%
          </span>
        </div>

        {/* Tool list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {stats.slice(0, 10).map((tool) => (
            <div
              key={tool.toolName}
              className="p-2 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate flex-1" title={tool.toolName}>
                  {tool.toolName}
                </span>
                <span className={`text-sm font-semibold ${
                  tool.successRate >= 90 ? 'text-emerald-500' :
                  tool.successRate >= 70 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {tool.successRate.toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  <span>{tool.success}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle size={12} className="text-red-500" />
                  <span>{tool.failed}</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <Clock size={12} />
                  <span>{tool.avgDurationMs}ms</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${tool.successRate}%` }}
                  />
                  <div
                    className="bg-red-500"
                    style={{ width: `${100 - tool.successRate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {stats.length > 10 && (
          <div className="text-xs text-muted-foreground text-center">
            +{stats.length - 10} more tools
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
