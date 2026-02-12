'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Plug,
    Activity,
    RefreshCw,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Terminal,
    Globe,
    Plus,
    X,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ServerStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'error';

interface MCPServerRecord {
    command?: string;
    args?: string[];
    url?: string;
    httpUrl?: string;
    type?: 'sse' | 'http';
    description?: string;
    includeTools?: string[];
    includeToolsCount?: number | null;
    excludeToolsCount?: number | null;
    kind?: 'stdio' | 'sse' | 'http';
    status?: ServerStatus;
}

interface MCPResponse {
    discoveryState?: string;
    servers?: Record<string, MCPServerRecord>;
}

interface MCPPanelProps {
    className?: string;
}

const statusColorMap: Record<ServerStatus, string> = {
    connected: 'bg-emerald-500',
    connecting: 'bg-amber-500',
    disconnected: 'bg-zinc-500',
    disconnecting: 'bg-orange-500',
    error: 'bg-red-500',
};

const statusLabelMap: Record<ServerStatus, string> = {
    connected: 'Connected',
    connecting: 'Connecting',
    disconnected: 'Disconnected',
    disconnecting: 'Disconnecting',
    error: 'Error',
};

const defaultServerStatus = (status?: string): ServerStatus => {
    if (status === 'connected' || status === 'connecting' || status === 'disconnected' || status === 'disconnecting' || status === 'error') {
        return status;
    }
    return 'disconnected';
};

export function MCPPanel({ className }: MCPPanelProps) {
    const [servers, setServers] = useState<Record<string, MCPServerRecord>>({});
    const [discoveryState, setDiscoveryState] = useState('not_started');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restartingServer, setRestartingServer] = useState<string | null>(null);
    const [activeDetails, setActiveDetails] = useState<{ name: string; server: MCPServerRecord } | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newServerName, setNewServerName] = useState('');
    const [transportType, setTransportType] = useState<'stdio' | 'sse' | 'http'>('stdio');
    const [command, setCommand] = useState('');
    const [argsInput, setArgsInput] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [description, setDescription] = useState('');
    const [isSavingServer, setIsSavingServer] = useState(false);

    const orderedServers = useMemo(
        () => Object.entries(servers).sort((a, b) => a[0].localeCompare(b[0])),
        [servers]
    );

    const loadServers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/mcp');
            if (!res.ok) {
                throw new Error('Failed to load MCP servers');
            }
            const data = await res.json() as MCPResponse;
            setServers(data.servers || {});
            setDiscoveryState(data.discoveryState || 'not_started');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadServers();
    }, []);

    const handleRestart = async (name: string) => {
        setRestartingServer(name);
        try {
            const res = await fetch('/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart', name }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Failed to restart "${name}"`);
            }
            await loadServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restart MCP server');
        } finally {
            setRestartingServer(null);
        }
    };

    const handleDetails = async (name: string, fallbackServer: MCPServerRecord) => {
        try {
            const res = await fetch('/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'details', name }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Failed to load details for "${name}"`);
            }
            const data = await res.json() as { server?: MCPServerRecord };
            setActiveDetails({
                name,
                server: data.server || fallbackServer,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load MCP server details');
            setActiveDetails({ name, server: fallbackServer });
        }
    };

    const handleAddServer = async () => {
        if (!newServerName.trim()) {
            setError('Server name is required');
            return;
        }

        if (transportType === 'stdio' && !command.trim()) {
            setError('Command is required for stdio servers');
            return;
        }

        if ((transportType === 'sse' || transportType === 'http') && !urlInput.trim()) {
            setError('URL is required for network transports');
            return;
        }

        setIsSavingServer(true);
        setError(null);
        try {
            const args = argsInput
                .split(' ')
                .map((value) => value.trim())
                .filter(Boolean);

            const config: Record<string, unknown> = {
                description: description.trim() || undefined,
            };

            if (transportType === 'stdio') {
                config.command = command.trim();
                if (args.length > 0) {
                    config.args = args;
                }
            } else {
                config.url = urlInput.trim();
                config.type = transportType;
            }

            const res = await fetch('/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add',
                    name: newServerName.trim(),
                    config,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to add MCP server');
            }

            setShowAddForm(false);
            setNewServerName('');
            setTransportType('stdio');
            setCommand('');
            setArgsInput('');
            setUrlInput('');
            setDescription('');
            await loadServers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add MCP server');
        } finally {
            setIsSavingServer(false);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            <div className="p-3 border-b flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                    <Plug className="w-3.5 h-3.5 text-primary" />
                    MCP Manager
                </h4>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {discoveryState.replace('_', ' ')}
                    </span>
                    <button
                        onClick={loadServers}
                        disabled={isLoading}
                        className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isLoading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-3 mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {showAddForm && (
                <div className="mx-3 mt-3 rounded-lg border border-border/60 bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add MCP Server</h5>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="p-1 rounded hover:bg-muted"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <input
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                        placeholder="server name"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    />

                    <select
                        value={transportType}
                        onChange={(e) => setTransportType(e.target.value as 'stdio' | 'sse' | 'http')}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    >
                        <option value="stdio">stdio (command)</option>
                        <option value="sse">sse (url)</option>
                        <option value="http">http (url)</option>
                    </select>

                    {transportType === 'stdio' ? (
                        <>
                            <input
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="command (e.g. npx @modelcontextprotocol/server-filesystem)"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                            />
                            <input
                                value={argsInput}
                                onChange={(e) => setArgsInput(e.target.value)}
                                placeholder="args (space-separated)"
                                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                            />
                        </>
                    ) : (
                        <input
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="url"
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        />
                    )}

                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="description (optional)"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    />

                    <button
                        onClick={handleAddServer}
                        disabled={isSavingServer}
                        className="w-full py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60"
                    >
                        {isSavingServer ? 'Saving...' : 'Save Server'}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {orderedServers.map(([name, config]) => {
                    const kind = config.kind || (config.command ? 'stdio' : ((config.type === 'http' || config.httpUrl) ? 'http' : 'sse'));
                    const status = defaultServerStatus(config.status);
                    const toolCount = config.includeToolsCount ?? (Array.isArray(config.includeTools) ? config.includeTools.length : null);

                    return (
                        <div key={name} className="bg-muted/30 border border-border/50 rounded-lg p-3 hover:border-primary/30 transition-all">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-primary/10 rounded-md">
                                        {kind === 'stdio'
                                            ? <Terminal className="w-4 h-4 text-primary" />
                                            : <Globe className="w-4 h-4 text-primary" />}
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-semibold text-foreground">{name}</h5>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-mono">
                                            {kind} · {toolCount === null ? 'all tools' : `${toolCount} tools`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className={cn("w-2 h-2 rounded-full", statusColorMap[status])} />
                                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                        {statusLabelMap[status]}
                                    </span>
                                </div>
                            </div>

                            {config.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                                    {config.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2 mt-auto">
                                <button
                                    onClick={() => handleRestart(name)}
                                    disabled={restartingServer === name}
                                    className="flex-1 py-1.5 rounded bg-secondary/50 hover:bg-secondary text-[11px] font-medium transition-colors border border-border/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    {restartingServer === name
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <RefreshCw className="w-3 h-3" />}
                                    Restart
                                </button>
                                <button
                                    onClick={() => void handleDetails(name, config)}
                                    className="flex-1 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors border border-primary/20 flex items-center justify-center gap-1.5"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Details
                                </button>
                            </div>
                        </div>
                    );
                })}

                {orderedServers.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-60 opacity-30">
                        <Activity className="w-12 h-12 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">No MCP Servers</p>
                        <p className="text-[11px] mt-1 text-center px-4 italic">Add a server to start using MCP tools.</p>
                    </div>
                )}

                {isLoading && orderedServers.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-60 opacity-30">
                        <Loader2 className="w-12 h-12 animate-spin mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest">Loading Servers...</p>
                    </div>
                )}
            </div>

            <div className="p-3 border-t bg-muted/20">
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 bg-primary text-primary-foreground rounded-md text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add New Server
                </button>
            </div>

            {activeDetails && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                <h4 className="text-sm font-semibold">{activeDetails.name}</h4>
                            </div>
                            <button
                                onClick={() => setActiveDetails(null)}
                                className="p-1 rounded hover:bg-muted"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-3 max-h-[60vh] overflow-auto">
                            <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all rounded-md border border-border/60 bg-muted/20 p-3">
                                {JSON.stringify(activeDetails.server, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
