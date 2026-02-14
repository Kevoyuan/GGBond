
'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    CircleDashed,
    AlertCircle,
    ChevronDown,
    Clock,
    Zap,
    Activity,
    Terminal,
    Database,
    Globe,
    Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HookEvent } from './HooksPanel';

interface ExecutionStatusBlockProps {
    hooks: HookEvent[];
    defaultExpanded?: boolean;
}

// Helper to determine icon based on hook name
const getIconForHook = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('terminal') || lower.includes('command')) return Terminal;
    if (lower.includes('db') || lower.includes('memory')) return Database;
    if (lower.includes('net') || lower.includes('http') || lower.includes('fetch')) return Globe;
    if (lower.includes('ai') || lower.includes('model')) return Cpu;
    return Activity;
};

// Helper to format duration
const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

export function ExecutionStatusBlock({ hooks, defaultExpanded = false }: ExecutionStatusBlockProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Group hooks into execution steps
    const steps = useMemo(() => {
        const groups: Map<string, { start?: HookEvent; end?: HookEvent }> = new Map();

        // Reverse to process latest first if we want latest at top, but usually timeline is top-down
        // We'll process in order received
        hooks.forEach(event => {
            const key = `${event.name}-${event.id}`;
            const existing = groups.get(key) || {};
            // Support both legacy 'start' type and new 'tool_call' type
            if (event.type === 'start' || event.type === 'tool_call') {
                existing.start = event;
            } else {
                existing.end = event;
            }
            groups.set(key, existing);
        });

        return Array.from(groups.values())
            .filter(g => g.start)
            .sort((a, b) => (a.start?.timestamp || 0) - (b.start?.timestamp || 0));
    }, [hooks]);

    if (steps.length === 0) return null;

    const activeStep = steps.find(s => !s.end);
    const hasError = steps.some(s => s.end?.outcome?.error);
    const isComplete = !activeStep && steps.length > 0;

    // Determine status color/theme
    const statusColor = hasError
        ? 'text-red-500 border-red-500/20 bg-red-500/5'
        : isComplete
            ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
            : 'text-blue-500 border-blue-500/20 bg-blue-500/5';

    return (
        <div className={cn(
            "rounded-xl border backdrop-blur-sm overflow-hidden transition-all duration-300 my-2",
            statusColor
        )}>
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-sm",
                        hasError ? "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                            : isComplete ? "bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                                : "bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 animate-pulse"
                    )}>
                        {hasError ? <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            : isComplete ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                : <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>

                    <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold flex items-center gap-2">
                            {hasError ? "Execution Failed"
                                : isComplete ? "Execution Complete"
                                    : "Processing Request..."}
                            <span className="text-xs font-normal opacity-60">
                                ({steps.length} steps)
                            </span>
                        </span>
                        {activeStep && (
                            <span className="text-xs opacity-70 flex items-center gap-1.5 animate-pulse">
                                <CircleDashed className="w-3 h-3 animate-spin" />
                                {activeStep.start?.name}
                            </span>
                        )}
                    </div>
                </div>

                <ChevronDown className={cn("w-4 h-4 transition-transform duration-300 opacity-50", isExpanded && "rotate-180")} />
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-inherit/10">
                            {steps.map((step, idx) => {
                                const isRunning = !step.end;
                                const isFailed = step.end?.outcome?.error;
                                const Icon = getIconForHook(step.start!.name);
                                const duration = step.end ? (step.end.duration || (step.end.timestamp - step.start!.timestamp)) : 0;

                                return (
                                    <motion.div
                                        key={`${step.start!.id}-${idx}`}
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className={cn(
                                            "relative pl-6 group/item py-1 rounded-lg transition-colors duration-300",
                                            isRunning && "bg-gradient-to-r from-blue-500/5 via-transparent to-transparent"
                                        )}
                                    >
                                        {/* Visual Connector Line with Gradient Flow */}
                                        {idx !== steps.length - 1 && (
                                            <div className="absolute left-[11px] top-6 bottom-[-12px] w-[2px] overflow-hidden group-last/item:hidden">
                                                <div className="absolute inset-0 bg-border/40" />
                                                {isRunning && (
                                                    <motion.div
                                                        className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/50 to-transparent"
                                                        animate={{ top: ["-100%", "100%"] }}
                                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Status Dot with Ripple Effect */}
                                        <div className="absolute left-0 top-1.5 z-10">
                                            {isRunning && (
                                                <span className="absolute inset-0 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] bg-blue-500/30 dark:bg-blue-400/30" />
                                            )}
                                            <div className={cn(
                                                "relative w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center bg-background transition-all duration-300",
                                                isFailed ? "border-red-500 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
                                                    : isRunning ? "border-blue-500 text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)] scale-110"
                                                        : "border-emerald-500/50 text-emerald-500"
                                            )}>
                                                {isFailed ? <AlertCircle className="w-3 h-3" />
                                                    : isRunning ? <div className="w-1.5 h-1.5 bg-current rounded-full" />
                                                        : <CheckCircle2 className="w-3 h-3" />}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Icon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                                                    <span className={cn(
                                                        "text-sm font-medium truncate",
                                                        isRunning ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {step.start!.name}
                                                    </span>
                                                </div>
                                                {step.end && (
                                                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 shrink-0 bg-muted/50 px-1.5 py-0.5 rounded">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {formatDuration(duration)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Optional Data View - Only show if interesting data exists */}
                                            {step.start?.data && Object.keys(step.start.data).length > 0 && (
                                                <div className="mt-1 text-[10px] font-mono text-muted-foreground/80 bg-muted/30 p-2 rounded border border-border/20 overflow-x-auto">
                                                    {JSON.stringify(step.start.data).slice(0, 100)}
                                                    {JSON.stringify(step.start.data).length > 100 && '...'}
                                                </div>
                                            )}

                                            {/* Error Message */}
                                            {isFailed && step.end?.outcome && (
                                                <div className="mt-1 text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                                                    {(step.end.outcome.error as any)?.message || String(step.end.outcome.error) || 'Unknown error occurred'}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
