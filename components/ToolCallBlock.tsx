'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, XCircle, Clock, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './CodeBlock';

interface ToolCallBlockProps {
    toolName: string;
    args: Record<string, any>;
    status?: 'running' | 'completed' | 'failed';
    result?: string;
    duration?: string;
}

export function ToolCallBlock({ toolName, args, status = 'completed', result, duration }: ToolCallBlockProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [resultCollapsed, setResultCollapsed] = useState(true);

    const getStatusIcon = () => {
        switch (status) {
            case 'running':
                return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'completed':
            default:
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'running': return 'border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20';
            case 'failed': return 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20';
            case 'completed':
            default: return 'border-border/60 bg-card';
        }
    };

    // Format args for display
    const argsDisplay = Object.entries(args).map(([key, value]) => {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${valueStr}`;
    }).join('\n');

    return (
        <div className={cn("my-3 rounded-xl border overflow-hidden transition-all shadow-sm max-w-full w-full", getStatusColor())}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <div className={cn("p-1.5 rounded-md bg-background border shadow-sm", status === 'running' && "animate-pulse")}>
                    <Terminal className="w-4 h-4 text-foreground/70" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{toolName}</span>
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider",
                            status === 'running' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                                status === 'failed' ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                                    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        )}>
                            {status}
                        </span>
                    </div>
                    {duration && <div className="text-[10px] text-muted-foreground mt-0.5">Duration: {duration}</div>}
                </div>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 hover:bg-background/50 rounded-md transition-colors"
                >
                    {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground rotate-180" />}
                </button>
            </div>

            {/* Body */}
            {!collapsed && (
                <div className="border-t border-border/50">
                    {/* Args */}
                    <div className="px-4 py-3 bg-background/50">
                        <div className="text-xs font-medium text-muted-foreground mb-1.5">Arguments</div>
                        <div className="font-mono text-xs bg-muted/50 rounded-md px-3 py-2 text-foreground/90 whitespace-pre-wrap break-words border border-border/50">
                            {argsDisplay}
                        </div>
                    </div>

                    {/* Result */}
                    {result && (
                        <div className="border-t border-border/50">
                            <button
                                onClick={() => setResultCollapsed(!resultCollapsed)}
                                className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                            >
                                <span>Result Output</span>
                                {resultCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {!resultCollapsed && (
                                <div className="px-4 pb-3 pt-0">
                                    <CodeBlock language="json" code={result} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
