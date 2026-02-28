'use client';

import React, { useEffect, useRef, useState, memo, useMemo, useCallback } from 'react';
import { ModuleCard } from '../ModuleCard';
import { BarChart, DollarSign, Zap, Loader2, Gauge, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { getModelInfo } from '@/lib/pricing';
import { format, subMonths } from 'date-fns';

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
  breakdowns?: {
    todayHourly: Array<{
      key: string;
      label: string;
      totalTokens: number;
      models: Record<string, number>;
    }>;
    weekDaily: Array<{
      key: string;
      label: string;
      totalTokens: number;
      models: Record<string, number>;
    }>;
    monthDaily: Array<{
      key: string;
      label: string;
      totalTokens: number;
      models: Record<string, number>;
    }>;
  };
}

interface TelemetryResponse {
  recentEvents: Array<{
    name: string;
    timestamp?: string;
    attributes: Record<string, unknown>;
  }>;
  tokensByModel: Record<string, { input: number; output: number; cached: number; thoughts: number }>;
}

function readNumericValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatCompactTokens(value: number): string {
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

interface TimelineHoverState {
  x: number;
  y: number;
  label: string;
  total: number;
  rows: Array<{ model: string; tokens: number; color: string }>;
}

interface TokenTimelineBucket {
  key: string;
  label: string;
  totalTokens: number;
  models: Record<string, number>;
}

const TokenTimelineChart = memo(function TokenTimelineChart({
  buckets,
  period,
  timelineModeLabel,
  maxToken,
  chartModels,
  primaryModels,
  modelColorMap,
  formatCompactTokens,
  chartHeightPx = 140,
  shouldRenderDenseLabels
}: {
  buckets: TokenTimelineBucket[];
  period: string;
  timelineModeLabel: string;
  maxToken: number;
  chartModels: string[];
  primaryModels: string[];
  modelColorMap: Map<string, string>;
  formatCompactTokens: (v: number) => string;
  chartHeightPx?: number;
  shouldRenderDenseLabels: boolean;
}) {
  const [hover, setHover] = useState<TimelineHoverState | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = Math.max(e.clientY - rect.top, 0);

    // Find closest bucket based on cursor X
    // Simple approximation: check which column element includes x
    // But since we are rendering flex columns, we can just rely on the column's onMouseMove 
    // However, to avoid individual listeners, we can do global calculation or keep the per-column
    // logic but ensure it doesn't cause parent re-renders suitable for the chart only.
    // The current implementation uses per-column onMouseMove, which is fine if THIS component is isolated.
  }, []);

  if (buckets.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Token Timeline (Stacked by Model)</h4>
        <span className="text-[10px] px-2 py-1 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-800/50 text-zinc-500 backdrop-blur-sm">
          {timelineModeLabel}
        </span>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-dashed border-zinc-200 dark:border-zinc-800" />
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 text-[10px] text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-1 rounded z-10 backdrop-blur-sm">
          {formatCompactTokens(maxToken)}
        </div>

        <div
          ref={chartRef}
          className="relative flex h-52 items-end gap-1 overflow-x-auto pb-1 scrollbar-none"
          onMouseLeave={() => setHover(null)}
        >
          {buckets.map((bucket, index) => {
            const othersValue = Object.entries(bucket.models || {}).reduce((sum: number, [model, value]: [string, number]) => {
              if (primaryModels.includes(model)) return sum;
              return sum + value;
            }, 0);

            const normalizedModels = chartModels
              .map((model) => ({
                model,
                tokens: model === 'Others' ? othersValue : (bucket.models?.[model] || 0),
              }))
              .filter((item) => item.tokens > 0);

            const columnHeightPx = bucket.totalTokens > 0
              ? Math.max((bucket.totalTokens / maxToken) * chartHeightPx, 6)
              : 2;

            const tooltipRows = normalizedModels
              .sort((a, b) => b.tokens - a.tokens)
              .map((item) => ({
                model: item.model,
                tokens: item.tokens,
                color: modelColorMap.get(item.model) || '#6b7280',
              }));

            const showLabel = period === 'daily' // is today
              ? index % 2 === 0
              : shouldRenderDenseLabels
                ? (index === 0 || index === buckets.length - 1 || index % 3 === 0)
                : true;

            return (
              <div key={bucket.key} className="group relative flex min-w-[18px] flex-1 flex-col items-center justify-end gap-2">
                <div
                  className="relative flex w-full max-w-[32px] flex-col justify-end overflow-hidden rounded-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 transition-[box-shadow,transform] duration-200 hover:ring-2 hover:ring-primary/50 cursor-crosshair hover:scale-[1.02] will-change-transform"
                  style={{ height: `${columnHeightPx}px` }}
                  onMouseMove={(event) => {
                    if (!chartRef.current) return;
                    const rect = chartRef.current.getBoundingClientRect();
                    setHover({
                      x: event.clientX - rect.left,
                      y: Math.max(event.clientY - rect.top, 0),
                      label: bucket.label,
                      total: bucket.totalTokens,
                      rows: tooltipRows,
                    });
                  }}
                >
                  <div className="absolute inset-0 bg-zinc-200/40 dark:bg-zinc-800/40" />
                  {normalizedModels.map((item) => {
                    const pct = bucket.totalTokens > 0 ? (item.tokens / bucket.totalTokens) * 100 : 0;
                    return (
                      <div
                        key={`${bucket.key}-${item.model}`}
                        style={{
                          height: `${Math.max(pct, 2)}%`,
                          backgroundColor: modelColorMap.get(item.model),
                        }}
                      />
                    );
                  })}
                </div>
                {showLabel ? (
                  <span className="text-[9px] text-zinc-400 font-mono tracking-tight">{bucket.label}</span>
                ) : (
                  <span className="h-3 text-[9px] text-transparent">.</span>
                )}
              </div>
            );
          })}

          {hover && (
            <div
              className="pointer-events-none absolute z-50 w-56 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 p-3 shadow-xl backdrop-blur-md"
              style={{
                left: `${hover.x}px`,
                top: `${Math.max(hover.y - 10, 8)}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{hover.label}</span>
                <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                  {formatCompactTokens(hover.total)}
                </span>
              </div>
              <div className="space-y-1">
                {hover.rows.slice(0, 6).map((row) => (
                  <div key={row.model} className="flex items-center justify-between text-[10px]">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-500">
                      <span className="h-2 w-2 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: row.color }} />
                      <span className="truncate max-w-[100px]">{row.model}</span>
                    </span>
                    <span className="tabular-nums font-mono text-zinc-700 dark:text-zinc-300">{formatCompactTokens(row.tokens)}</span>
                  </div>
                ))}
                {hover.rows.length > 6 && (
                  <div className="text-[10px] text-zinc-400 italic pl-3.5">+{hover.rows.length - 6} more models</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const AnalyticsDashboard = memo(function AnalyticsDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [monthOffset, setMonthOffset] = useState<number>(0);

  // Stable fetch function
  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/stats?offset=${monthOffset}`).then(r => r.json()),
      fetch('/api/telemetry').then(r => r.json()),
    ])
      .then(([statsRes, telemetryRes]) => {
        setStats(statsRes);
        setTelemetry(telemetryRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [monthOffset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoized expensive computations (must be called unconditionally)
  const current = useMemo(() => stats?.[period] || { inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, count: 0 }, [stats, period]);
  const total = useMemo(() => stats?.total || current, [stats, current]);

  const tokenSeries = useMemo(() => (telemetry?.recentEvents || [])
    .filter((event) => event.name === 'gemini_cli.api_response')
    .slice(-12)
    .map((event) => {
      const input = readNumericValue(event.attributes.input_token_count);
      const output = readNumericValue(event.attributes.output_token_count);
      const totalValue = readNumericValue(event.attributes.total_token_count) || (input + output);
      return { total: totalValue, input, output };
    }), [telemetry]);

  const maxSeriesToken = useMemo(() => tokenSeries.length > 0 ? Math.max(...tokenSeries.map(item => item.total), 1) : 1, [tokenSeries]);

  const dominantModel = useMemo(() => Object.entries(telemetry?.tokensByModel || {}).sort((a, b) => {
    const totalA = a[1].input + a[1].output;
    const totalB = b[1].input + b[1].output;
    return totalB - totalA;
  })[0]?.[0] || 'gemini-3-pro', [telemetry]);

  const { pricing } = useMemo(() => getModelInfo(dominantModel), [dominantModel]);
  const cumulativeTokens = useMemo(() => current.totalTokens, [current]);
  const contextUsagePercent = useMemo(() => Math.min((cumulativeTokens / pricing.contextWindow) * 100, 100), [cumulativeTokens, pricing]);
  const cacheHitRate = useMemo(() => current.inputTokens > 0 ? (current.cachedTokens / current.inputTokens) * 100 : 0, [current]);
  const avgCostPerRequest = useMemo(() => current.count > 0 ? current.cost / current.count : 0, [current]);
  const costPer1k = useMemo(() => current.totalTokens > 0 ? (current.cost / current.totalTokens) * 1000 : 0, [current]);

  const timelinePeriod = useMemo<'today' | 'week' | 'month'>(() => period === 'daily' ? 'today' : period === 'weekly' ? 'week' : 'month', [period]);
  const timelineModeLabel = useMemo(() => timelinePeriod === 'today' ? 'Hourly View' : 'Daily View', [timelinePeriod]);

  const timelineBuckets = useMemo(() => timelinePeriod === 'today'
    ? (stats?.breakdowns?.todayHourly || [])
    : timelinePeriod === 'week'
      ? (stats?.breakdowns?.weekDaily || [])
      : (stats?.breakdowns?.monthDaily || []), [stats, timelinePeriod]);

  const modelTotals = useMemo(() => timelineBuckets.reduce<Record<string, number>>((acc, bucket) => {
    Object.entries(bucket.models || {}).forEach(([model, tokens]) => {
      acc[model] = (acc[model] || 0) + tokens;
    });
    return acc;
  }, {}), [timelineBuckets]);

  const orderedModels = useMemo(() => Object.entries(modelTotals).sort((a, b) => b[1] - a[1]).map(([name]) => name), [modelTotals]);
  const primaryModels = useMemo(() => orderedModels.slice(0, 8), [orderedModels]);
  const useOthers = useMemo(() => orderedModels.length > primaryModels.length, [orderedModels, primaryModels]);
  const chartModels = useMemo(() => useOthers ? [...primaryModels, 'Others'] : primaryModels, [useOthers, primaryModels]);
  const maxTimelineToken = useMemo(() => timelineBuckets.length > 0 ? Math.max(...timelineBuckets.map(bucket => bucket.totalTokens), 1) : 1, [timelineBuckets]);

  const modelColors = useMemo(() => [
    '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#22c55e', '#a855f7', '#06b6d4', '#eab308', '#6b7280',
  ], []);

  const modelColorMap = useMemo(() => {
    const map = new Map<string, string>();
    chartModels.forEach((model, idx) => map.set(model, modelColors[idx % modelColors.length]));
    return map;
  }, [chartModels, modelColors]);

  const timelineGrandTotal = useMemo(() => Object.values(modelTotals).reduce((sum, value) => sum + value, 0), [modelTotals]);
  const topModelsTotal = useMemo(() => primaryModels.reduce((sum, model) => sum + (modelTotals[model] || 0), 0), [primaryModels, modelTotals]);
  const othersTotal = useMemo(() => Math.max(timelineGrandTotal - topModelsTotal, 0), [timelineGrandTotal, topModelsTotal]);
  const shouldRenderDenseLabels = timelinePeriod === 'month';

  // Loading state
  if (loading) {
    return (
      <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
        <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-3">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Loading Data...</span>
        </div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="Analytics" description="Usage & Cost Tracking" icon={BarChart}>
      <div className="space-y-6">
        <div className="flex justify-between items-center w-full">
          {/* Period Selector */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg w-max relative">
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 z-10 ${p === period
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
              >
                <span className="relative z-10">{p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : 'This Month'}</span>
                {p === period && (
                  <div className="absolute inset-0 bg-zinc-900 dark:bg-zinc-600 rounded-md shadow-sm" />
                )}
              </button>
            ))}
          </div>

          {/* Historic Data Navigation (Visible only in monthly view) */}
          {period === 'monthly' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthOffset(prev => prev + 1)}
                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-mono text-zinc-500 min-w-[60px] text-center">
                {format(subMonths(new Date(), monthOffset), 'MMM yyyy')}
              </span>
              <button
                onClick={() => setMonthOffset(prev => Math.max(0, prev - 1))}
                disabled={monthOffset === 0}
                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="group p-4 bg-white/50 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 transition-[border-color,box-shadow] duration-300">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <div className="p-1.5 bg-green-500/10 rounded text-green-600 dark:text-green-400">
                <DollarSign size={14} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider">Est. Cost</span>
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight">${current.cost.toFixed(4)}</div>
            <div className="text-xs text-zinc-500 mt-1">{current.count} requests</div>
          </div>

          <div className="group p-4 bg-white/50 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 hover:border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/5 transition-[border-color,box-shadow] duration-300">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <div className="p-1.5 bg-purple-500/10 rounded text-purple-600 dark:text-purple-400">
                <Zap size={14} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider">Tokens</span>
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight">
              {formatCompactTokens(current.totalTokens)}
            </div>
            <div className="text-xs text-zinc-500 mt-1 flex gap-2">
              <span><span className="text-blue-500">In:</span> {(current.inputTokens / 1000).toFixed(0)}k</span>
              <span><span className="text-green-500">Out:</span> {(current.outputTokens / 1000).toFixed(0)}k</span>
            </div>
          </div>
        </div>

        {/* Timeline Chart Component */}
        {timelineBuckets.length > 0 && (
          <TokenTimelineChart
            buckets={timelineBuckets}
            period={period}
            timelineModeLabel={timelineModeLabel}
            maxToken={maxTimelineToken}
            chartModels={chartModels}
            primaryModels={primaryModels}
            modelColorMap={modelColorMap}
            formatCompactTokens={formatCompactTokens}
            shouldRenderDenseLabels={shouldRenderDenseLabels}
          />
        )}

        {/* Realtime token flow */}
        {tokenSeries.length > 0 && (
          <div className="space-y-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Realtime Token Flow</h4>
              <span className="text-[10px] text-zinc-400 font-mono">live {tokenSeries.length} reqs</span>
            </div>
            <div className="flex h-16 items-end gap-1.5">
              {tokenSeries.map((point, index) => (
                <div key={index} className="group relative flex-1 h-full flex flex-col justify-end">
                  <div
                    className="w-full rounded-sm bg-blue-500/80 hover:bg-blue-500 transition-colors duration-200 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                    style={{ height: `${Math.max((point.total / maxSeriesToken) * 100, 10)}%` }}
                    title={`Total: ${point.total.toLocaleString()}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breakdown Bar */}
        {current.totalTokens > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
              <span>Distribution</span>
              <span className="font-mono text-zinc-400">{current.totalTokens.toLocaleString()} total</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-inner">
              <div className="bg-blue-500 transition-[width] duration-500 will-change-[width]" style={{ width: `${(current.inputTokens / current.totalTokens) * 100}%` }} />
              <div className="bg-emerald-500 transition-[width] duration-500 will-change-[width]" style={{ width: `${(current.outputTokens / current.totalTokens) * 100}%` }} />
              {current.cachedTokens > 0 && (
                <div className="bg-amber-500 transition-[width] duration-500 will-change-[width]" style={{ width: `${(current.cachedTokens / current.totalTokens) * 100}%` }} />
              )}
            </div>
            <div className="flex gap-4 text-[10px] text-zinc-500 font-medium justify-center pt-1">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />Input</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />Output</span>
              {current.cachedTokens > 0 && (
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm" />Cached</span>
              )}
            </div>
          </div>
        )}

        {/* Advanced token monitor & Quota */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Cache Efficiency */}
          <div className="space-y-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database size={14} className="text-zinc-400" />
              <h4 className="text-xs font-semibold text-zinc-500">Cache Hit Rate</h4>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{cacheHitRate.toFixed(1)}%</div>
              <div className="text-[10px] text-zinc-400">efficiency</div>
            </div>
            <div className="text-[10px] text-zinc-400 truncate">
              {formatCompactTokens(current.cachedTokens)} cached tokens
            </div>
          </div>

          {/* Cost Est */}
          <div className="space-y-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/40 p-4">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xs font-semibold text-zinc-500">Unit Costs</h4>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">${avgCostPerRequest.toFixed(4)}</div>
                <div className="text-[9px] text-zinc-400 uppercase tracking-wide font-medium">Avg / Req</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">${costPer1k.toFixed(3)}</div>
                <div className="text-[9px] text-zinc-400 uppercase tracking-wide font-medium">Per 1k</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </ModuleCard>
  );
});
