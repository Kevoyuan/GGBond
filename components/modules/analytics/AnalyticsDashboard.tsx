import React from 'react';
import { ModuleCard } from '../ModuleCard';
import { BarChart, DollarSign, Zap, TrendingUp } from 'lucide-react';
import { mockMetrics } from '@/lib/api/gemini-mock';

export function AnalyticsDashboard() {
  const metrics = mockMetrics;

  return (
    <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign size={14} />
              <span className="text-xs font-medium">Est. Cost</span>
            </div>
            <div className="text-xl font-bold text-foreground">${metrics.estimatedCost.toFixed(2)}</div>
            <div className="text-[10px] text-green-600 flex items-center gap-0.5">
              <TrendingUp size={10} /> +12% vs last week
            </div>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap size={14} />
              <span className="text-xs font-medium">Tokens</span>
            </div>
            <div className="text-xl font-bold text-foreground">{(metrics.totalTokens / 1000).toFixed(0)}k</div>
            <div className="text-[10px] text-zinc-500">
              Input: {(metrics.inputTokens / 1000).toFixed(0)}k / Output: {(metrics.outputTokens / 1000).toFixed(0)}k
            </div>
          </div>
        </div>

        {/* Mock Chart */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-semibold text-muted-foreground">Daily Usage (Tokens)</h4>
            <div className="flex gap-1">
              {['1D', '1W', '1M'].map(p => (
                <button key={p} className={`px-2 py-0.5 text-[10px] rounded ${p === '1W' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-32 flex items-end gap-1 pt-4 pb-2">
            {metrics.dailyUsage.map((day, i) => {
              const max = Math.max(...metrics.dailyUsage.map(d => d.tokens));
              const h = (day.tokens / max) * 100;
              
              return (
                <div key={i} className="flex-1 flex flex-col justify-end gap-1 group">
                  <div 
                    className="w-full bg-blue-500/20 group-hover:bg-blue-500/40 rounded-t-sm transition-all relative" 
                    style={{ height: `${h}%` }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-popover text-popover-foreground text-[10px] rounded shadow opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                      {day.tokens} tk
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            {metrics.dailyUsage.map(d => (
              <span key={d.date}>{d.date}</span>
            ))}
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
