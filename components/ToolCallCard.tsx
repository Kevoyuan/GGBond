
'use client';

import React, { useState } from 'react';
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
    Play,
    Copy,
    Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCallCardProps {
    toolName: string;
    args: Record<string, any>;
    status?: 'running' | 'completed' | 'failed';
    result?: string;
    duration?: string;
    onRetry?: (mode: 'once' | 'session') => void;
    onCancel?: () => void;
}

// Map tool names to Lucide icons
function getToolIcon(toolName: string) {
    const lower = toolName.toLowerCase();
    if (lower.includes('read') || lower.includes('view') || lower.includes('cat')) return FileText;
    if (lower.includes('write') || lower.includes('create') || lower.includes('save')) return Edit;
    if (lower.includes('edit') || lower.includes('replace') || lower.includes('update')) return Edit;
    if (lower.includes('search') || lower.includes('grep') || lower.includes('find')) return Search;
    if (lower.includes('browser') || lower.includes('web') || lower.includes('fetch')) return Globe;
    if (lower.includes('list') || lower.includes('ls')) return List;
    if (lower.includes('delete') || lower.includes('remove') || lower.includes('rm')) return Trash2;
    if (lower.includes('execute') || lower.includes('bash') || lower.includes('shell') || lower.includes('run') || lower.includes('command')) return Terminal;
    return Play; // Default icon
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

// Extract the most relevant arg value
function getToolTarget(args: Record<string, any>): string {
    const priorityKeys = ['path', 'file_path', 'filePath', 'file', 'filename', 'command', 'cmd', 'query', 'pattern', 'directory', 'dir'];
    for (const key of priorityKeys) {
        if (args[key] && typeof args[key] === 'string') {
            const val = args[key] as string;
            // For file paths, shorten if needed but keep full path in tooltip
            if (val.includes('/')) {
                const parts = val.split('/');
                return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : val;
            }
            return val;
        }
    }
    for (const val of Object.values(args)) {
        if (typeof val === 'string' && val.length < 50) return val;
    }
    return '';
}

export function ToolCallCard({ toolName, args, status = 'completed', result, duration, onRetry, onCancel }: ToolCallCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const ToolIcon = getToolIcon(toolName);
    const verb = getToolVerb(toolName);
    const target = getToolTarget(args);

    // Summary of result
    const resultLineCount = result ? result.split('\n').length : 0;
    const resultSummary = result
        ? `${resultLineCount} line${resultLineCount !== 1 ? 's' : ''}`
        : null;

    // Status Styling
    let statusColor = "text-emerald-500";
    let statusBg = "bg-emerald-500/10";
    let statusBorder = "border-emerald-500/20";
    let StatusIcon = Check;

    if (status === 'running') {
        StatusIcon = Loader2;
        statusColor = "text-blue-500";
        statusBg = "bg-blue-500/10";
        statusBorder = "border-blue-500/30";
    } else if (status === 'failed') {
        StatusIcon = X;
        statusColor = "text-rose-500";
        statusBg = "bg-rose-500/10";
        statusBorder = "border-rose-500/30";
    }

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (result) {
            navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className={cn(
            "group/card my-2 rounded-xl border transition-all duration-300 overflow-hidden",
            expanded ? "bg-card shadow-lg ring-1 ring-border/50" : "bg-card/50 hover:bg-card hover:shadow-sm",
            status === 'running' && "ring-1 ring-blue-500/30 bg-blue-50/5",
            status === 'failed' && "ring-1 ring-rose-500/30 bg-rose-50/5",
            statusBorder
        )}>
            {/* Header */}
            <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Status Indicator */}
                <div className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full shrink-0 transition-colors",
                    statusBg, statusColor
                )}>
                    <StatusIcon className={cn("w-3.5 h-3.5", status === 'running' && "animate-spin")} />
                </div>

                {/* Tool Info */}
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground/90">{verb}</span>
                        {target && (
                            <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={String(Object.values(args).find(v => typeof v === 'string' && (v as string).includes(target.replace('...', '')))) || target}>
                                {target}
                            </span>
                        )}
                    </div>
                    {/* Tiny arg preview if not expanded */}
                    {!expanded && !target && Object.keys(args).length > 0 && (
                        <div className="text-[10px] text-muted-foreground truncate opacity-70">
                            {JSON.stringify(args).slice(0, 50)}
                        </div>
                    )}
                </div>

                {/* Right Meta */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                    {!expanded && resultSummary && (
                        <span className="font-medium font-mono">{resultSummary}</span>
                    )}
                    {duration && (
                        <span>{duration}</span>
                    )}
                    <ChevronRight className={cn(
                        "w-4 h-4 transition-transform duration-300 opacity-50 group-hover/card:opacity-100",
                        expanded && "rotate-90"
                    )} />
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-border/40 bg-muted/5 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-border/40">
                        {/* Arguments Panel */}
                        <div className="p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Input</span>
                            </div>
                            <div className="bg-background/80 rounded-lg border border-border/40 p-2.5 font-mono text-xs overflow-x-auto">
                                <pre className="text-muted-foreground">
                                    {JSON.stringify(args, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Result Panel */}
                        {result && (
                            <div className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Output</span>
                                    <button
                                        onClick={handleCopy}
                                        className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                                        title="Copy output"
                                    >
                                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                                <div className="bg-background/80 rounded-lg border border-border/40 p-2.5 font-mono text-xs overflow-x-auto max-h-[300px] shadow-inner custom-scrollbar relative">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity">

                                    </div>
                                    <pre className={cn("text-muted-foreground whitespace-pre-wrap break-words", status === 'failed' && "text-rose-500")}>
                                        {result}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Bar for Permissions/Errors - Copied from Block logic but styled better */}
                    {result && (result.includes('Tool "run_shell_command" not found') || result.includes('Action Required')) && (
                        <div className="p-3 bg-amber-500/5 border-t border-amber-500/20">
                            <div className="flex items-center gap-2 mb-3 text-amber-500 font-medium text-xs">
                                <div className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </div>
                                Permission Required for Action
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRetry?.('session'); }}
                                    className="flex-1 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium transition-colors border border-amber-500/20"
                                >
                                    Allow All (Session)
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRetry?.('once'); }}
                                    className="flex-1 py-1.5 rounded-md bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors border shadow-sm"
                                >
                                    Allow Once
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
                                    className="px-3 py-1.5 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 text-xs font-medium transition-colors border border-transparent hover:border-rose-500/20"
                                >
                                    Deny
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
