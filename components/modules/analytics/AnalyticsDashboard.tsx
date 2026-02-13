'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { BarChart, DollarSign, Zap, Loader2, Gauge, Database, AlertTriangle } from 'lucide-react';
import { getModelInfo } from '@/lib/pricing';

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

interface QuotaResponse {
  quota?: {
    buckets?: Array<{
      tokenType?: string;
      modelId?: string;
      remainingFraction?: number;
    }>;
  };
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

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [timelineHover, setTimelineHover] = useState<TimelineHoverState | null>(null);
  const timelineChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/telemetry').then(r => r.json()),
      fetch('/api/quota').then(r => r.json()),
    ])
      .then(([statsRes, telemetryRes, quotaRes]) => {
        setStats(statsRes);
        setTelemetry(telemetryRes);
        setQuota(quotaRes);
      })
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
  const tokenSeries = (telemetry?.recentEvents || [])
    .filter((event) => event.name === 'gemini_cli.api_response')
    .slice(-12)
    .map((event) => {
      const input = readNumericValue(event.attributes.input_token_count);
      const output = readNumericValue(event.attributes.output_token_count);
      const totalValue = readNumericValue(event.attributes.total_token_count) || (input + output);
      return {
        total: totalValue,
        input,
        output,
      };
    });

  const maxSeriesToken = tokenSeries.length > 0 ? Math.max(...tokenSeries.map(item => item.total), 1) : 1;
  const dominantModel = Object.entries(telemetry?.tokensByModel || {}).sort((a, b) => {
    const totalA = a[1].input + a[1].output;
    const totalB = b[1].input + b[1].output;
    return totalB - totalA;
  })[0]?.[0] || 'gemini-3-pro-preview';
  const { pricing } = getModelInfo(dominantModel);
  // Show average request size relative to context window (more meaningful than cumulative)
  const avgTokensPerRequest = current.count > 0 ? current.totalTokens / current.count : 0;
  const contextUsagePercent = Math.min((avgTokensPerRequest / pricing.contextWindow) * 100, 100);
  const cacheHitRate = current.inputTokens > 0 ? (current.cachedTokens / current.inputTokens) * 100 : 0;
  const avgCostPerRequest = current.count > 0 ? current.cost / current.count : 0;
  const costPer1k = current.totalTokens > 0 ? (current.cost / current.totalTokens) * 1000 : 0;

  const quotaBuckets = quota?.quota?.buckets || [];
  const dailyQuota = quotaBuckets.find(bucket => /day/i.test(bucket.tokenType || ''));
  const rateLimit = quotaBuckets.find(bucket => /minute|second|rate/i.test(bucket.tokenType || ''));
  const dailyQuotaPercent = dailyQuota?.remainingFraction !== undefined ? dailyQuota.remainingFraction * 100 : null;
  const rateLimitPercent = rateLimit?.remainingFraction !== undefined ? rateLimit.remainingFraction * 100 : null;
  // Only warn if avg request uses more than 50% of context window
  const shouldWarnCompression = avgTokensPerRequest > pricing.contextWindow * 0.5;
  const timelinePeriod: 'today' | 'week' | 'month' = period === 'daily'
    ? 'today'
    : period === 'weekly'
      ? 'week'
      : 'month';
  const timelineModeLabel = timelinePeriod === 'today'
    ? 'Hourly View'
    : 'Daily View';
  const timelineBuckets = timelinePeriod === 'today'
    ? (stats?.breakdowns?.todayHourly || [])
    : timelinePeriod === 'week'
      ? (stats?.breakdowns?.weekDaily || [])
      : (stats?.breakdowns?.monthDaily || []);

  const modelTotals = timelineBuckets.reduce<Record<string, number>>((acc, bucket) => {
    Object.entries(bucket.models || {}).forEach(([model, tokens]) => {
      acc[model] = (acc[model] || 0) + tokens;
    });
    return acc;
  }, {});

  const orderedModels = Object.entries(modelTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const primaryModels = orderedModels.slice(0, 8);
  const useOthers = orderedModels.length > primaryModels.length;
  const chartModels = useOthers ? [...primaryModels, 'Others'] : primaryModels;
  const maxTimelineToken = timelineBuckets.length > 0
    ? Math.max(...timelineBuckets.map(bucket => bucket.totalTokens), 1)
    : 1;

  const modelColors = [
    '#ec4899', // pink
    '#3b82f6', // blue
    '#84cc16', // lime
    '#f97316', // orange
    '#22c55e', // green
    '#a855f7', // purple
    '#06b6d4', // cyan
    '#eab308', // yellow
    '#6b7280', // gray
  ];
  const modelColorMap = new Map<string, string>();
  chartModels.forEach((model, idx) => {
    modelColorMap.set(model, modelColors[idx % modelColors.length]);
  });
  const timelineGrandTotal = Object.values(modelTotals).reduce((sum, value) => sum + value, 0);
  const topModelsTotal = primaryModels.reduce((sum, model) => sum + (modelTotals[model] || 0), 0);
  const othersTotal = Math.max(timelineGrandTotal - topModelsTotal, 0);
  const chartHeightPx = 140;
  const shouldRenderDenseLabels = timelinePeriod === 'month';

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

        {timelineBuckets.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground">Token Timeline (Stacked by Model)</h4>
              <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-muted/40 text-muted-foreground">
                Follows period · {timelineModeLabel}
              </span>
            </div>

            {timelineGrandTotal === 0 ? (
              <div className="h-40 rounded-lg border border-dashed border-border/60 bg-background/30 flex items-center justify-center text-xs text-muted-foreground">
                No token usage in selected period
              </div>
            ) : (
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-44 flex flex-col justify-between">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="border-t border-dashed border-border/40" />
                  ))}
                </div>
                <div className="pointer-events-none absolute right-0 top-0 text-[10px] text-muted-foreground bg-background/70 px-1 rounded">
                  {formatCompactTokens(maxTimelineToken)}
                </div>
                <div
                  ref={timelineChartRef}
                  className="relative flex h-52 items-end gap-1 overflow-x-auto pb-1"
                  onMouseLeave={() => setTimelineHover(null)}
                >
                  {timelineBuckets.map((bucket, index) => {
                    const othersValue = Object.entries(bucket.models || {}).reduce((sum, [model, value]) => {
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
                      ? Math.max((bucket.totalTokens / maxTimelineToken) * chartHeightPx, 6)
                      : 2;
                    const tooltipRows = normalizedModels
                      .sort((a, b) => b.tokens - a.tokens)
                      .map((item) => ({
                        model: item.model,
                        tokens: item.tokens,
                        color: modelColorMap.get(item.model) || '#6b7280',
                      }));
                    const showLabel = timelinePeriod === 'today'
                      ? index % 2 === 0
                      : shouldRenderDenseLabels
                        ? (index === 0 || index === timelineBuckets.length - 1 || index % 3 === 0)
                        : true;

                    return (
                      <div key={bucket.key} className="group relative flex min-w-[18px] flex-1 flex-col items-center justify-end gap-1">
                        <div
                          className="relative flex w-full max-w-[32px] flex-col justify-end overflow-hidden rounded-sm border border-border/40 bg-zinc-200/40 dark:bg-zinc-800/50"
                          style={{ height: `${columnHeightPx}px` }}
                          onMouseMove={(event) => {
                            if (!timelineChartRef.current) return;
                            const rect = timelineChartRef.current.getBoundingClientRect();
                            setTimelineHover({
                              x: event.clientX - rect.left,
                              y: Math.max(event.clientY - rect.top, 0),
                              label: bucket.label,
                              total: bucket.totalTokens,
                              rows: tooltipRows,
                            });
                          }}
                        >
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
                          <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
                        ) : (
                          <span className="h-3 text-[10px] text-transparent">.</span>
                        )}
                      </div>
                    );
                  })}
                  {timelineHover && (
                    <div
                      className="pointer-events-none absolute z-20 w-52 rounded-lg border border-border/60 bg-background/95 p-2 shadow-lg backdrop-blur"
                      style={{
                        left: `${timelineHover.x}px`,
                        top: `${Math.max(timelineHover.y - 10, 8)}px`,
                        transform: 'translate(-50%, -100%)',
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-foreground">{timelineHover.label}</span>
                        <span className="text-muted-foreground">{formatCompactTokens(timelineHover.total)}</span>
                      </div>
                      <div className="space-y-1">
                        {timelineHover.rows.slice(0, 6).map((row) => (
                          <div key={row.model} className="flex items-center justify-between text-[10px]">
                            <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                              <span className="truncate">{row.model}</span>
                            </span>
                            <span className="tabular-nums text-foreground">{formatCompactTokens(row.tokens)}</span>
                          </div>
                        ))}
                        {timelineHover.rows.length > 6 && (
                          <div className="text-[10px] text-muted-foreground">+{timelineHover.rows.length - 6} more models</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {chartModels.map((model) => {
                const value = model === 'Others'
                  ? othersTotal
                  : (modelTotals[model] || 0);
                const ratio = timelineGrandTotal > 0 ? (value / timelineGrandTotal) * 100 : 0;
                return (
                  <div key={model} className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-[10px]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: modelColorMap.get(model) }} />
                    <span className="font-medium text-foreground">{model}</span>
                    <span className="text-muted-foreground">{formatCompactTokens(value)} ({ratio.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Realtime token flow */}
        {tokenSeries.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground">Realtime Token Flow</h4>
              <span className="text-[10px] text-muted-foreground">last {tokenSeries.length} responses</span>
            </div>
            <div className="flex h-16 items-end gap-1.5">
              {tokenSeries.map((point, index) => (
                <div key={index} className="group relative flex-1">
                  <div
                    className="w-full rounded-sm bg-primary/80 transition-all group-hover:bg-primary"
                    style={{ height: `${Math.max((point.total / maxSeriesToken) * 100, 6)}%` }}
                    title={`Total: ${point.total.toLocaleString()} | In: ${point.input.toLocaleString()} | Out: ${point.output.toLocaleString()}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Advanced token monitor */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground">Avg Request Size</h4>
              <span className="text-[10px] text-muted-foreground">/{(pricing.contextWindow / 1024 / 1024).toFixed(0)}k</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full transition-all ${contextUsagePercent > 85 ? 'bg-red-500' : contextUsagePercent > 65 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(contextUsagePercent, 1)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Gauge size={12} /> {contextUsagePercent.toFixed(1)}% of context</span>
              <span>{formatCompactTokens(avgTokensPerRequest)} avg</span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <h4 className="text-xs font-semibold text-muted-foreground">Cache Efficiency</h4>
            <div className="text-xl font-bold">{cacheHitRate.toFixed(1)}%</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Database size={12} /> {current.cachedTokens.toLocaleString()} cached / {current.inputTokens.toLocaleString()} input
            </div>
          </div>
        </div>

        {/* Quota + cost estimator */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <h4 className="text-xs font-semibold text-muted-foreground">Live Quota Signals</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between"><span>Daily Quota</span><span>{dailyQuotaPercent === null ? 'N/A' : `${dailyQuotaPercent.toFixed(0)}%`}</span></div>
              <div className="flex items-center justify-between"><span>Rate Limit</span><span>{rateLimitPercent === null ? 'N/A' : `${rateLimitPercent.toFixed(0)}%`}</span></div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <h4 className="text-xs font-semibold text-muted-foreground">Cost Estimator</h4>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold">${avgCostPerRequest.toFixed(4)}</div>
                <div className="text-[10px] text-muted-foreground">avg / request</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold">${costPer1k.toFixed(4)}</div>
                <div className="text-[10px] text-muted-foreground">per 1k tokens</div>
              </div>
            </div>
          </div>
        </div>

        {shouldWarnCompression && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={14} /> High Context Usage: Average request uses {contextUsagePercent.toFixed(0)}% of context window. Consider using /compress or shorter prompts.
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
