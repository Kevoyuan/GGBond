'use client';

import React, { useCallback, useEffect, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import {
    Database,
    FileText,
    RefreshCw,
    Plus,
    Trash2,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Save,
    X,
    Layout,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PanelHeader } from './sidebar/PanelHeader';

interface MemoryPanelProps {
    onFileSelect?: (file: { name: string; path: string }) => void;
    className?: string;
    workspacePath?: string;
}

const DEFAULT_MEMORY_TEMPLATE = `# GEMINI.md

## Project Context
- Describe this project's purpose.
- Document architecture assumptions.

## Coding Preferences
- Preferred language/style.
- Testing expectations.

## Important Constraints
- List safety and deployment constraints here.
`;

const isGeminiMemoryFile = (filePath: string) => /(^|[\\/])gemini\.md$/i.test(filePath);

const buildWorkspaceGeminiPath = (workspacePath?: string) => {
    const trimmed = workspacePath?.trim();
    if (!trimmed) return 'GEMINI.md';
    if (trimmed.endsWith('/') || trimmed.endsWith('\\')) {
        return `${trimmed}GEMINI.md`;
    }
    return `${trimmed}/GEMINI.md`;
};

export const MemoryPanel = memo(function MemoryPanel({ onFileSelect, className, workspacePath }: MemoryPanelProps) {
    const [files, setFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [editorPath, setEditorPath] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [editorLoading, setEditorLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editorMode, setEditorMode] = useState<'create' | 'edit'>('edit');
    const [portalReady, setPortalReady] = useState(false);
    const editorFileName = editorPath ? (editorPath.split(/[\\/]/).pop() || editorPath) : '';

    const closeEditor = () => {
        setEditorPath(null);
        setEditorContent('');
        setEditorMode('edit');
        setEditorLoading(false);
    };

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (workspacePath?.trim()) {
                params.set('workspacePath', workspacePath.trim());
            }
            const endpoint = params.size > 0 ? `/api/memory?${params.toString()}` : '/api/memory';
            const res = await fetch(endpoint);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files || []);
                setError(null);
            } else {
                setError('Failed to fetch memory files');
            }
        } catch {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    }, [workspacePath]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'refresh' }),
            });
            if (res.ok) {
                setStatus({ type: 'success', message: 'Context updated' });
                await fetchFiles();
            } else {
                setStatus({ type: 'error', message: 'Reload failed' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Network error' });
        } finally {
            setRefreshing(false);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    const openEditor = async (filePath: string) => {
        setEditorLoading(true);
        try {
            const params = new URLSearchParams({
                content: '1',
                path: filePath,
            });
            if (workspacePath?.trim()) {
                params.set('workspacePath', workspacePath.trim());
            }
            const res = await fetch(`/api/memory?${params.toString()}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to read file');
            }
            const data = await res.json();
            setEditorPath(data.path || filePath);
            setEditorContent(data.content || '');
            setEditorMode('edit');
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Open failed',
            });
        } finally {
            setEditorLoading(false);
        }
    };

    const handleCreate = async () => {
        const existingGeminiPath = files.find((filePath) => isGeminiMemoryFile(filePath));
        if (existingGeminiPath) {
            await openEditor(existingGeminiPath);
            setStatus({ type: 'success', message: 'Found existing GEMINI.md' });
            return;
        }

        setEditorPath(buildWorkspaceGeminiPath(workspacePath));
        setEditorContent(DEFAULT_MEMORY_TEMPLATE);
        setEditorMode('create');
        setEditorLoading(false);
    };

    const handleSave = async () => {
        if (!editorPath) return;
        setSaving(true);
        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: editorMode === 'create' ? 'create' : 'update',
                    path: editorPath,
                    content: editorContent,
                    workspacePath,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Save failed');
            }

            const data = await res.json().catch(() => ({}));
            const savedPath = typeof data.path === 'string' && data.path.trim() ? data.path : editorPath;
            setEditorPath(savedPath);
            setEditorMode('edit');
            setStatus({
                type: 'success',
                message: editorMode === 'create' ? 'Initialized memory' : 'Memory persistent',
            });
            await fetchFiles();
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Persistence failed',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (filePath: string) => {
        const confirmed = window.confirm(`Permanently delete ${filePath}?`);
        if (!confirmed) return;

        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    path: filePath,
                    workspacePath,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Deletion failed');
            }

            if (editorPath === filePath) {
                closeEditor();
            }
            setStatus({ type: 'success', message: 'Document purged' });
            await fetchFiles();
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Purge failed',
            });
        }
    };

    useEffect(() => {
        void fetchFiles();
    }, [fetchFiles]);

    useEffect(() => {
        setPortalReady(true);
        return () => setPortalReady(false);
    }, []);

    const editorModal = editorPath ? (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md p-4 sm:p-8 flex items-center justify-center animate-in zoom-in-95 duration-300">
            <div className="w-full max-w-5xl h-[calc(100vh-4rem)] rounded-2xl border border-primary/20 bg-background/95 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-4 p-4 border-b bg-primary/5">
                    <div className="min-w-0 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold uppercase tracking-tight truncate">{editorFileName}</p>
                            <p className="text-[10px] text-muted-foreground truncate font-mono opacity-60">{editorPath}</p>
                        </div>
                    </div>
                    <button
                        onClick={closeEditor}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 p-4 overflow-hidden relative group">
                    {editorLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                            <RefreshCw className="w-8 h-8 mb-2 animate-spin" />
                            <p className="text-xs font-bold uppercase tracking-widest">Reading knowledge...</p>
                        </div>
                    ) : (
                        <textarea
                            value={editorContent}
                            onChange={(event) => setEditorContent(event.target.value)}
                            spellCheck={false}
                            className="w-full h-full min-h-0 resize-none rounded-xl border border-border/50 bg-muted/20 p-6 text-[14px] leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors selection:bg-primary/20"
                        />
                    )}
                </div>

                <div className="p-4 border-t bg-primary/5 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground italic px-2">
                        Content is used as long-lived context for all turns in this project.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={closeEditor}
                            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => void handleSave()}
                            disabled={saving || editorLoading}
                            className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:brightness-110 active:scale-95 disabled:opacity-50 transition-colors shadow-lg flex items-center gap-2"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save Context'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            <PanelHeader
                title="Knowledge Base"
                icon={Database}
                badge={files.length}
                actions={
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleCreate}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Add Memory Document"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRefresh}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Force Sync Context"
                            disabled={refreshing}
                        >
                            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                        </button>
                    </div>
                }
            />

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {status && (
                    <div className={cn(
                        "p-2.5 rounded-lg text-[10px] font-bold uppercase tracking-tight flex items-center gap-2 animate-in fade-in slide-in-from-top-1 shadow-sm",
                        status.type === 'success'
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border border-red-500/20"
                    )}>
                        {status.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {status.message}
                    </div>
                )}

                {loading && files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20">
                        <RefreshCw className="w-10 h-10 animate-spin mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center">Reading Project Memory...</p>
                    </div>
                ) : error ? (
                    <div className="p-6 text-center space-y-3 opacity-60">
                        <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
                        <p className="text-xs font-bold uppercase tracking-tight text-destructive">{error}</p>
                        <button
                            onClick={fetchFiles}
                            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline underline-offset-4"
                        >
                            Retry Sync
                        </button>
                    </div>
                ) : files.length === 0 ? (
                    <div className="p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-primary/5 rounded-3xl border border-primary/10 flex items-center justify-center mx-auto opacity-30 group hover:opacity-100 transition-colors duration-500">
                            <FileText className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-bold uppercase tracking-widest text-foreground">Tabula Rasa</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed px-2">
                                Scaffolding <code>GEMINI.md</code> allows the agent to maintain long-term context of your design patterns and constraints.
                            </p>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-xl mx-auto hover:brightness-110 active:scale-95 transition-colors shadow-xl"
                        >
                            <Plus className="w-4 h-4" />
                            Enshrine Knowledge
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-1">Active Documents</p>
                        {files.map((filePath) => {
                            const segments = filePath.split(/[\\/]/);
                            const name = segments[segments.length - 1] || filePath;
                            const dir = filePath.slice(0, Math.max(0, filePath.length - name.length)).replace(/[\\/]$/, '');

                            return (
                                <div
                                    key={filePath}
                                    className="group relative flex flex-col p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-colors duration-200 cursor-pointer"
                                    onClick={() => onFileSelect?.({ name, path: filePath })}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate opacity-60 font-mono">
                                                    {dir || 'Root'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-colors flex items-center gap-1 mt-1">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleDelete(filePath);
                                                }}
                                                className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded-md text-muted-foreground transition-colors"
                                                title="Purge Document"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center gap-3">
                                        <div className="px-2 py-0.5 rounded bg-emerald-500/10 text-[9px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 border border-emerald-500/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Persistent Context
                                        </div>
                                        <span className="text-[9px] text-muted-foreground/50 italic">Reflected in every turn</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-card/20 space-y-3">
                <p className="text-[10px] leading-relaxed text-muted-foreground/80 italic px-1">
                    Knowledge Base documents are used as core system context. Updates are automatically synchronized with the active session.
                </p>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors cursor-pointer group">
                    <span className="flex items-center gap-2">
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        Documentation Guide
                    </span>
                    <Layout className="w-4 h-4 opacity-40" />
                </div>
            </div>

            {portalReady && editorModal ? createPortal(editorModal, document.body) : null}
        </div>
    );
});
