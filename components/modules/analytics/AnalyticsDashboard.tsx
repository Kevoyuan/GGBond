'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { BarChart, DollarSign, Zap, TrendingUp, Loader2 } from 'lucide-react';

interface StatEntry {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  cost: number;
  count: number;
}

interface UsageStats {
  daily: StatEntry;
  weekly: StatEntry;
  monthly: StatEntry;
  total: StatEntry;
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      </ModuleCard>
    );
  }

  const current = stats?.[period] || { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, count: 0 };
  const total = stats?.total || current;

  return (
    <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
      <div className="space-y-5">
        {/* Period Selector */}
        <div className="flex gap-1">
          {(['daily', 'weekly', 'monthly'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${p === period
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
            >
              {p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign size={14} />
              <span className="text-xs font-medium">Est. Cost</span>
            </div>
            <div className="text-xl font-bold text-foreground">${current.cost.toFixed(4)}</div>
            <div className="text-[10px] text-muted-foreground">{current.count} requests</div>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap size={14} />
              <span className="text-xs font-medium">Tokens</span>
            </div>
            <div className="text-xl font-bold text-foreground">
              {current.totalTokens >= 1_000_000
                ? `${(current.totalTokens / 1_000_000).toFixed(1)}M`
                : current.totalTokens >= 1_000
                  ? `${(current.totalTokens / 1_000).toFixed(0)}k`
                  : current.totalTokens}
            </div>
            <div className="text-[10px] text-muted-foreground">
              In: {(current.inputTokens / 1000).toFixed(0)}k / Out: {(current.outputTokens / 1000).toFixed(0)}k
            </div>
          </div>
        </div>

        {/* Breakdown Bar */}
        {current.totalTokens > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Token Distribution</h4>
            <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${(current.inputTokens / current.totalTokens) * 100}%` }}
                title={`Input: ${current.inputTokens.toLocaleString()}`}
              />
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(current.outputTokens / current.totalTokens) * 100}%` }}
                title={`Output: ${current.outputTokens.toLocaleString()}`}
              />
              {current.cachedTokens > 0 && (
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(current.cachedTokens / current.totalTokens) * 100}%` }}
                  title={`Cached: ${current.cachedTokens.toLocaleString()}`}
                />
              )}
            </div>
            <div className="flex gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Input</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Output</span>
              {current.cachedTokens > 0 && (
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Cached</span>
              )}
            </div>
          </div>
        )}

        {/* Total Stats */}
        <div className="pt-3 border-t border-border grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-foreground">${total.cost.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">Total Cost</div>
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">
              {total.totalTokens >= 1_000_000 ? `${(total.totalTokens / 1_000_000).toFixed(1)}M` : `${(total.totalTokens / 1_000).toFixed(0)}k`}
            </div>
            <div className="text-[10px] text-muted-foreground">Total Tokens</div>
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">{total.count}</div>
            <div className="text-[10px] text-muted-foreground">Total Requests</div>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
