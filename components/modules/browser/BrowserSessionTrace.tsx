'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Activity, RefreshCw, Loader2, MonitorPlay, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserTraceItem {
    id: string;
    timestamp: number;
    action: string;
    url: string;
    status: 'success' | 'failure' | 'timeout';
    durationMs: number;
}

function formatAgo(ts: number) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
}

const STATUS_META = {
    success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20' },
    failure: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20' },
    timeout: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' },
};

export const BrowserSessionTrace = memo(function BrowserSessionTrace() {
    const [traces, setTraces] = useState<BrowserTraceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetch_ = () => {
        setLoading(true);
        setError(false);
        fetch('/api/browser/traces')
            .then(r => r.json())
            .then(data => setTraces(Array.isArray(data) ? data : []))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch_(); }, []);

    if (loading) {
        return (
            <ModuleCard title="Session Trace" description="Browser action history" icon={Activity} className="h-[30rem] flex flex-col">
                <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    return (
        <ModuleCard
            title="Session Trace"
            description={traces.length > 0 ? `${traces.length} actions` : 'No actions recorded'}
            icon={Activity}
            className="h-[30rem] flex flex-col"
            actions={
                <button onClick={fetch_} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
                    <RefreshCw size={13} />
                </button>
            }
        >
            <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-2">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <p className="text-xs text-zinc-500">Fetch failed</p>
                        <button onClick={fetch_} className="text-[10px] text-blue-600 hover:underline">Retry</button>
                    </div>
                ) : traces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                        <MonitorPlay size={28} className="text-zinc-300 dark:text-zinc-700" />
                        <p className="text-xs font-medium text-zinc-500">No Browser Actions Yet</p>
                        <p className="text-[10px] text-zinc-400 max-w-[180px] leading-relaxed">
                            Browser agent actions will appear here when the experimental browser tool is used.
                        </p>
                    </div>
                ) : (
                    traces.map(trace => {
                        const meta = STATUS_META[trace.status] ?? STATUS_META.failure;
                        const Icon = meta.icon;
                        const hostname = (() => {
                            try { return new URL(trace.url).hostname; }
                            catch { return trace.url; }
                        })();
                        return (
                            <div key={trace.id} className={cn(
                                "group relative flex flex-col p-1.5 rounded-md border transition-all duration-200",
                                meta.bg
                            )}>
                                <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Icon size={10} className={cn(meta.color, "shrink-0")} />
                                        <span className="text-[10px] font-bold font-mono text-zinc-800 dark:text-zinc-200 truncate">{trace.action}</span>
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-500 shrink-0 ml-2">{formatAgo(trace.timestamp)}</span>
                                </div>
                                <div className="flex items-center gap-2 pl-3.5">
                                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{hostname}</span>
                                    {trace.durationMs > 0 && (
                                        <span className="text-[9px] font-mono text-zinc-400 shrink-0 border-l border-zinc-200 dark:border-zinc-700 pl-2">{trace.durationMs}ms</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </ModuleCard>
    );
});
