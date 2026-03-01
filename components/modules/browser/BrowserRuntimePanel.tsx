'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Globe, RefreshCw, Loader2, AlertTriangle, CheckCircle, XCircle, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserStatusView {
    available: boolean;
    executableSource: 'env' | 'config' | 'default' | 'none';
    executablePath: string;
    successRate: number;
    avgLatencyMs: number;
    persistenceEnabled: boolean;
    contextDirSize: number;
    lastCleanup: string | null;
}

function SuccessRateBar({ value }: { value: number }) {
    const color = value >= 80 ? 'bg-emerald-400 dark:bg-emerald-500' :
        value >= 50 ? 'bg-amber-400 dark:bg-amber-500' :
            'bg-red-400 dark:bg-red-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
            </div>
            <span className={cn("text-xs font-mono font-bold w-8 text-right",
                value >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                    value >= 50 ? "text-amber-600 dark:text-amber-400" :
                        "text-red-600 dark:text-red-400"
            )}>{value}%</span>
        </div>
    );
}

const SOURCE_LABELS: Record<string, string> = {
    env: 'ENV',
    config: 'CONFIG',
    default: 'AUTO',
    none: 'NONE',
};
const SOURCE_COLORS: Record<string, string> = {
    env: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    config: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    default: 'text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700',
    none: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};

export const BrowserRuntimePanel = memo(function BrowserRuntimePanel() {
    const [data, setData] = useState<BrowserStatusView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetch_ = () => {
        setLoading(true);
        setError(false);
        fetch('/api/browser/status')
            .then(r => r.json())
            .then(setData)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch_(); }, []);

    if (loading) {
        return (
            <ModuleCard title="Browser Runtime" description="Agent availability & performance" icon={Globe} className="h-[30rem] flex flex-col">
                <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    if (error || !data) {
        return (
            <ModuleCard title="Browser Runtime" description="Agent availability & performance" icon={Globe} className="h-[30rem] flex flex-col">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <p className="text-xs text-zinc-500">Fetch failed</p>
                    <button onClick={fetch_} className="text-[10px] text-blue-600 hover:underline">Retry</button>
                </div>
            </ModuleCard>
        );
    }

    const notConfigured = data.executableSource === 'none';

    return (
        <ModuleCard
            title="Browser Runtime"
            description={data.available ? `Available · ${data.executableSource}` : 'Not configured'}
            icon={Globe}
            className="h-[30rem] flex flex-col"
            actions={
                <button onClick={fetch_} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
                    <RefreshCw size={13} />
                </button>
            }
        >
            <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-4">

                {/* Availability badge */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center gap-2">
                        {data.available
                            ? <CheckCircle size={14} className="text-emerald-500" />
                            : <XCircle size={14} className="text-red-500" />
                        }
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            {data.available ? 'Browser Agent Available' : 'Browser Not Configured'}
                        </span>
                    </div>
                    <span className={cn("text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border", SOURCE_COLORS[data.executableSource])}>
                        {SOURCE_LABELS[data.executableSource]}
                    </span>
                </div>

                {/* Executable Path */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-1.5">Executable Path</span>
                    {notConfigured ? (
                        <div className="p-2 rounded-md bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/40 dark:border-zinc-800/40 text-center">
                            <p className="text-[10px] text-zinc-400 italic">No browser executable found</p>
                            <p className="text-[9px] text-zinc-400 mt-1">Set <code className="font-mono text-blue-600 dark:text-blue-400">BROWSER_EXECUTABLE_PATH</code> or install Chrome</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/40 bg-white/30 dark:bg-zinc-900/10">
                            <Terminal size={10} className="text-zinc-400 shrink-0" />
                            <span className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400 truncate">{data.executablePath}</span>
                        </div>
                    )}
                </div>

                {/* Performance stats */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Performance</span>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] text-zinc-500">Success Rate</span>
                            </div>
                            <SuccessRateBar value={data.successRate} />
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded border border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/20">
                            <span className="text-[9px] text-zinc-500">Avg. Latency</span>
                            <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                                {data.avgLatencyMs > 0 ? `${data.avgLatencyMs}ms` : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Persistence status */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/20">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Context Persistence</span>
                    <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                        data.persistenceEnabled
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                            : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    )}>
                        {data.persistenceEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                </div>

                {!data.available && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                        <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                            Browser tools are unavailable. The experimental browser agent requires a compatible browser executable.
                        </p>
                    </div>
                )}
            </div>
        </ModuleCard>
    );
});
