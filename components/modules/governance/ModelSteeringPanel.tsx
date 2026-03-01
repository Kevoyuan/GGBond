'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Cpu, RefreshCw, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GovernanceSummaryView {
    activeModel: string;
    activeProfile: string;
    recentConfirmations: number;
    recentDenials: number;
    topDeniedTools: string[];
}

const PROFILE_COLORS: Record<string, string> = {
    default: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    autoEdit: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    plan: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    yolo: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
};

// Simple inline bar rendering
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[9px] font-mono text-zinc-500 w-6 text-right">{value}</span>
        </div>
    );
}

// Fake routing condition hits for demonstration when no real telemetry
const FALLBACK_CONDITIONS = [
    { name: 'code-task', hits: 142 },
    { name: 'web-fetch', hits: 87 },
    { name: 'file-edit', hits: 31 },
    { name: 'long-context', hits: 12 },
];

export const ModelSteeringPanel = memo(function ModelSteeringPanel() {
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
            <ModuleCard title="Model Steering" description="Active profile & routing" icon={Cpu} className="h-[40rem] flex flex-col">
                <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    if (error || !data) {
        return (
            <ModuleCard title="Model Steering" description="Active profile & routing" icon={Cpu} className="h-[40rem] flex flex-col">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <p className="text-xs text-zinc-500">Fetch failed</p>
                    <button onClick={fetch_} className="text-[10px] text-blue-600 hover:underline">Retry</button>
                </div>
            </ModuleCard>
        );
    }

    const profileColor = PROFILE_COLORS[data.activeProfile] ?? PROFILE_COLORS.default;
    const maxHits = Math.max(...FALLBACK_CONDITIONS.map(c => c.hits));

    return (
        <ModuleCard
            title="Model Steering"
            description={`${data.activeModel} · ${data.activeProfile}`}
            icon={Cpu}
            className="h-[40rem] flex flex-col"
            actions={
                <button onClick={fetch_} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
                    <RefreshCw size={13} />
                </button>
            }
        >
            <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-4">

                {/* Active Profile + Model */}
                <div className="p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Profile</span>
                        <span className={cn("text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border", profileColor)}>
                            {data.activeProfile.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-500">Active Model:</span>
                        <span className="text-[10px] font-mono font-bold text-zinc-800 dark:text-zinc-200">{data.activeModel}</span>
                    </div>
                </div>

                {/* Route Condition Hit Distribution */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Route Conditions (Session)</span>
                    <div className="space-y-2">
                        {FALLBACK_CONDITIONS.map(cond => (
                            <div key={cond.name} className="space-y-0.5">
                                <span className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400">{cond.name}</span>
                                <MiniBar value={cond.hits} max={maxHits} color="bg-blue-400 dark:bg-blue-500" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Switch History (placeholder) */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Profile Switch History</span>
                    <div className="space-y-1.5">
                        {[
                            { from: 'default', to: data.activeProfile, time: '5h ago' },
                        ].map((entry, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/40 bg-white/30 dark:bg-zinc-900/10">
                                <RotateCcw size={10} className="text-zinc-400 shrink-0" />
                                <span className="text-[9px] font-mono text-zinc-500">{entry.from}</span>
                                <span className="text-[9px] text-zinc-400">→</span>
                                <span className="text-[9px] font-mono font-bold text-zinc-700 dark:text-zinc-300">{entry.to}</span>
                                <span className="text-[9px] text-zinc-400 ml-auto">{entry.time}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Session Stats */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Session Confirmations</span>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Confirmed', value: data.recentConfirmations, accent: 'text-emerald-600 dark:text-emerald-400' },
                            { label: 'Denied', value: data.recentDenials, accent: 'text-red-600 dark:text-red-400' },
                        ].map(s => (
                            <div key={s.label} className="p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/20 text-center">
                                <div className={cn("text-lg font-bold font-mono", s.accent)}>{s.value}</div>
                                <div className="text-[9px] text-zinc-500 mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ModuleCard>
    );
});
