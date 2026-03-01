'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { DatabaseBackup, RefreshCw, Loader2, AlertTriangle, HardDrive, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserStatusView {
    persistenceEnabled: boolean;
    contextDirSize: number;
    lastCleanup: string | null;
}

function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatCleanupDate(ts: string | null) {
    if (!ts) return 'Never';
    try {
        const d = new Date(ts);
        const diff = Date.now() - d.getTime();
        const h = Math.floor(diff / 3600000);
        if (h < 1) return 'Just now';
        if (h < 24) return `${h}h ago`;
        const days = Math.floor(h / 24);
        return `${days}d ago`;
    } catch {
        return ts;
    }
}

export const ContextPersistencePanel = memo(function ContextPersistencePanel() {
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
            <ModuleCard title="Context Persistence" description="Browser context state" icon={DatabaseBackup} className="h-[40rem] flex flex-col">
                <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    if (error || !data) {
        return (
            <ModuleCard title="Context Persistence" description="Browser context state" icon={DatabaseBackup} className="h-[40rem] flex flex-col">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
                    <AlertTriangle size={20} className="text-amber-500" />
                    <p className="text-xs text-zinc-500">Fetch failed</p>
                    <button onClick={fetch_} className="text-[10px] text-blue-600 hover:underline">Retry</button>
                </div>
            </ModuleCard>
        );
    }

    return (
        <ModuleCard
            title="Context Persistence"
            description={`${data.persistenceEnabled ? 'Enabled' : 'Disabled'} · ${formatBytes(data.contextDirSize)}`}
            icon={DatabaseBackup}
            className="h-[40rem] flex flex-col"
            actions={
                <button onClick={fetch_} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
                    <RefreshCw size={13} />
                </button>
            }
        >
            <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-4">

                {/* Persistence Toggle Status (Read-only) */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center gap-2">
                        {data.persistenceEnabled
                            ? <ToggleRight size={16} className="text-emerald-500" />
                            : <ToggleLeft size={16} className="text-zinc-400" />
                        }
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Context Persistence</span>
                    </div>
                    <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                        data.persistenceEnabled
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                            : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    )}>
                        {data.persistenceEnabled ? 'ON' : 'OFF'}
                    </span>
                </div>

                {/* Storage Stats */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Storage</span>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-1.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/40 bg-white/30 dark:bg-zinc-900/10">
                            <div className="flex items-center gap-2">
                                <HardDrive size={11} className="text-blue-500" />
                                <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Context Directory Size</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                                {formatBytes(data.contextDirSize)}
                            </span>
                        </div>

                        {/* Size progress (max 200MB threshold) */}
                        <div>
                            <div className="flex items-center justify-between mb-1 text-[9px] text-zinc-400">
                                <span>0 B</span>
                                <span>200 MB threshold</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        data.contextDirSize > 150_000_000 ? "bg-red-400" :
                                            data.contextDirSize > 50_000_000 ? "bg-amber-400" :
                                                "bg-blue-400"
                                    )}
                                    style={{ width: `${Math.min((data.contextDirSize / 200_000_000) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Last Cleanup */}
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Cleanup History</span>
                    <div className="flex items-center gap-2 p-1.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/40 bg-white/30 dark:bg-zinc-900/10">
                        <Clock size={11} className="text-zinc-400 shrink-0" />
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">Last cleanup:</span>
                        <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 ml-auto">
                            {formatCleanupDate(data.lastCleanup)}
                        </span>
                    </div>
                </div>

                {/* Info note */}
                <div className="p-2.5 rounded-lg bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Browser context persistence stores cookies, localStorage, and session data between browser agent runs. Configure via <code className="font-mono text-blue-600 dark:text-blue-400 text-[9px]">browserContextPersistence</code> in settings.
                    </p>
                </div>
            </div>
        </ModuleCard>
    );
});
