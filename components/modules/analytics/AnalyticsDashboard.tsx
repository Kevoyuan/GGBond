import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { BarChart, DollarSign, Zap, TrendingUp } from 'lucide-react';
import { fetchAnalytics } from '@/lib/api/gemini';
import { UsageMetrics, StatEntry } from '@/lib/types/gemini';

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading && !stats) {
    return (
      <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
        <div className="flex items-center justify-center h-40 text-sm text-zinc-500">Loading analytics...</div>
      </ModuleCard>
    );
  }

  if (!stats) return null;

  // Use 'total' stats for the main display, or maybe 'monthly' makes more sense for a dashboard?
  // Let's use 'total' to match the previous code's intent (metrics.estimatedCost was likely total)
  // Or 'monthly' might be more useful for "Est. Cost" context.
  // Given the previous code accessed root properties, let's look at what's available.
  // The API returns nested objects.
  
  const currentStats = stats.total || { cost: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0 };

  return (
    <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign size={14} />
              <span className="text-xs font-medium">Est. Cost (Total)</span>
            </div>
            <div className="text-xl font-bold text-foreground">${currentStats.cost?.toFixed(4) || '0.0000'}</div>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap size={14} />
              <span className="text-xs font-medium">Tokens</span>
            </div>
            <div className="text-xl font-bold text-foreground">{(currentStats.totalTokens / 1000).toFixed(1)}k</div>
            <div className="text-[10px] text-zinc-500">
              Input: {(currentStats.inputTokens / 1000).toFixed(1)}k / Output: {(currentStats.outputTokens / 1000).toFixed(1)}k
            </div>
          </div>
        </div>

        {/* Chart - Daily Usage */}
        {/* The API doesn't return a daily array history yet, it returns aggregated stats. 
            The previous code expected `metrics.dailyUsage` array.
            The current API returns `daily` as a single StatEntry (today's stats).
            To support a chart, we'd need the API to return history.
            For now, let's show Today vs This Week vs Month vs Total simple bars or just text.
            Or we can just show the stats we have.
        */}
        <div className="space-y-2">
           <div className="flex justify-between items-center">
            <h4 className="text-xs font-semibold text-muted-foreground">Period Breakdown</h4>
          </div>
          
          <div className="space-y-2">
            <PeriodRow label="Today" stat={stats.daily} maxTokens={stats.total.totalTokens} />
            <PeriodRow label="This Week" stat={stats.weekly} maxTokens={stats.total.totalTokens} />
            <PeriodRow label="This Month" stat={stats.monthly} maxTokens={stats.total.totalTokens} />
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}

function PeriodRow({ label, stat, maxTokens }: { label: string, stat: StatEntry, maxTokens: number }) {
    if (!stat) return null;
    const percentage = maxTokens > 0 ? (stat.totalTokens / maxTokens) * 100 : 0;
    
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{stat.totalTokens.toLocaleString()} tk</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(percentage, 1)}%` }} />
            </div>
             <div className="flex justify-between text-[10px] text-zinc-400">
                <span>${stat.cost.toFixed(4)}</span>
                <span>{stat.count} reqs</span>
            </div>
        </div>
    )
}
