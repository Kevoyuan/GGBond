'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { ShieldAlert, RefreshCw, Loader2, AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GovernanceSummaryView {
    recentConfirmations: number;
    recentDenials: number;
    topDeniedTools: string[];
}

// Sparkline-style bar (last N values)
function SparkBars({ values, color }: { values: number[]; color: string }) {
    const max = Math.max(...values, 1);
    return (
        <div className="flex items-end gap-0.5 h-8">
            {values.map((v, i) => (
                <div
                    key={i}
                    className={cn("rounded-sm transition-all", color)}
                    style={{ height: `${Math.round((v / max) * 100)}%`, width: '8px', minHeight: '2px' }}
                />
            ))}
        </div>
    );
}

// Simulated last-7-hour data
const SIMULATED_TREND = [3, 5, 2, 8, 4, 6, 3];

export const ExecutionGuardrailsPanel = memo(function ExecutionGuardrailsPanel() {
    const [data, setData] = useState<GovernanceSummaryView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetch_ = () => {
        setLoading(true);
        setError(false);
        fetch('/api/governance/summary')
            .then(r => r.json())
            .then(setData)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch_(); }, []);

    if (loading) {
        return (
            <ModuleCard title="Execution Guardrails" description="Risk & denial trends" icon={ShieldAlert} className="h-[30rem] flex flex-col">
                <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    if (error || !data) {
        return (
            <ModuleCard title="Execution Guardrails" description="Risk & denial trends" icon={ShieldAlert} className="h-[30rem] flex flex-col">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <p className="text-xs text-zinc-500">Fetch failed</p>
                    <button onClick={fetch_} className="text-[10px] text-blue-600 hover:underline">Retry</button>
                </div>
            </ModuleCard>
        );
    }

    const total = data.recentConfirmations + data.recentDenials;
    const confirmPct = total > 0 ? Math.round((data.recentConfirmations / total) * 100) : 0;
    const denyPct = total > 0 ? 100 - confirmPct : 0;

    return (
        <ModuleCard
            title="Execution Guardrails"
            description={`${data.recentDenials} denied · ${denyPct}% deny rate`}
            icon={ShieldAlert}
            className="h-[30rem] flex flex-col"
            actions={
                <button onClick={fetch_} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
                    <RefreshCw size={13} />
                </button>
            }
        >
            <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-4">

                {/* High-risk call trend spark */}
                <div className="p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">High-Risk Calls (last 7h)</span>
                        <TrendingDown size={12} className="text-zinc-400" />
                    </div>
                    <SparkBars values={SIMULATED_TREND} color="bg-amber-400 dark:bg-amber-500" />
                </div>

                {/* Confirm/Deny ratio bar */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Confirm / Deny Ratio</span>
                    </div>
                    <div className="flex rounded-full overflow-hidden h-2.5 mb-2 border border-zinc-200 dark:border-zinc-700">
                        <div
                            className="bg-emerald-400 dark:bg-emerald-500 transition-all"
                            style={{ width: `${confirmPct}%` }}
                        />
                        <div
                            className="bg-red-400 dark:bg-red-500 transition-all flex-1"
                        />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
                        <span className="text-emerald-700 dark:text-emerald-400">{confirmPct}% confirmed ({data.recentConfirmations})</span>
                        <span className="text-red-700 dark:text-red-400">{denyPct}% denied ({data.recentDenials})</span>
                    </div>
                </div>

                {/* Top Denied Tools */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Top Denied Tools</span>
                    {data.topDeniedTools.length === 0 ? (
                        <div className="text-center py-6 italic text-[10px] text-zinc-400">No denials recorded this session</div>
                    ) : (
                        <div className="space-y-1.5">
                            {data.topDeniedTools.map((tool, i) => (
                                <div key={tool} className="flex items-center gap-2 p-1.5 rounded-md border border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/10">
                                    <span className="text-[9px] font-mono text-zinc-400 w-3 text-right">{i + 1}.</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                    <span className="text-[10px] font-mono font-bold text-red-700 dark:text-red-400 truncate">{tool}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Risk level indicator */}
                <div className="p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Risk Level</span>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            denyPct > 30 ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" :
                                denyPct > 10 ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]" :
                                    "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                        )} />
                        <span className={cn(
                            "text-xs font-bold",
                            denyPct > 30 ? "text-red-600 dark:text-red-400" :
                                denyPct > 10 ? "text-amber-600 dark:text-amber-400" :
                                    "text-emerald-600 dark:text-emerald-400"
                        )}>
                            {denyPct > 30 ? 'High' : denyPct > 10 ? 'Medium' : 'Low'}
                        </span>
                        <span className="text-[9px] text-zinc-400 ml-1">— based on deny rate</span>
                    </div>
                </div>
            </div>
        </ModuleCard>
    );
});
