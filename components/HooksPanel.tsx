
'use client';

import React, { useMemo } from 'react';
import {
    Zap,
    Clock,
    CheckCircle2,
    XCircle,
    Activity,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HookEvent {
    id: string;
    name: string;
    type: 'start' | 'end';
    timestamp: number;
    data?: any;
    outcome?: any;
    duration?: number;
    hookName?: string;
}

interface HooksPanelProps {
    events: HookEvent[];
    className?: string;
}

export function HooksPanel({ events, className }: HooksPanelProps) {
    // Group start and end events
    const hookGroups = useMemo(() => {
        const groups: Map<string, { start?: HookEvent; end?: HookEvent }> = new Map();

        events.forEach(event => {
            const key = `${event.name}-${event.id}`;
            const existing = groups.get(key) || {};
            if (event.type === 'start') {
                existing.start = event;
            } else {
                existing.end = event;
            }
            groups.set(key, existing);
        });

        return Array.from(groups.values())
            .filter(g => g.start)
            .sort((a, b) => (b.start?.timestamp || 0) - (a.start?.timestamp || 0));
    }, [events]);

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            <div className="p-3 border-b flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-yellow-500" />
                    Hooks Inspector
                </h4>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono">
                    {hookGroups.length} Active
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {hookGroups.map((group, i) => (
                    <div key={i} className="relative pl-4 border-l-2 border-primary/20 hover:border-primary/40 transition-colors py-1">
                        {/* Timeline Dot */}
                        <div className={cn(
                            "absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center",
                            group.end ? "bg-emerald-500" : "bg-blue-500 animate-pulse"
                        )}>
                            {group.end ? <CheckCircle2 className="w-2.5 h-2.5 text-white" /> : <Activity className="w-2.5 h-2.5 text-white" />}
                        </div>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{group.start?.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    {new Date(group.start?.timestamp || 0).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>

                            {group.end && (
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{group.end.duration || (group.end.timestamp - (group.start?.timestamp || 0))}ms</span>
                                    {group.end.outcome?.decision && (
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-sm text-[9px] uppercase font-bold",
                                            group.end.outcome.decision === 'approve' || group.end.outcome.decision === 'allow'
                                                ? "bg-emerald-500/10 text-emerald-500"
                                                : "bg-red-500/10 text-red-500"
                                        )}>
                                            {group.end.outcome.decision}
                                        </span>
                                    )}
                                </div>
                            )}

                            {group.start?.data && (
                                <div className="mt-1 bg-muted/30 rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
                                    {JSON.stringify(group.start.data, null, 2)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {hookGroups.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 opacity-30 grayscale">
                        <Zap className="w-12 h-12 mb-2" />
                        <p className="text-xs uppercase tracking-widest font-bold">No active hooks</p>
                    </div>
                )}
            </div>
        </div>
    );
}
