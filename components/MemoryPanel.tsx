
import React, { useEffect, useState } from 'react';
import { Database, FileText, RefreshCw, Plus, Trash2, Edit3, ExternalLink, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MemoryFile {
    path: string;
    name: string;
}

interface MemoryPanelProps {
    onFileSelect?: (file: { name: string; path: string }) => void;
    className?: string;
}

export function MemoryPanel({ onFileSelect, className }: MemoryPanelProps) {
    const [files, setFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/memory');
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
                setError(null);
            } else {
                setError('Failed to fetch memory files');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/memory', { method: 'POST' });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Memory context reloaded successfully' });
                await fetchFiles();
            } else {
                setStatus({ type: 'error', message: 'Failed to reload memory' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Network error during reload' });
        } finally {
            setRefreshing(false);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    return (
        <div className={cn("flex flex-col h-full bg-card", className)}>
            <div className="p-4 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-sm">Knowledge Base</h2>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Reload Memory Context"
                        disabled={refreshing}
                    >
                        <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {status && (
                    <div className={cn(
                        "p-2.5 rounded-lg text-[10px] font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1",
                        status.type === 'success' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                        {status.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {status.message}
                    </div>
                )}

                {loading && files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-2 opacity-50">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-xs">Loading knowledge base...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 text-center space-y-2">
                        <p className="text-xs text-destructive">{error}</p>
                        <button
                            onClick={fetchFiles}
                            className="text-xs text-primary hover:underline"
                        >
                            Try Again
                        </button>
                    </div>
                ) : files.length === 0 ? (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto opacity-50">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">No Memory Files</p>
                            <p className="text-xs text-muted-foreground leading-relaxed px-4">
                                Create <code>GEMINI.md</code> files in your workspace to provide long-term memory and project context to the agent.
                            </p>
                        </div>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg mx-auto hover:bg-primary/90 transition-colors">
                            <Plus className="w-4 h-4" />
                            Initialize GEMINI.md
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Loaded Memory Documents</p>
                        {files.map((path) => {
                            const name = path.split('/').pop() || path;
                            const dir = path.replace(name, '').replace(/^\/|\/$/g, '');

                            return (
                                <div
                                    key={path}
                                    className="group flex flex-col p-3 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/20 transition-all cursor-pointer relative"
                                    onClick={() => onFileSelect?.({ name, path })}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate opacity-70">
                                                    {dir || 'Root'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <button className="p-1.5 hover:bg-background rounded-md text-muted-foreground transition-colors">
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="px-1.5 py-0.5 rounded-md bg-muted text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-green-500" />
                                            Active
                                        </div>
                                        <span className="text-[9px] text-muted-foreground opacity-50">Reflected in every turn</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-muted/30 text-[10px] text-muted-foreground space-y-2">
                <p className="leading-relaxed">
                    The Agent uses these files as its global identity and project-specific knowledge base. Changes are reflected after clicking the refresh button.
                </p>
                <div className="flex items-center gap-2 text-primary font-medium hover:underline cursor-pointer">
                    <ExternalLink className="w-3 h-3" />
                    Learn about GEMINI.md patterns
                </div>
            </div>
        </div>
    );
}
