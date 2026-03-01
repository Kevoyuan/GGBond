'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Shield, RefreshCw, Loader2, AlertTriangle, CheckCircle, Globe, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GovernanceSummaryView {
    approvalMode: string;
    policySources: ('global' | 'workspace')[];
    conflictCount: number;
    recentConfirmations: number;
    recentDenials: number;
    topDeniedTools: string[];
    activeModel: string;
    activeProfile: string;
    policyTiers: string[];
}

const APPROVAL_MODE_META: Record<string, { label: string; color: string; desc: string }> = {
    default: { label: 'Default', color: 'blue', desc: 'Confirms writes, allows reads' },
    autoEdit: { label: 'AutoEdit', color: 'emerald', desc: 'Auto-confirms edits' },
    plan: { label: 'Plan', color: 'amber', desc: 'Plans before executing' },
    yolo: { label: 'YOLO', color: 'red', desc: 'All tools without confirmation' },
    unknown: { label: 'Unknown', color: 'zinc', desc: 'Could not read approval mode' },
};

export const PolicyHealthPanel = memo(function PolicyHealthPanel() {
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
            <ModuleCard title="Policy Health" description="Approval & policy status" icon={Shield} className="h-[30rem] flex flex-col">
                <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    if (error || !data) {
        return (
            <ModuleCard title="Policy Health" description="Approval & policy status" icon={Shield} className="h-[30rem] flex flex-col">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <p className="text-xs text-zinc-500">Fetch failed</p>
                    <button onClick={fetch_} className="text-[10px] text-blue-600 hover:underline">Retry</button>
                </div>
            </ModuleCard>
        );
    }

    const mode = APPROVAL_MODE_META[data.approvalMode] ?? APPROVAL_MODE_META.unknown;
    const totalApprovals = data.recentConfirmations + data.recentDenials;
    const denyRate = totalApprovals > 0 ? Math.round((data.recentDenials / totalApprovals) * 100) : 0;

    return (
        <ModuleCard
            title="Policy Health"
            description={`Approval: ${mode.label} · ${data.policySources.length} sources`}
            icon={Shield}
            className="h-[30rem] flex flex-col"
            actions={
                <button onClick={fetch_} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
                    <RefreshCw size={13} />
                </button>
            }
        >
            <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-4">

                {/* Approval Mode Badge */}
                <div className="p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Approval Mode</span>
                        {data.conflictCount > 0 && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                <AlertTriangle size={9} />
                                {data.conflictCount} conflict{data.conflictCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-bold font-mono border",
                            mode.color === 'blue' && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
                            mode.color === 'emerald' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
                            mode.color === 'amber' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
                            mode.color === 'red' && "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
                            mode.color === 'zinc' && "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
                        )}>
                            {mode.label.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{mode.desc}</span>
                    </div>
                </div>

                {/* Policy Sources */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Policy Sources</span>
                    <div className="space-y-1.5">
                        {data.policySources.length === 0 ? (
                            <p className="text-[10px] text-zinc-400 italic">No policy files detected</p>
                        ) : data.policySources.map(src => (
                            <div key={src} className="flex items-center gap-2 p-1.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/40 bg-white/30 dark:bg-zinc-900/10">
                                {src === 'global' ? <Globe size={11} className="text-blue-500 shrink-0" /> : <Folder size={11} className="text-amber-500 shrink-0" />}
                                <span className="text-[10px] font-bold font-mono text-zinc-700 dark:text-zinc-300 capitalize">{src}</span>
                                <CheckCircle size={10} className="text-emerald-500 ml-auto" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Policy Tiers */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Active Policy Tiers</span>
                    <div className="flex flex-wrap gap-1.5">
                        {data.policyTiers.map(tier => (
                            <span key={tier} className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50">
                                {tier}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Approval Stats */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Approval Activity (24h)</span>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Confirmed', value: data.recentConfirmations, color: 'emerald' },
                            { label: 'Denied', value: data.recentDenials, color: 'red' },
                            { label: 'Deny Rate', value: `${denyRate}%`, color: denyRate > 30 ? 'red' : 'zinc' },
                        ].map(stat => (
                            <div key={stat.label} className="p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/20 text-center">
                                <div className={cn(
                                    "text-base font-bold font-mono",
                                    stat.color === 'emerald' && "text-emerald-600 dark:text-emerald-400",
                                    stat.color === 'red' && "text-red-600 dark:text-red-400",
                                    stat.color === 'zinc' && "text-zinc-700 dark:text-zinc-300",
                                )}>
                                    {stat.value}
                                </div>
                                <div className="text-[9px] text-zinc-500 mt-0.5 font-medium">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Denied Tools */}
                {data.topDeniedTools.length > 0 && (
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Top Denied Tools</span>
                        <div className="space-y-1">
                            {data.topDeniedTools.map(tool => (
                                <div key={tool} className="flex items-center gap-2 px-2 py-1 rounded-md bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                    <span className="text-[10px] font-mono text-red-700 dark:text-red-400 font-bold">{tool}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ModuleCard>
    );
});
