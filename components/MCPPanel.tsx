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
import { PanelHeader } from './sidebar/PanelHeader';

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
            <PanelHeader
                title="MCP Manager"
                icon={Plug}
                badge={discoveryState === 'started' ? 'Scanning' : undefined}
                actions={
                    <button
                        onClick={loadServers}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
                        title="Refresh Servers"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                    </button>
                }
            />

            {error && (
                <div className="mx-3 mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{error}</span>
                </div>
            )}

            {showAddForm && (
                <div className="mx-3 mt-3 rounded-lg border border-border/60 bg-background/50 backdrop-blur-md p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Add MCP Server</h5>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        <input
                            value={newServerName}
                            onChange={(e) => setNewServerName(e.target.value)}
                            placeholder="Server name"
                            className="w-full rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary/40 outline-none transition-all font-mono"
                        />

                        <select
                            value={transportType}
                            onChange={(e) => setTransportType(e.target.value as 'stdio' | 'sse' | 'http')}
                            className="w-full rounded-md border border-border/50 bg-background/50 px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary/40 outline-none transition-all"
                        >
                            <option value="stdio">stdio (Local Command)</option>
                            <option value="sse">sse (Network Stream)</option>
                            <option value="http">http (Rest API)</option>
                        </select>

                        {transportType === 'stdio' ? (
                            <>
                                <input
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    placeholder="command (e.g. npx @modelcontextprotocol/...)"
                                    className="w-full rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary/40 outline-none transition-all font-mono"
                                />
                                <input
                                    value={argsInput}
                                    onChange={(e) => setArgsInput(e.target.value)}
                                    placeholder="arguments (space-separated)"
                                    className="w-full rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary/40 outline-none transition-all font-mono"
                                />
                            </>
                        ) : (
                            <input
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                placeholder="http://localhost:3000/sse"
                                className="w-full rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary/40 outline-none transition-all font-mono"
                            />
                        )}

                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="brief description (optional)"
                            className="w-full rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary/40 outline-none transition-all"
                        />
                    </div>

                    <button
                        onClick={handleAddServer}
                        disabled={isSavingServer}
                        className="w-full py-2 mt-1 rounded bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                        {isSavingServer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Save Server
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {orderedServers.map(([name, config]) => {
                    const kind = config.kind || (config.command ? 'stdio' : ((config.type === 'http' || config.httpUrl) ? 'http' : 'sse'));
                    const status = defaultServerStatus(config.status);
                    const toolCount = config.includeToolsCount ?? (Array.isArray(config.includeTools) ? config.includeTools.length : null);

                    return (
                        <div key={name} className="group relative p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all duration-200">
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/5 rounded-lg border border-primary/10 group-hover:bg-primary/10 transition-colors">
                                        {kind === 'stdio'
                                            ? <Terminal className="w-4 h-4 text-primary/80" />
                                            : <Globe className="w-4 h-4 text-primary/80" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h5 className="text-sm font-semibold text-foreground truncate">{name}</h5>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-tight font-mono">
                                            <span className="px-1 py-0.5 rounded bg-muted/50">{kind}</span>
                                            <span>•</span>
                                            <span>{toolCount === null ? 'all tools' : `${toolCount} tools`}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", statusColorMap[status], "shadow-[0_0_8px_rgba(255,255,255,0.2)]")} />
                                    <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/60">
                                        {statusLabelMap[status]}
                                    </span>
                                </div>
                            </div>

                            {config.description && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 line-clamp-2 px-1">
                                    {config.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => handleRestart(name)}
                                    disabled={restartingServer === name}
                                    className="flex-1 py-1.5 rounded-md bg-secondary/40 hover:bg-secondary/60 text-[11px] font-bold uppercase tracking-wider transition-all border border-border/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                    {restartingServer === name
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <RefreshCw className="w-3 h-3" />}
                                    Restart
                                </button>
                                <button
                                    onClick={() => void handleDetails(name, config)}
                                    className="flex-1 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider transition-all border border-primary/20 flex items-center justify-center gap-1.5"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Details
                                </button>
                            </div>
                        </div>
                    );
                })}

                {orderedServers.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20 grayscale">
                        <Activity className="w-10 h-10 mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center">No active servers</p>
                    </div>
                )}

                {isLoading && orderedServers.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20">
                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest">Scanning MCPs...</p>
                    </div>
                )}
            </div>

            <div className="p-3 border-t bg-card/20 group">
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 overflow-hidden relative"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <Plus className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">Add Server</span>
                </button>
            </div>

            {activeDetails && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-30 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl rounded-xl border border-primary/20 bg-background/95 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-3.5 border-b bg-primary/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                </div>
                                <h4 className="text-sm font-bold uppercase tracking-tight">{activeDetails.name}</h4>
                            </div>
                            <button
                                onClick={() => setActiveDetails(null)}
                                className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-auto scrollbar-thin">
                            <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-all rounded-lg border border-border/80 bg-muted/30 p-4 text-foreground/90 selection:bg-primary/30">
                                {JSON.stringify(activeDetails.server, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
