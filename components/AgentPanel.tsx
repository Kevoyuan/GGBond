'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { User, Sparkles, Shield, Cpu, ExternalLink, Play, RefreshCw, Layers, Plus, Trash, Link2, Search, SlidersHorizontal, Loader2, Ban, CheckCircle2, BookOpen, AlertCircle, FolderSearch, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateAgentDialog } from './CreateAgentDialog';
import { AgentPreviewDialog } from './AgentPreviewDialog';
import { AgentRunsList } from './AgentRunsList';
import { useAppStore } from '@/stores/useAppStore';
import { AgentIcon } from './icons/AgentIcon';
import { PanelHeader } from './sidebar/PanelHeader';

interface AgentDefinition {
    name: string;
    displayName?: string;
    description: string;
    kind: 'local' | 'remote';
    experimental?: boolean;
    content?: string;
}

interface AgentPanelProps {
    onSelectAgent: (agent: AgentDefinition) => void;
    selectedAgentName?: string;
    className?: string;
}

const builtInAgents = ['codebase-investigator', 'cli-help-agent', 'generalist-agent'];

export function AgentPanel({ onSelectAgent, selectedAgentName, className }: AgentPanelProps) {
    const [agents, setAgents] = useState<AgentDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [scopeFilter, setScopeFilter] = useState<'all' | 'built-in' | 'user'>('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionMessageIsError, setActionMessageIsError] = useState(false);

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [previewAgent, setPreviewAgent] = useState<AgentDefinition | null>(null);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);

    // Import state
    const [importSource, setImportSource] = useState('');
    const [importableAgents, setImportableAgents] = useState<{ path: string; name: string }[]>([]);
    const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
    const [scanning, setScanning] = useState(false);
    const [isDirectory, setIsDirectory] = useState(false);

    const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
    const [agentListHeight, setAgentListHeight] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const [refreshRunsTrigger, setRefreshRunsTrigger] = useState(0);

    // Run agent state (kept for compatibility)
    const { getAgents, setAgents: saveAgents } = useAppStore();

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        // Persist height
        localStorage.setItem('agent-panel-list-height', agentListHeight.toString());
    }, [agentListHeight]);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing && panelRef.current) {
            const panelRect = panelRef.current.getBoundingClientRect();
            const newHeight = e.clientY - panelRect.top - 48; // 48 is the header height
            if (newHeight > 150 && newHeight < panelRect.height - 150) {
                setAgentListHeight(newHeight);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const fetchAgents = async (force = false) => {
        // Try cache first unless forced
        if (!force) {
            const cachedAgents = getAgents();
            if (cachedAgents) {
                setAgents(cachedAgents);
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        try {
            const res = await fetch('/api/agents');
            if (res.ok) {
                const data = await res.json();
                const agentsData = data.agents || [];
                setAgents(agentsData);
                saveAgents(agentsData);
                setError(null);
            } else {
                setError('Failed to fetch agents');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
        // Load persisted height
        const savedHeight = localStorage.getItem('agent-panel-list-height');
        if (savedHeight) {
            const h = parseInt(savedHeight, 10);
            if (!isNaN(h)) setAgentListHeight(h);
        }
    }, []);

    const handleAction = async (action: string, name?: string) => {
        try {
            setActionMessage(null);
            setActionMessageIsError(false);

            if (action === 'delete' && name) {
                setActionLoading(`delete:${name}`);
                const res = await fetch('/api/agents/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to delete');
                }
                await fetchAgents();
                setActionMessage(`Agent "${name}" deleted`);
            } else if (action === 'import_selected' && selectedImports.size > 0) {
                setActionLoading('import_selected');
                const res = await fetch('/api/agents/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourcePaths: Array.from(selectedImports) }),
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to import');
                }
                setSelectedImports(new Set());
                setImportSource('');
                setImportableAgents([]);
                await fetchAgents();
                setActionMessage(`Imported ${data.imported} agent(s)${data.errors ? `, ${data.errors.length} failed` : ''}`);
            } else if (action === 'import' && importSource.trim()) {
                // Single file or directory scan
                setActionLoading(`import:${importSource}`);
                const res = await fetch(`/api/agents/import?dir=${encodeURIComponent(importSource.trim())}`);
                const data = await res.json();
                if (!res.ok || data.error) {
                    throw new Error(data.error || 'Failed to scan');
                }
                setImportableAgents(data.agents || []);
                setIsDirectory(data.isDirectory);
                if (data.agents && data.agents.length > 0) {
                    setActionMessage(`Found ${data.agents.length} agent(s) in directory`);
                } else {
                    setActionMessage('No agents found in directory');
                }
            }
        } catch (err) {
            setActionMessage(err instanceof Error ? err.message : 'Action failed');
            setActionMessageIsError(true);
        } finally {
            setActionLoading(null);
        }
    };

    const handleUseAgent = (e: React.MouseEvent, agentName: string) => {
        e.stopPropagation();
        const event = new CustomEvent('insert-agent-token', {
            detail: { agentName }
        });
        window.dispatchEvent(event);
    };

    const scanForAgents = async () => {
        setScanning(true);
        try {
            const res = await fetch('/api/agents/import');
            const data = await res.json();
            setImportableAgents(data.agents || []);
            setIsDirectory(data.isDirectory);
        } catch (err) {
            console.error('Failed to scan:', err);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        if (showAdvanced) {
            scanForAgents();
        }
    }, [showAdvanced]);

    const toggleImportSelection = (path: string) => {
        const newSet = new Set(selectedImports);
        if (newSet.has(path)) {
            newSet.delete(path);
        } else {
            newSet.add(path);
        }
        setSelectedImports(newSet);
    };

    const selectAllImports = () => {
        if (selectedImports.size === importableAgents.length) {
            setSelectedImports(new Set());
        } else {
            setSelectedImports(new Set(importableAgents.map(a => a.path)));
        }
    };

    const isUserAgent = (agentName: string) => !builtInAgents.includes(agentName);

    const filteredAgents = agents.filter((agent) => {
        if (scopeFilter === 'built-in' && !isUserAgent(agent.name)) return false;
        if (scopeFilter === 'user' && isUserAgent(agent.name)) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            agent.name.toLowerCase().includes(q) ||
            (agent.displayName || '').toLowerCase().includes(q) ||
            agent.description.toLowerCase().includes(q)
        );
    });

    const builtInCount = agents.filter(a => !isUserAgent(a.name)).length;
    const userCount = agents.filter(a => isUserAgent(a.name)).length;

    return (
        <div
            ref={panelRef}
            className={cn("flex flex-col h-full bg-card/30 relative select-none", className)}
        >
            <PanelHeader
                title="Agents"
                icon={AgentIcon}
                badge={agents.length}
                actions={
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                            title="Create Agent"
                        >
                            <Plus size={14} />
                        </button>
                        <button
                            onClick={() => setShowAdvanced((prev) => !prev)}
                            className={cn(
                                "p-1.5 rounded-lg transition-all",
                                showAdvanced
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                            title="Advanced settings"
                        >
                            <SlidersHorizontal size={14} />
                        </button>
                        <button
                            onClick={() => fetchAgents(true)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                }
            />

            {/* Top Section: Agents List & Controls */}
            <div
                className={cn(
                    "flex flex-col shrink-0 min-h-[150px] transition-all duration-200",
                    isResizing && "transition-none"
                )}
                style={{ height: `${agentListHeight}px` }}
            >
                <div className="flex-1 overflow-y-auto p-3 scrollbar-thin space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={18} className="animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Status Cards */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="px-2.5 py-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-900/10">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">User</div>
                                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 font-mono">{userCount}</div>
                                </div>
                                <div className="px-2.5 py-2 rounded-lg border border-primary/20 dark:border-primary/20 bg-primary/5 dark:bg-primary/5">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">System</div>
                                    <div className="text-sm font-semibold text-primary/80 font-mono">{builtInCount}</div>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="relative group">
                                <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground group-focus-within:text-primary transition-all" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search agents..."
                                    className="w-full pl-8 pr-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all font-mono"
                                />
                            </div>

                            {/* Filter */}
                            <div className="flex gap-1">
                                {[
                                    { key: 'all', label: 'All' },
                                    { key: 'user', label: 'User' },
                                    { key: 'built-in', label: 'Built-in' },
                                ].map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => setScopeFilter(item.key as 'all' | 'user' | 'built-in')}
                                        className={cn(
                                            "px-2 py-1 text-[10px] rounded-md border uppercase font-bold tracking-tighter transition-all flex-1",
                                            scopeFilter === item.key
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-transparent border-border/50 text-muted-foreground hover:bg-muted/40"
                                        )}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            {showAdvanced && (
                                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/30 p-4 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                        <SlidersHorizontal size={14} className="text-muted-foreground" />
                                        <h3 className="text-sm font-medium text-foreground">Import Agents</h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                                <Link2 size={12} className="text-primary" />
                                                Directory Path
                                            </label>
                                            <p className="text-[10px] text-muted-foreground">Enter a directory path to scan for agents</p>
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    value={importSource}
                                                    onChange={(e) => setImportSource(e.target.value)}
                                                    placeholder="~/.claude/agents or /path/to/agents"
                                                    className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-background focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                                                />
                                                <button
                                                    onClick={() => handleAction('import')}
                                                    disabled={!importSource.trim() || actionLoading === `import:${importSource}`}
                                                    className="w-full px-4 py-2 text-xs rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                                >
                                                    {actionLoading?.startsWith('import:') ? <Loader2 size={12} className="animate-spin" /> : <FolderSearch size={12} />}
                                                    Scan Directory
                                                </button>
                                            </div>
                                        </div>

                                        {importableAgents.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-border/40">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                                        <BookOpen size={12} className="text-emerald-500" />
                                                        Found ({importableAgents.length})
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={selectAllImports}
                                                            className="text-xs text-primary hover:underline"
                                                        >
                                                            {selectedImports.size === importableAgents.length ? 'Deselect All' : 'Select All'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                                    {importableAgents.map((agent) => (
                                                        <button
                                                            key={agent.path}
                                                            onClick={() => toggleImportSelection(agent.path)}
                                                            className={cn(
                                                                "w-full text-left p-2 text-xs rounded border transition-colors flex items-center gap-2",
                                                                selectedImports.has(agent.path)
                                                                    ? "border-primary bg-primary/5"
                                                                    : "border-zinc-200 dark:border-zinc-700 hover:bg-muted/50"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                                                selectedImports.has(agent.path)
                                                                    ? "bg-primary border-primary"
                                                                    : "border-zinc-300 dark:border-zinc-600"
                                                            )}>
                                                                {selectedImports.has(agent.path) && <CheckCircle2 size={10} className="text-primary-foreground" />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-medium truncate">{agent.name}</div>
                                                                <div className="text-[10px] text-muted-foreground truncate">{agent.path}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                                {selectedImports.size > 0 && (
                                                    <button
                                                        onClick={() => handleAction('import_selected')}
                                                        disabled={actionLoading === 'import_selected'}
                                                        className="w-full px-4 py-2 text-xs rounded-md bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                                    >
                                                        {actionLoading === 'import_selected' ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                                                        Import Selected ({selectedImports.size})
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-border/40">
                                            <button
                                                onClick={scanForAgents}
                                                disabled={scanning}
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                            >
                                                <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
                                                Scan common locations
                                            </button>
                                        </div>

                                        {actionMessage && (
                                            <div
                                                className={cn(
                                                    "text-xs rounded-md border px-3 py-2.5 flex items-start gap-2 shadow-sm animate-in fade-in zoom-in-95 duration-200",
                                                    actionMessageIsError
                                                        ? "border-red-500/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
                                                        : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                                                )}
                                            >
                                                {actionMessageIsError ? (
                                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                                ) : (
                                                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                                                )}
                                                <span className="flex-1 leading-relaxed">{actionMessage}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {filteredAgents.length === 0 ? (
                                    <div className="text-center py-6 text-sm text-muted-foreground italic">
                                        No agents found matching search
                                    </div>
                                ) : (
                                    filteredAgents.map((agent) => (
                                        <div
                                            key={agent.name}
                                            className={cn(
                                                "relative p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer group",
                                                selectedAgentName === agent.name && "bg-primary/5 border-primary ring-1 ring-primary/20"
                                            )}
                                            onClick={() => {
                                                setPreviewAgent(agent);
                                                setShowPreviewDialog(true);
                                                onSelectAgent(agent);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span
                                                            className={cn(
                                                                "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                                                                isUserAgent(agent.name) ? "bg-emerald-500" : "bg-primary"
                                                            )}
                                                        />
                                                        <span className="font-semibold text-[13px] text-foreground truncate">
                                                            {agent.displayName || agent.name}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                                                        {agent.description}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => handleUseAgent(e, agent.name)}
                                                    className="p-1 px-[5px] text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all shrink-0"
                                                    title="Add to chat"
                                                >
                                                    <PlusCircle size={14} className="stroke-[2.5]" />
                                                </button>
                                            </div>

                                            <div className="absolute top-2 right-8 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                {isUserAgent(agent.name) && (
                                                    <div
                                                        className="flex items-center"
                                                        onMouseLeave={() => setConfirmDeleteName(null)}
                                                    >
                                                        {confirmDeleteName === agent.name ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAction('delete', agent.name);
                                                                    setConfirmDeleteName(null);
                                                                }}
                                                                className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded hover:bg-red-600 transition-colors animate-in fade-in slide-in-from-right-2 duration-200"
                                                            >
                                                                Confirm
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setConfirmDeleteName(agent.name);
                                                                }}
                                                                className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                                                title="Delete"
                                                                disabled={actionLoading === `delete:${agent.name}`}
                                                            >
                                                                {actionLoading === `delete:${agent.name}` ? (
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                ) : (
                                                                    <Trash size={12} />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Resize Divider */}
            <div
                className={cn(
                    "h-1 relative cursor-row-resize hover:bg-primary/40 transition-colors z-20 flex items-center justify-center group/resize",
                    isResizing && "bg-primary/50"
                )}
                onMouseDown={startResizing}
            >
                <div className="absolute inset-x-0 -top-2 -bottom-2" />
                <div className="w-8 h-[1px] bg-zinc-300 dark:bg-zinc-600 group-hover/resize:bg-primary transition-colors" />
            </div>

            {/* Bottom Section: Execution History */}
            <div className="flex-1 min-h-[150px] flex flex-col bg-card/5 overflow-hidden">
                <div className="px-3 pt-3 pb-2 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Execution History</span>
                </div>
                <div className="flex-1 overflow-y-auto px-1 scrollbar-thin">
                    <AgentRunsList refreshTrigger={refreshRunsTrigger} />
                </div>
            </div>

            <CreateAgentDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onSuccess={fetchAgents}
            />

            <AgentPreviewDialog
                open={showPreviewDialog}
                onOpenChange={setShowPreviewDialog}
                agent={previewAgent}
                onSuccess={() => setRefreshRunsTrigger(prev => prev + 1)}
            />
        </div>
    );
}
