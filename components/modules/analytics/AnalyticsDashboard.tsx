'use client';

import React, { useEffect, useState } from 'react';
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

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

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
  const contextUsagePercent = Math.min((current.totalTokens / pricing.contextWindow) * 100, 100);
  const cacheHitRate = current.inputTokens > 0 ? (current.cachedTokens / current.inputTokens) * 100 : 0;
  const avgCostPerRequest = current.count > 0 ? current.cost / current.count : 0;
  const costPer1k = current.totalTokens > 0 ? (current.cost / current.totalTokens) * 1000 : 0;

  const quotaBuckets = quota?.quota?.buckets || [];
  const dailyQuota = quotaBuckets.find(bucket => /day/i.test(bucket.tokenType || ''));
  const rateLimit = quotaBuckets.find(bucket => /minute|second|rate/i.test(bucket.tokenType || ''));
  const dailyQuotaPercent = dailyQuota?.remainingFraction !== undefined ? dailyQuota.remainingFraction * 100 : null;
  const rateLimitPercent = rateLimit?.remainingFraction !== undefined ? rateLimit.remainingFraction * 100 : null;
  const shouldWarnCompression = contextUsagePercent > 70;

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
              <h4 className="text-xs font-semibold text-muted-foreground">Context Window Gauge</h4>
              <span className="text-[10px] text-muted-foreground">{(pricing.contextWindow / 1024 / 1024).toFixed(1)}M</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full transition-all ${contextUsagePercent > 85 ? 'bg-red-500' : contextUsagePercent > 65 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(contextUsagePercent, 1)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Gauge size={12} /> {contextUsagePercent.toFixed(2)}% used</span>
              <span>{dominantModel}</span>
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
              <AlertTriangle size={14} /> Compression建议：当前上下文压力已超过70%，建议开启压缩或摘要策略。
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
