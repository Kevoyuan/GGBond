'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Wrench, XCircle } from 'lucide-react';
import { ModuleCard } from '../ModuleCard';
import { cn } from '@/lib/utils';
import { fetchJsonWithRetry } from '@/lib/client-fetch';

type PanelView = 'model' | 'session' | 'tools';

interface RoleStat {
  role: string;
  requests: number;
  input: number;
  output: number;
  cached: number;
  thoughts: number;
  total: number;
}

interface ModelStat {
  model: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
  input: number;
  output: number;
  cached: number;
  thoughts: number;
  total: number;
  roles: RoleStat[];
}

interface ToolDecisionSummary {
  reviewed: number;
  accepted: number;
  autoAccepted: number;
  rejected: number;
  modified: number;
  agreementRate: number | null;
}

interface ToolRow {
  toolName: string;
  success: number;
  failed: number;
  total: number;
  successRate: number;
  avgDurationMs: number;
}

interface SessionModelStat {
  model: string;
  requests: number;
  totalTokens: number;
}

interface SessionStats {
  id: string;
  title: string;
  resolvedFrom: 'requested' | 'latest';
  toolCalls: number;
  successRate: number | null;
  wallTimeMs: number;
  agentActiveMs: number;
  apiTimeMs: number;
  toolTimeMs: number;
  userAgreement: ToolDecisionSummary;
  models: SessionModelStat[];
}

interface NerdStatsResponse {
  meta: {
    authMethod: string;
    authType: string;
    accountEmail?: string;
    tier: string | null;
    telemetrySource: 'telemetry' | 'db_fallback';
  };
  models: ModelStat[];
  session: SessionStats | null;
  tools: {
    rows: ToolRow[];
    decisions: ToolDecisionSummary;
  };
}

interface BucketInfo {
  remainingAmount?: string;
  remainingFraction?: number;
  resetTime?: string;
  tokenType?: string;
  modelId?: string;
}

interface QuotaResponse {
  quota?: {
    buckets?: BucketInfo[];
  };
}

function formatInteger(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return `${value.toFixed(fractionDigits)}%`;
}

function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '--';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatReset(resetTime?: string): string {
  if (!resetTime) return '--';
  const parsed = Date.parse(resetTime);
  if (!Number.isFinite(parsed)) return '--';
  const diffMs = parsed - Date.now();
  if (diffMs <= 0) return 'now';

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const VIEW_OPTIONS: Array<{ id: PanelView; label: string }> = [
  { id: 'model', label: 'Model' },
  { id: 'session', label: 'Session' },
  { id: 'tools', label: 'Tools' },
];

export const NerdStatsPanel = memo(function NerdStatsPanel({ currentSessionId }: { currentSessionId?: string | null }) {
  const [data, setData] = useState<NerdStatsResponse | null>(null);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PanelView>('model');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const query = currentSessionId ? `?sessionId=${encodeURIComponent(currentSessionId)}` : '';
      const [{ response: statsResponse, data: statsData }, { data: quotaData }] = await Promise.all([
        fetchJsonWithRetry<NerdStatsResponse>(`/api/analytics/nerd-stats${query}`),
        fetchJsonWithRetry<QuotaResponse>('/api/quota'),
      ]);

      if (!statsResponse.ok) {
        setError('Failed to load stats');
        return;
      }

      setData(statsData);
      setQuota(quotaData);
      setError(null);
    } catch (fetchError) {
      console.error('[NerdStatsPanel] Failed to load stats:', fetchError);
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [currentSessionId]);

  useEffect(() => {
    void fetchStats();
    const onFocus = () => { void fetchStats(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchStats]);

  const quotaByModel = useMemo(() => {
    const bucketMap = new Map<string, BucketInfo>();
    for (const bucket of quota?.quota?.buckets || []) {
      if (bucket.modelId) {
        bucketMap.set(bucket.modelId, bucket);
      }
    }
    return bucketMap;
  }, [quota]);

  const metaSubtitle = useMemo(() => {
    if (!data) return 'Model, session, and tool telemetry';
    const parts = [
      data.meta.authMethod,
      data.meta.accountEmail ? `(${data.meta.accountEmail})` : '',
      data.meta.telemetrySource === 'db_fallback' ? 'DB fallback' : 'Live telemetry',
    ].filter(Boolean);
    return parts.join(' · ');
  }, [data]);

  return (
    <ModuleCard
      title="Stats For Nerds"
      description={metaSubtitle}
      icon={BarChart3}
      className="h-[38rem]"
      actions={(
        <>
          {data?.meta.telemetrySource === 'db_fallback' && (
            <div className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-600 dark:bg-amber-500/5 dark:text-amber-400">
              DB SYNC
            </div>
          )}
          <button
            onClick={() => void fetchStats()}
            className="group flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200/50 bg-white/50 text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-800/50 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 active:scale-[0.96]"
            title="Refresh stats"
          >
            <RefreshCw size={12} className={cn('transition-transform group-hover:rotate-180', loading && 'animate-spin')} />
          </button>
        </>
      )}
    >
      {loading && !data ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 size={20} className="animate-spin text-zinc-400" />
        </div>
      ) : error || !data ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <XCircle size={20} className="text-red-500/70" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{error || 'No stats available'}</p>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-200/50 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800/50 dark:bg-zinc-900/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Auth Method</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{data.meta.authMethod}</div>
              {data.meta.accountEmail && (
                <div className="mt-0.5 font-mono text-[11px] text-zinc-500">{data.meta.accountEmail}</div>
              )}
            </div>
            <div className="rounded-lg border border-zinc-200/50 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800/50 dark:bg-zinc-900/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tier</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{data.meta.tier || 'Unavailable'}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {data.meta.tier ? 'Live from Code Assist' : 'Unavailable for current auth source'}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200/50 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800/50 dark:bg-zinc-900/40">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Session</div>
              <div className="mt-1 truncate font-mono text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                {data.session?.id || 'No active session'}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {data.session ? `${data.session.resolvedFrom === 'requested' ? 'Current' : 'Latest'} · ${data.session.title}` : 'Waiting for session data'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-zinc-200/50 bg-zinc-50/40 p-1 dark:border-zinc-800/50 dark:bg-zinc-900/30">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setActiveView(option.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  activeView === option.id
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {activeView === 'model' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <MetricBadge label="Tracked Models" value={formatInteger(data.models.length)} icon={Activity} />
                  <MetricBadge label="Total Requests" value={formatInteger(data.models.reduce((sum, model) => sum + model.requests, 0))} icon={BarChart3} />
                  <MetricBadge label="Total Errors" value={formatInteger(data.models.reduce((sum, model) => sum + model.errors, 0))} icon={XCircle} />
                  <MetricBadge label="Total Tokens" value={formatInteger(data.models.reduce((sum, model) => sum + model.total, 0))} icon={ShieldCheck} />
                </div>

                <div className="overflow-hidden rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-zinc-50/70 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Model</th>
                        <th className="px-3 py-2 font-semibold">Requests</th>
                        <th className="px-3 py-2 font-semibold">Errors</th>
                        <th className="px-3 py-2 font-semibold">Avg Latency</th>
                        <th className="px-3 py-2 font-semibold">Tokens</th>
                        <th className="px-3 py-2 font-semibold">Cache Reads</th>
                        <th className="px-3 py-2 font-semibold">Quota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.models.map((model) => {
                        const quotaBucket = quotaByModel.get(model.model);
                        const cacheReadRate = model.total > 0 ? (model.cached / model.total) * 100 : 0;
                        return (
                          <React.Fragment key={model.model}>
                            <tr className="border-t border-zinc-200/50 align-top dark:border-zinc-800/50">
                              <td className="px-3 py-2">
                                <div className="font-mono text-[12px] font-medium text-zinc-800 dark:text-zinc-100">{model.model}</div>
                              </td>
                              <td className="px-3 py-2 font-mono">{formatInteger(model.requests)}</td>
                              <td className="px-3 py-2 font-mono">{model.errors > 0 ? `${formatInteger(model.errors)} (${formatPercent((model.errors / Math.max(model.requests, 1)) * 100, 1)})` : '0 (0.0%)'}</td>
                              <td className="px-3 py-2 font-mono">{formatDuration(model.avgLatencyMs)}</td>
                              <td className="px-3 py-2 font-mono">
                                <div>{formatInteger(model.total)}</div>
                                <div className="text-[10px] text-zinc-500">In {formatInteger(model.input)} · Out {formatInteger(model.output)} · Thoughts {formatInteger(model.thoughts)}</div>
                              </td>
                              <td className="px-3 py-2 font-mono">{formatInteger(model.cached)} ({formatPercent(cacheReadRate, 1)})</td>
                              <td className="px-3 py-2 font-mono">
                                {quotaBucket ? (
                                  <>
                                    <div>{formatPercent((quotaBucket.remainingFraction ?? 0) * 100, 1)}</div>
                                    <div className="text-[10px] text-zinc-500">{quotaBucket.remainingAmount || '--'} · resets in {formatReset(quotaBucket.resetTime)}</div>
                                  </>
                                ) : (
                                  <span className="text-zinc-400">--</span>
                                )}
                              </td>
                            </tr>
                            {model.roles.length > 0 && (
                              <tr className="border-t border-zinc-200/30 bg-zinc-50/40 dark:border-zinc-800/30 dark:bg-zinc-900/20">
                                <td colSpan={7} className="px-3 py-2">
                                  <div className="flex flex-wrap gap-2">
                                    {model.roles.map((role) => (
                                      <span
                                        key={`${model.model}-${role.role}`}
                                        className="rounded-full border border-zinc-200/60 bg-white/70 px-2 py-1 font-mono text-[10px] text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-800/70 dark:text-zinc-300"
                                      >
                                        {role.role}: {formatInteger(role.requests)} req · {formatInteger(role.total)} tokens
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === 'session' && (
              <div className="space-y-3">
                {data.session ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                      <MetricBadge label="Tool Calls" value={formatInteger(data.session.toolCalls)} icon={Wrench} />
                      <MetricBadge label="Success Rate" value={formatPercent(data.session.successRate, 1)} icon={CheckCircle2} />
                      <MetricBadge label="Wall Time" value={formatDuration(data.session.wallTimeMs)} icon={Activity} />
                      <MetricBadge label="Agent Active" value={formatDuration(data.session.agentActiveMs)} icon={ShieldCheck} />
                      <MetricBadge label="API Time" value={formatDuration(data.session.apiTimeMs)} icon={BarChart3} />
                      <MetricBadge label="Tool Time" value={formatDuration(data.session.toolTimeMs)} icon={Wrench} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                      <MetricBadge label="Reviewed" value={formatInteger(data.session.userAgreement.reviewed)} icon={Activity} />
                      <MetricBadge label="Accepted" value={formatInteger(data.session.userAgreement.accepted + data.session.userAgreement.autoAccepted)} icon={CheckCircle2} />
                      <MetricBadge label="Rejected" value={formatInteger(data.session.userAgreement.rejected)} icon={XCircle} />
                      <MetricBadge label="Modified" value={formatInteger(data.session.userAgreement.modified)} icon={Wrench} />
                      <MetricBadge label="Agreement" value={formatPercent(data.session.userAgreement.agreementRate, 1)} icon={ShieldCheck} />
                    </div>

                    <div className="overflow-hidden rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-zinc-50/70 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Model</th>
                            <th className="px-3 py-2 font-semibold">Requests</th>
                            <th className="px-3 py-2 font-semibold">Session Tokens</th>
                            <th className="px-3 py-2 font-semibold">Usage Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.session.models.map((model) => {
                            const quotaBucket = quotaByModel.get(model.model);
                            return (
                              <tr key={model.model} className="border-t border-zinc-200/50 dark:border-zinc-800/50">
                                <td className="px-3 py-2 font-mono text-[12px] font-medium text-zinc-800 dark:text-zinc-100">{model.model}</td>
                                <td className="px-3 py-2 font-mono">{formatInteger(model.requests)}</td>
                                <td className="px-3 py-2 font-mono">{formatInteger(model.totalTokens)}</td>
                                <td className="px-3 py-2 font-mono">
                                  {quotaBucket ? (
                                    <>
                                      <div>{formatPercent((quotaBucket.remainingFraction ?? 0) * 100, 1)}</div>
                                      <div className="text-[10px] text-zinc-500">{quotaBucket.remainingAmount || '--'} · resets in {formatReset(quotaBucket.resetTime)}</div>
                                    </>
                                  ) : (
                                    <span className="text-zinc-400">--</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-zinc-500">
                    No session telemetry available yet
                  </div>
                )}
              </div>
            )}

            {activeView === 'tools' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                  <MetricBadge label="Reviewed" value={formatInteger(data.tools.decisions.reviewed)} icon={Activity} />
                  <MetricBadge label="Accepted" value={formatInteger(data.tools.decisions.accepted + data.tools.decisions.autoAccepted)} icon={CheckCircle2} />
                  <MetricBadge label="Rejected" value={formatInteger(data.tools.decisions.rejected)} icon={XCircle} />
                  <MetricBadge label="Modified" value={formatInteger(data.tools.decisions.modified)} icon={Wrench} />
                  <MetricBadge label="Agreement" value={formatPercent(data.tools.decisions.agreementRate, 1)} icon={ShieldCheck} />
                </div>

                <div className="overflow-hidden rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-zinc-50/70 text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Tool</th>
                        <th className="px-3 py-2 font-semibold">Calls</th>
                        <th className="px-3 py-2 font-semibold">Success Rate</th>
                        <th className="px-3 py-2 font-semibold">Avg Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tools.rows.map((tool) => (
                        <tr key={tool.toolName} className="border-t border-zinc-200/50 dark:border-zinc-800/50">
                          <td className="px-3 py-2 font-mono text-[12px] font-medium text-zinc-800 dark:text-zinc-100">{tool.toolName}</td>
                          <td className="px-3 py-2 font-mono">{formatInteger(tool.total)}</td>
                          <td className="px-3 py-2 font-mono">{formatPercent(tool.successRate, 1)}</td>
                          <td className="px-3 py-2 font-mono">{formatDuration(tool.avgDurationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModuleCard>
  );
});

const MetricBadge = memo(function MetricBadge({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-zinc-200/50 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800/50 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <Icon size={12} className="text-zinc-400" />
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
});
