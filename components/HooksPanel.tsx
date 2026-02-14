'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
    Zap,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    PlayCircle,
    PauseCircle,
    Search,
    Filter,
    ChevronDown,
    Terminal,
    MessageSquare,
    Shield,
    Sparkles,
    X,
    ExternalLink,
    Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PanelHeader } from './sidebar/PanelHeader';

export type HookEventType =
    | 'tool_call'
    | 'tool_result'
    | 'confirmation_request'
    | 'confirmation_response'
    | 'ask_user'
    | 'ask_user_response'
    | 'content'
    | 'thought'
    | 'error'
    | 'finished'
    | 'max_turns'
    | 'session_start'
    | 'session_end'
    // Legacy types for backward compatibility
    | 'start'
    | 'end';

export interface HookEvent {
    id: string;
    type: HookEventType;
    name: string;
    timestamp: number;
    data?: Record<string, unknown>;
    outcome?: {
        decision?: 'approve' | 'deny' | 'allow' | 'cancel' | 'proceed' | 'pending';
        error?: string;
        duration?: number;
    };
    duration?: number;
    toolName?: string;
    serverName?: string;
    correlationId?: string;
    sessionId?: string;
}

interface HooksPanelProps {
    events: HookEvent[];
    className?: string;
    onEventClick?: (event: HookEvent) => void;
    onClear?: () => void;
    maxHeight?: string;
}

const EVENT_TYPE_CONFIG: Record<HookEventType, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
}> = {
    tool_call: {
        icon: Terminal,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        label: 'Tool Call'
    },
    tool_result: {
        icon: Terminal,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        label: 'Tool Result'
    },
    confirmation_request: {
        icon: Shield,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        label: 'Confirm'
    },
    confirmation_response: {
        icon: Shield,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        label: 'Confirm Response'
    },
    ask_user: {
        icon: MessageSquare,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        label: 'Ask User'
    },
    ask_user_response: {
        icon: MessageSquare,
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/20',
        label: 'User Response'
    },
    content: {
        icon: Sparkles,
        color: 'text-gray-300',
        bgColor: 'bg-gray-500/20',
        label: 'Content'
    },
    thought: {
        icon: Cpu,
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/20',
        label: 'Thinking'
    },
    error: {
        icon: AlertCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        label: 'Error'
    },
    finished: {
        icon: CheckCircle2,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        label: 'Finished'
    },
    max_turns: {
        icon: PauseCircle,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        label: 'Max Turns'
    },
    session_start: {
        icon: PlayCircle,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        label: 'Session Start'
    },
    session_end: {
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        label: 'Session End'
    },
    // Legacy mappings
    start: {
        icon: Terminal,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        label: 'Tool Call'
    },
    end: {
        icon: Terminal,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        label: 'Tool Result'
    }
};

const FILTER_OPTIONS: { value: HookEventType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Events' },
    { value: 'tool_call', label: 'Tool Calls' },
    { value: 'tool_result', label: 'Tool Results' },
    { value: 'confirmation_request', label: 'Confirmations' },
    { value: 'ask_user', label: 'Ask User' },
    { value: 'error', label: 'Errors' },
    { value: 'thought', label: 'Thinking' }
];

export function HooksPanel({
    events,
    className,
    onEventClick,
    onClear,
    maxHeight = 'h-96'
}: HooksPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<HookEventType | 'all'>('all');
    const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);

    const filteredEvents = useMemo(() => {
        return events
            .filter(event => {
                if (typeFilter !== 'all' && event.type !== typeFilter) {
                    return false;
                }
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    return (
                        event.name.toLowerCase().includes(query) ||
                        event.toolName?.toLowerCase().includes(query) ||
                        event.serverName?.toLowerCase().includes(query) ||
                        JSON.stringify(event.data).toLowerCase().includes(query)
                    );
                }
                return true;
            })
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [events, typeFilter, searchQuery]);

    const eventStats = useMemo(() => {
        const stats: Record<HookEventType, number> = {} as Record<HookEventType, number>;
        events.forEach(event => {
            stats[event.type] = (stats[event.type] || 0) + 1;
        });
        return stats;
    }, [events]);

    const toggleExpand = useCallback((id: string) => {
        setExpandedEvents(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
    };

    const renderEventContent = (event: HookEvent) => {
        const config = EVENT_TYPE_CONFIG[event.type];
        const Icon = config?.icon || Zap;
        const isExpanded = expandedEvents.has(event.id);

        return (
            <div
                key={event.id}
                className={cn(
                    "group relative rounded-lg border border-primary/10 bg-card/50 hover:bg-card/80 transition-all duration-200",
                    "hover:border-primary/30 hover:shadow-sm"
                )}
            >
                {/* Timeline indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg" />

                <div className="p-3">
                    {/* Header */}
                    <div
                        className="flex items-start justify-between gap-2 cursor-pointer"
                        onClick={() => toggleExpand(event.id)}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                                "flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
                                config?.bgColor
                            )}>
                                <Icon className={cn("w-4 h-4", config?.color)} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-foreground truncate">
                                        {event.toolName || event.name}
                                    </span>
                                    {event.serverName && (
                                        <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground truncate">
                                            {event.serverName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span>{config?.label || event.type}</span>
                                    <span>•</span>
                                    <span className="font-mono">{formatTime(event.timestamp)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {event.duration !== undefined && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                                    {formatDuration(event.duration)}
                                </span>
                            )}
                            {event.outcome?.decision && (
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold",
                                    event.outcome.decision === 'approve' || event.outcome.decision === 'allow' || event.outcome.decision === 'proceed'
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : event.outcome.decision === 'deny' || event.outcome.decision === 'cancel'
                                            ? "bg-red-500/10 text-red-500"
                                            : "bg-amber-500/10 text-amber-500"
                                )}>
                                    {event.outcome.decision}
                                </span>
                            )}
                            <ChevronDown className={cn(
                                "w-4 h-4 text-muted-foreground transition-transform",
                                isExpanded ? "rotate-180" : ""
                            )} />
                        </div>
                    </div>

                    {/* Expandable content */}
                    {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-primary/10 space-y-2">
                            {/* Correlation ID */}
                            {event.correlationId && (
                                <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-muted-foreground">ID:</span>
                                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-foreground">
                                        {event.correlationId.slice(0, 8)}...
                                    </code>
                                </div>
                            )}

                            {/* Data preview */}
                            {event.data && Object.keys(event.data).length > 0 && (
                                <div>
                                    <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">
                                        Data
                                    </div>
                                    <div className="bg-muted/50 rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto max-h-40">
                                        {JSON.stringify(event.data, null, 2)}
                                    </div>
                                </div>
                            )}

                            {/* Error message */}
                            {event.outcome?.error && (
                                <div className="flex items-start gap-2 text-[10px] text-red-400">
                                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span>{event.outcome.error}</span>
                                </div>
                            )}

                            {/* Action buttons */}
                            {onEventClick && (
                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEventClick(event);
                                        }}
                                        className="text-[10px] px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                                    >
                                        View Details
                                    </button>
                                    {event.data && typeof event.data === 'object' && 'filePath' in event.data && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Handle file navigation
                                            }}
                                            className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors flex items-center gap-1"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Open File
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("flex flex-col h-full bg-card/30 rounded-lg border border-primary/10", className)}>
            <PanelHeader
                title="Hooks Inspector"
                icon={Zap}
                badge={filteredEvents.length}
                actions={
                    <div className="flex items-center gap-1">
                        {onClear && events.length > 0 && (
                            <button
                                onClick={onClear}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title="Clear events"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                }
            />

            <div className="p-3 border-b border-primary/10 space-y-2">
                {/* Search bar */}
                <div className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-all" />
                    <input
                        type="text"
                        placeholder="Search hooks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-8 pl-8 pr-8 text-xs bg-muted/30 border border-primary/10 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50 transition-all font-mono"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Filter toggle & stats */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md transition-all font-medium",
                            showFilters ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        <Filter className="w-3 h-3" />
                        Filter
                        {typeFilter !== 'all' && (
                            <span className="w-1 h-1 rounded-full bg-current" />
                        )}
                    </button>

                    <div className="flex items-center gap-2">
                        {Object.entries(eventStats).slice(0, 3).map(([type, count]) => {
                            const config = EVENT_TYPE_CONFIG[type as HookEventType];
                            if (!config || count === 0) return null;
                            return (
                                <div
                                    key={type}
                                    className="flex items-center gap-1 text-[9px] text-muted-foreground/80 font-mono"
                                >
                                    <config.icon className={cn("w-2.5 h-2.5", config.color)} />
                                    <span>{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Filter dropdown */}
                {showFilters && (
                    <div className="pt-2 flex flex-wrap gap-1 border-t border-primary/5">
                        {FILTER_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                onClick={() => setTypeFilter(option.value)}
                                className={cn(
                                    "text-[9px] px-2 py-0.5 rounded-full transition-all border uppercase tracking-tighter font-bold",
                                    typeFilter === option.value
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted/50 border-transparent text-muted-foreground hover:border-muted-foreground/30"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Events list */}
            <div className={cn("flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin", maxHeight)}>
                {filteredEvents.length > 0 ? (
                    filteredEvents.map(renderEventContent)
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 opacity-30 grayscale">
                        {searchQuery || typeFilter !== 'all' ? (
                            <>
                                <Search className="w-10 h-10 mb-2" />
                                <p className="text-xs uppercase tracking-widest font-bold">No matches</p>
                                <p className="text-[10px] text-muted-foreground mt-1 text-center px-4">
                                    Try adjusting your search query or filters
                                </p>
                            </>
                        ) : (
                            <>
                                <Zap className="w-10 h-10 mb-2" />
                                <p className="text-xs uppercase tracking-widest font-bold">No active hooks</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Compact version for inline display
export function HooksPanelCompact({
    events,
    className,
    maxItems = 5
}: {
    events: HookEvent[];
    className?: string;
    maxItems?: number;
}) {
    const recentEvents = useMemo(() => {
        return events
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, maxItems);
    }, [events, maxItems]);

    return (
        <div className={cn("flex flex-col gap-1", className)}>
            {recentEvents.map((event) => {
                const config = EVENT_TYPE_CONFIG[event.type];
                const Icon = config?.icon || Zap;

                return (
                    <div
                        key={event.id}
                        className="flex items-center gap-2 text-[10px]"
                    >
                        <div className={cn(
                            "w-4 h-4 rounded flex items-center justify-center flex-shrink-0",
                            config?.bgColor
                        )}>
                            <Icon className={cn("w-2.5 h-2.5", config?.color)} />
                        </div>
                        <span className="truncate text-foreground">
                            {event.toolName || event.name}
                        </span>
                        {event.duration !== undefined && (
                            <span className="text-muted-foreground ml-auto font-mono">
                                {event.duration}ms
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
