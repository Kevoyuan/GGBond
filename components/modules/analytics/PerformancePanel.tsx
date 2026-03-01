'use client';

import React, { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Activity, Loader2, RefreshCw, TrendingUp, AlertTriangle, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';

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

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
    visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { stiffness: 100, damping: 20 }
    }
};

export const PerformancePanel = memo(function PerformancePanel() {
    const [data, setData] = useState<TelemetryData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTelemetry = useCallback(() => {
        setLoading(true);
        fetch('/api/telemetry')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchTelemetry(); }, [fetchTelemetry]);

    // calculate maximum tokens across all models to establish 100% width baseline
    const maxTokensPerModel = useMemo(() => {
        if (!data?.tokensByModel) return 1;
        let max = 1;
        Object.values(data.tokensByModel).forEach(t => {
            const sum = t.input + t.output;
            if (sum > max) max = sum;
        });
        return max;
    }, [data?.tokensByModel]);

    if (loading) {
        return (
            <ModuleCard title="Performance" description="System Telemetry" icon={Activity}>
                <div className="flex h-full items-center justify-center py-12">
                    <Loader2 size={18} className="animate-spin text-zinc-400" />
                </div>
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
            <ModuleCard title="Performance" description="System Telemetry" icon={Activity}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex h-full flex-col items-center justify-center text-center py-12"
                >
                    <Activity size={24} className="mb-3 text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
                    <div className="text-sm font-medium text-zinc-500">Awaiting Telemetry Data</div>
                    <div className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-zinc-400">
                        Initiate a request to monitor agent performance. Data syncs via local DB if direct telemetry is disabled.
                    </div>
                </motion.div>
            </ModuleCard>
        );
    }

    const s = data.summary;
    const topTools = Object.entries(data.toolsByName)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5);

    return (
        <ModuleCard
            title="Performance"
            description={`${data.totalEvents} captured ops`}
            icon={Activity}
            className="h-[48rem]"
            actions={
                <div className="flex items-center gap-3">
                    <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-medium tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${data.dataSource === 'db_fallback'
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/5'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/5'
                            }`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${data.dataSource === 'db_fallback' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {data.dataSource === 'db_fallback' ? 'DB SYNC' : 'LIVE'}
                    </motion.div>
                    <button
                        onClick={fetchTelemetry}
                        className="group flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200/50 bg-white/50 text-zinc-500 transition-all hover:bg-zinc-100 dark:border-zinc-800/50 dark:bg-zinc-900/50 dark:hover:bg-zinc-800 active:scale-[0.96]"
                    >
                        <RefreshCw size={12} className="transition-transform group-hover:rotate-180" />
                    </button>
                </div>
            }
        >
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex h-full flex-col gap-5 pt-1 overflow-y-auto pr-2"
            >
                {/* Latency Matrix */}
                <div className="grid grid-cols-3 gap-2 shrink-0">
                    {[
                        { label: 'Avg API', value: s.avgApiLatencyMs },
                        { label: 'P95 API', value: s.p95ApiLatencyMs },
                        { label: 'Avg Tool', value: s.avgToolLatencyMs }
                    ].map((metric, i) => (
                        <motion.div
                            key={metric.label}
                            variants={itemVariants}
                            className="flex flex-col items-center justify-center rounded-lg border border-zinc-200/50 bg-zinc-50/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-zinc-800/50 dark:bg-zinc-900/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                        >
                            <span className="font-mono text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                                {metric.value}
                                <span className="ml-0.5 text-xs text-zinc-400 opacity-60">ms</span>
                            </span>
                            <span className="mt-0.5 text-[10px] font-medium tracking-wide text-zinc-500">{metric.label}</span>
                        </motion.div>
                    ))}
                </div>

                {/* Volume Stats */}
                <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2 px-1 py-1">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            <TrendingUp size={12} className="text-emerald-500" strokeWidth={2.5} />
                            {s.totalApiRequests}
                        </div>
                        <span className="text-[10px] font-medium text-zinc-500">API Calls</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-r border-zinc-200/50 dark:border-zinc-800/50">
                        <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            <Wrench size={12} className="text-blue-500" strokeWidth={2.5} />
                            {s.totalToolCalls}
                        </div>
                        <span className="text-[10px] font-medium text-zinc-500">Tool Execs</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            <AlertTriangle size={12} className={s.totalApiErrors > 0 ? 'text-red-500' : 'text-zinc-300 dark:text-zinc-700'} strokeWidth={2.5} />
                            {s.totalApiErrors}
                        </div>
                        <span className="text-[10px] font-medium text-zinc-500">Exceptions</span>
                    </div>
                </motion.div>

                {/* Top Tools Distribution */}
                {topTools.length > 0 && (
                    <motion.div variants={itemVariants} className="flex flex-col gap-3 rounded-lg border border-zinc-200/50 bg-zinc-50/30 p-3 dark:border-zinc-800/50 dark:bg-zinc-900/20">
                        <div className="flex items-center justify-between border-b border-zinc-200/50 pb-2 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold tracking-wider text-zinc-500">ACTIVE INSTRUMENTS</span>
                            <Activity size={14} className="text-zinc-500" />
                        </div>
                        <div className="flex flex-col gap-3 pt-1">
                            {topTools.map(([name, info]) => {
                                const successRate = info.count > 0 ? (info.success / info.count * 100) : 100;
                                return (
                                    <div key={name} className="group relative flex items-center justify-between gap-3 text-xs">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <span className="truncate font-mono text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors group-hover:text-zinc-900 dark:group-hover:text-zinc-200">
                                                {name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex h-2 w-16 items-center rounded-full bg-zinc-200/50 p-[1px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.06)] dark:bg-zinc-800/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                                <div className="flex h-full w-full overflow-hidden rounded-full gap-[1px]">
                                                    <motion.div
                                                        initial={{ flexBasis: '0%' }}
                                                        animate={{ flexBasis: `${successRate}%` }}
                                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                                        style={{ willChange: 'flex-basis' }}
                                                        className={`h-full shrink-0 ${successRate < 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex w-14 justify-end gap-1.5 font-mono text-[10px] text-zinc-500">
                                                <span>{info.count}x</span>
                                                <span className="text-zinc-400 opacity-50">+</span>
                                                <span>{Math.round(info.avgLatency)}ms</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Token Flow IO Matrix (Redesigned Bar Chart) */}
                {Object.keys(data.tokensByModel).length > 0 && (
                    <motion.div variants={itemVariants} className="flex flex-col gap-3 rounded-lg border border-zinc-200/50 bg-zinc-50/30 p-3 dark:border-zinc-800/50 dark:bg-zinc-900/20">
                        <div className="flex items-center justify-between mb-1 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-purple-500" />
                                <span className="text-xs font-semibold tracking-wider text-zinc-500">I/O DISTRIBUTION</span>
                            </div>
                            <div className="flex gap-3 text-[10px] font-medium text-zinc-400">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Input</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Output</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2.5 pt-1">
                            {Object.entries(data.tokensByModel).map(([model, tokens]) => {
                                const iPct = maxTokensPerModel > 0 ? (tokens.input / maxTokensPerModel) * 100 : 0;
                                const oPct = maxTokensPerModel > 0 ? (tokens.output / maxTokensPerModel) * 100 : 0;

                                return (
                                    <div key={model} className="flex flex-col gap-2 group">
                                        <div className="flex justify-between items-end">
                                            <span className="truncate font-mono text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors group-hover:text-zinc-900 dark:group-hover:text-zinc-200">{model}</span>
                                            <div className="flex gap-2 font-mono text-[10px]">
                                                <span className="text-blue-500/80">{(tokens.input / 1000).toFixed(1)}k</span>
                                                <span className="text-zinc-400 opacity-50">+</span>
                                                <span className="text-emerald-500/80">{(tokens.output / 1000).toFixed(1)}k</span>
                                            </div>
                                        </div>
                                        {/* Liquid Glass Track */}
                                        <div className="relative flex h-2 w-full items-center gap-[1px] rounded-full bg-zinc-200/50 p-[1px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.06)] dark:bg-zinc-800/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                                            <motion.div
                                                initial={{ flexBasis: '0%' }}
                                                animate={{ flexBasis: `${Math.max(iPct, 1)}%` }}
                                                transition={{ duration: 0.8, ease: "easeOut" }}
                                                style={{ willChange: 'flex-basis' }}
                                                className="h-full rounded-full bg-blue-500 shrink-0"
                                            />
                                            <motion.div
                                                initial={{ flexBasis: '0%' }}
                                                animate={{ flexBasis: `${Math.max(oPct, 1)}%` }}
                                                transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                                                style={{ willChange: 'flex-basis' }}
                                                className="h-full rounded-full bg-emerald-500 shrink-0"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </ModuleCard>
    );
});
