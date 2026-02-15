'use client';

import React, { useState, useCallback } from 'react';
import {
    ChevronRight,
    Check,
    X,
    Loader2,
    Terminal,
    FileText,
    Search,
    Globe,
    List,
    Trash2,
    Edit,
    Play
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCallBlockProps {
    toolName: string;
    args: Record<string, any>;
    status?: 'running' | 'completed' | 'failed';
    result?: string;
    duration?: string;
    onRetry?: (mode: 'once' | 'session') => void;
    onCancel?: () => void;
}

// Map tool names to Lucide icons
function getToolIconElement(toolName: string) {
    const lower = toolName.toLowerCase();
    const iconClass = "w-3.5 h-3.5 opacity-70";
    if (lower.includes('read') || lower.includes('view') || lower.includes('cat')) return <FileText className={iconClass} />;
    if (lower.includes('write') || lower.includes('create') || lower.includes('save')) return <Edit className={iconClass} />;
    if (lower.includes('edit') || lower.includes('replace') || lower.includes('update')) return <Edit className={iconClass} />;
    if (lower.includes('search') || lower.includes('grep') || lower.includes('find')) return <Search className={iconClass} />;
    if (lower.includes('browser') || lower.includes('web') || lower.includes('fetch')) return <Globe className={iconClass} />;
    if (lower.includes('list') || lower.includes('ls')) return <List className={iconClass} />;
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('rm')) return <Trash2 className={iconClass} />;
    if (lower.includes('execute') || lower.includes('bash') || lower.includes('shell') || lower.includes('run') || lower.includes('command')) return <Terminal className={iconClass} />;
    return <Play className={iconClass} />; // Default icon
}

// Map tool names to display verbs
function getToolVerb(toolName: string): string {
    const lower = toolName.toLowerCase();
    if (lower.includes('read') || lower.includes('view')) return 'Read';
    if (lower.includes('write') || lower.includes('create')) return 'Write';
    if (lower.includes('edit') || lower.includes('replace') || lower.includes('update')) return 'Edit';
    if (lower.includes('search') || lower.includes('grep') || lower.includes('find')) return 'Search';
    if (lower.includes('execute') || lower.includes('bash') || lower.includes('shell') || lower.includes('run') || lower.includes('command')) return 'Run';
    if (lower.includes('list') || lower.includes('ls')) return 'List';
    if (lower.includes('delete') || lower.includes('remove')) return 'Delete';
    return toolName;
}

// Extract the most relevant arg value (usually a file path or command)
function getToolTarget(args: Record<string, any>): string {
    // Priority: path > file > command > query > first string value
    const priorityKeys = ['path', 'file_path', 'filePath', 'file', 'filename', 'command', 'cmd', 'query', 'pattern', 'directory', 'dir'];
    for (const key of priorityKeys) {
        if (args[key] && typeof args[key] === 'string') {
            const val = args[key] as string;
            // For file paths, keep the name but maybe truncate if too long
            if (val.includes('/')) {
                const parts = val.split('/');
                return parts[parts.length - 1];
            }
            return val;
        }
    }
    // Fallback: first string value
    for (const val of Object.values(args)) {
        if (typeof val === 'string' && val.length < 80) return val;
    }
    return '';
}

export const ToolCallBlock = React.memo(function ToolCallBlock({ toolName, args, status = 'completed', result, duration, onRetry, onCancel }: ToolCallBlockProps) {
    const [expanded, setExpanded] = useState(false);

    const toggleExpanded = useCallback(() => {
        setExpanded(prev => !prev);
    }, []);

    const toolIcon = getToolIconElement(toolName);
    const verb = getToolVerb(toolName);
    const target = getToolTarget(args);

    // Summary of result (e.g., "7 lines")
    const resultLineCount = result ? result.split('\n').length : 0;
    const resultSummary = result ? `${resultLineCount} line${resultLineCount !== 1 ? 's' : ''}` : null;

    // Status Icon Logic
    let StatusIcon = Check;
    let statusColor = "text-green-500/80";

    if (status === 'running') {
        StatusIcon = Loader2;
        statusColor = "text-amber-500/80";
    } else if (status === 'failed') {
        StatusIcon = X;
        statusColor = "text-destructive/80";
    }

    return (
        <div className={cn(
            "group/tool my-1 rounded-md border overflow-hidden",
            expanded ? "bg-muted/10 border-border/40 shadow-sm" : "bg-transparent border-transparent hover:bg-muted/50"
        )}>
            {/* Header / Summary Row */}
            <div
                role="button"
                aria-expanded={expanded}
                aria-label={`${verb} ${target || toolName}`}
                tabIndex={0}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[12px] font-mono select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset rounded"
                onClick={toggleExpanded}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded();
                    }
                }}
            >
                {/* Status Indicator */}
                <div className={cn("flex items-center justify-center w-4 h-4 shrink-0", statusColor)}>
                    <StatusIcon className={cn("w-3.5 h-3.5", status === 'running' && "animate-spin")} />
                </div>

                {/* Tool Icon & Name */}
                <div className="flex items-center gap-1.5 text-muted-foreground/80 group-hover/tool:text-foreground transition-colors">
                    {toolIcon}
                    <span className="font-semibold text-foreground/90">{verb}</span>
                </div>

                {/* Target (File/Command) */}
                {target && (
                    <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground/60 mx-1">→</span>
                        <span className="text-foreground/80 truncate inline-block max-w-[300px] align-bottom" title={target}>
                            {target}
                        </span>
                    </div>
                )}

                {/* Right side meta info */}
                <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground/50 whitespace-nowrap">
                    {!expanded && resultSummary && (
                        <span>{resultSummary}</span>
                    )}
                    {duration && (
                        <span>{duration}</span>
                    )}
                    <ChevronRight className={cn(
                        "w-3.5 h-3.5 opacity-0 group-hover/tool:opacity-50",
                        expanded && "rotate-90 opacity-100"
                    )} />
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-border/20 px-3 py-2 text-[11px] bg-muted/5">

                    {/* Arguments Section */}
                    <div className="mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1 font-semibold flex items-center gap-1">
                            Arguments
                        </div>
                        <div className="font-mono bg-muted/30 rounded px-2 py-1.5 text-muted-foreground/90 break-all border border-border/10">
                            {Object.entries(args).map(([key, value]) => (
                                <div key={key} className="grid grid-cols-[auto_1fr] gap-2">
                                    <span className="text-primary/60">{key}:</span>
                                    <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Result Section */}
                    {result && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1 font-semibold flex items-center gap-1">
                                Output
                            </div>
                            <div className="font-mono bg-background rounded px-2 py-1.5 text-foreground/90 whitespace-pre-wrap break-words border border-border/20 max-h-[300px] overflow-y-auto shadow-inner">
                                {result}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons - Always Visible if Action Required */}
            {result && (result.includes('Tool "run_shell_command" not found') || result.includes('Action Required')) && (
                <div className="mx-3 mb-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <div className="flex items-center gap-2 mb-2 text-amber-500 font-medium text-xs">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </div>
                        Action Required: Permission Needed
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {/* 1. Allow All Edits (Session) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onRetry?.('session'); }}
                            className="text-left px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors flex items-center gap-2.5 shadow-sm"
                        >
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-background/20 text-[10px] font-bold">1</span>
                            Allow All Edits
                            <span className="ml-auto text-[10px] opacity-70 font-normal">Auto-approve for this session</span>
                        </button>

                        {/* 2. Allow (Once) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onRetry?.('once'); }}
                            className="text-left px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors flex items-center gap-2.5 border border-border/50"
                        >
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-foreground/10 text-[10px] font-bold">2</span>
                            Allow
                            <span className="ml-auto text-[10px] opacity-70 font-normal">Approve this request only</span>
                        </button>

                        {/* 3. Reject (Cancel) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
                            className="text-left px-3 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors flex items-center gap-2.5 border border-border/50"
                        >
                            <span className="flex items-center justify-center w-4 h-4 rounded-full border border-border text-[10px] font-bold">3</span>
                            Reject
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
