
'use client';

import React, { useState, useEffect } from 'react';
import {
    Plug,
    Activity,
    RefreshCw,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Terminal,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MCPServer {
    id: string;
    name: string;
    type: 'stdio' | 'sse' | 'http';
    status: 'connected' | 'connecting' | 'error' | 'disconnected';
    description?: string;
    toolsCount?: number;
}

interface MCPPanelProps {
    className?: string;
}

export function MCPPanel({ className }: MCPPanelProps) {
    const [servers, setServers] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadServers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/mcp');
            if (res.ok) {
                const data = await res.json();
                setServers(data.servers || {});
            } else {
                throw new Error('Failed to load MCP servers');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadServers();
    }, []);

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            <div className="p-3 border-b flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                    <Plug className="w-3.5 h-3.5 text-primary" />
                    MCP Manager
                </h4>
                <button
                    onClick={loadServers}
                    disabled={isLoading}
                    className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isLoading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {Object.entries(servers).map(([name, config]) => (
                    <div key={name} className="bg-muted/30 border border-border/50 rounded-lg p-3 hover:border-primary/30 transition-all">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-primary/10 rounded-md">
                                    {config.command ? <Terminal className="w-4 h-4 text-primary" /> : <Globe className="w-4 h-4 text-primary" />}
                                </div>
                                <div>
                                    <h5 className="text-sm font-semibold text-foreground">{name}</h5>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-mono">
                                        {config.command ? 'stdio' : (config.url ? 'sse' : 'http')} · {config.includeTools?.length || 'all'} tools
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                <span className="text-[10px] font-medium text-emerald-500 uppercase">Connected</span>
                            </div>
                        </div>

                        {config.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                                {config.description}
                            </p>
                        )}

                        <div className="flex items-center gap-2 mt-auto">
                            <button className="flex-1 py-1.5 rounded bg-secondary/50 hover:bg-secondary text-[11px] font-medium transition-colors border border-border/50 flex items-center justify-center gap-1.5">
                                <RefreshCw className="w-3 h-3" />
                                Restart
                            </button>
                            <button className="flex-1 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors border border-primary/20 flex items-center justify-center gap-1.5">
                                <ExternalLink className="w-3 h-3" />
                                Details
                            </button>
                        </div>
                    </div>
                ))}

                {Object.keys(servers).length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-60 opacity-30">
                        <Activity className="w-12 h-12 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">No MCP Servers</p>
                        <p className="text-[11px] mt-1 text-center px-4 italic">Configure servers in lib/core-service.ts to see them here.</p>
                    </div>
                )}

                {isLoading && Object.keys(servers).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-60 opacity-30">
                        <Loader2 className="w-12 h-12 animate-spin mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">Loading Servers...</p>
                    </div>
                )}
            </div>

            <div className="p-3 border-t bg-muted/20">
                <button className="w-full py-2 bg-primary text-primary-foreground rounded-md text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add New Server
                </button>
            </div>
        </div>
    );
}

function Loader2({ className }: { className?: string }) {
    return <RefreshCw className={cn(className, "animate-spin")} />;
}

function Plus({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}
