'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Activity, Loader2, RefreshCw, TrendingUp, AlertTriangle, Wrench } from 'lucide-react';

interface TelemetrySummary {
    totalApiRequests: number;
    totalApiErrors: number;
    totalToolCalls: number;
    avgApiLatencyMs: number;
    avgToolLatencyMs: number;
    p95ApiLatencyMs: number;
}

interface TelemetryData {
    summary: TelemetrySummary;
    tokensByModel: Record<string, { input: number; output: number; cached: number; thoughts: number }>;
    toolsByName: Record<string, { count: number; success: number; fail: number; avgLatency: number }>;
    totalEvents: number;
    dataSource?: 'telemetry' | 'db_fallback';
}

export function PerformancePanel() {
    const [data, setData] = useState<TelemetryData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTelemetry = () => {
        setLoading(true);
        fetch('/api/telemetry')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchTelemetry(); }, []);

    if (loading) {
        return (
            <ModuleCard title="Performance" description="Telemetry metrics" icon={Activity}>
                <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    const hasAnyData = !!data && (
        data.summary.totalApiRequests > 0 ||
        data.summary.totalToolCalls > 0 ||
        Object.keys(data.tokensByModel || {}).length > 0
    );

    if (!hasAnyData) {
        return (
            <ModuleCard title="Performance" description="Telemetry metrics" icon={Activity}>
                <div className="h-full flex flex-col items-center justify-center text-center py-8 text-sm text-muted-foreground">
                    <Activity size={24} className="mb-2 opacity-30" />
                    <div className="font-medium text-zinc-500 dark:text-zinc-400">No performance data yet</div>
                    <div className="text-xs mt-1 max-w-[280px]">
                        Send at least one request in this workspace. If telemetry logging is disabled, the panel will fallback to session DB stats.
                    </div>
                </div>
            </ModuleCard>
        );
    }

    const s = data.summary;
    const topTools = Object.entries(data.toolsByName)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 6);

    return (
        <ModuleCard
            title="Performance"
            description={`${data.totalEvents} events`}
            icon={Activity}
            actions={
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        data.dataSource === 'db_fallback'
                            ? 'border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}>
                        {data.dataSource === 'db_fallback' ? 'DB Fallback' : 'Telemetry'}
                    </span>
                    <button onClick={fetchTelemetry} className="p-1 text-zinc-500 hover:text-foreground transition-colors"><RefreshCw size={14} /></button>
                </div>
            }
        >
            <div className="space-y-5">
                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                        <div className="text-lg font-bold text-foreground">{s.avgApiLatencyMs}ms</div>
                        <div className="text-[10px] text-muted-foreground">Avg API</div>
                    </div>
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                        <div className="text-lg font-bold text-foreground">{s.p95ApiLatencyMs}ms</div>
                        <div className="text-[10px] text-muted-foreground">P95 API</div>
                    </div>
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center">
                        <div className="text-lg font-bold text-foreground">{s.avgToolLatencyMs}ms</div>
                        <div className="text-[10px] text-muted-foreground">Avg Tool</div>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 py-2">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                            <TrendingUp size={14} className="text-blue-500" /> {s.totalApiRequests}
                        </div>
                        <div className="text-[10px] text-muted-foreground">API Calls</div>
                    </div>
                    <div className="text-center">
                        <div className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                            <Wrench size={14} className="text-green-500" /> {s.totalToolCalls}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Tool Calls</div>
                    </div>
                    <div className="text-center">
                        <div className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                            <AlertTriangle size={14} className={s.totalApiErrors > 0 ? 'text-red-500' : 'text-zinc-300'} /> {s.totalApiErrors}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Errors</div>
                    </div>
                </div>

                {/* Top Tools */}
                {topTools.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Wrench size={12} /> Most Used Tools
                        </h4>
                        {topTools.map(([name, info]) => {
                            const successRate = info.count > 0 ? (info.success / info.count * 100) : 100;
                            return (
                                <div key={name} className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-foreground min-w-[100px] truncate">{name}</span>
                                    <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 rounded-full transition-all"
                                            style={{ width: `${successRate}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{info.count}x</span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right">{Math.round(info.avgLatency)}ms</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Tokens by Model */}
                {Object.keys(data.tokensByModel).length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground">Tokens by Model</h4>
                        {Object.entries(data.tokensByModel).map(([model, tokens]) => (
                            <div key={model} className="flex items-center justify-between py-1.5 text-sm">
                                <span className="font-mono text-xs text-foreground truncate max-w-[140px]">{model}</span>
                                <div className="text-right text-xs text-muted-foreground">
                                    <span className="text-blue-500">{(tokens.input / 1000).toFixed(0)}k</span>
                                    {' / '}
                                    <span className="text-emerald-500">{(tokens.output / 1000).toFixed(0)}k</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ModuleCard>
    );
}
