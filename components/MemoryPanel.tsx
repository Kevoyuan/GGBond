import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Database,
    FileText,
    RefreshCw,
    Plus,
    Trash2,
    Edit3,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    Save,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function MemoryPanel({ onFileSelect, className, workspacePath }: MemoryPanelProps) {
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
                setStatus({ type: 'success', message: 'Memory context reloaded successfully' });
                await fetchFiles();
            } else {
                setStatus({ type: 'error', message: 'Failed to reload memory' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Network error during reload' });
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
                throw new Error(data.error || 'Failed to read memory file');
            }
            const data = await res.json();
            setEditorPath(data.path || filePath);
            setEditorContent(data.content || '');
            setEditorMode('edit');
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Failed to open memory file',
            });
        } finally {
            setEditorLoading(false);
        }
    };

    const handleCreate = async () => {
        const existingGeminiPath = files.find((filePath) => isGeminiMemoryFile(filePath));
        if (existingGeminiPath) {
            await openEditor(existingGeminiPath);
            setStatus({ type: 'success', message: 'GEMINI.md already exists. Opened for editing.' });
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
                throw new Error(data.error || 'Failed to save memory file');
            }

            const data = await res.json().catch(() => ({}));
            const savedPath = typeof data.path === 'string' && data.path.trim() ? data.path : editorPath;
            setEditorPath(savedPath);
            setEditorMode('edit');
            setStatus({
                type: 'success',
                message: editorMode === 'create' ? 'Created GEMINI.md' : 'Memory file saved',
            });
            await fetchFiles();
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Failed to save memory file',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (filePath: string) => {
        const confirmed = window.confirm(`Delete ${filePath}?`);
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
                throw new Error(data.error || 'Failed to delete memory file');
            }

            if (editorPath === filePath) {
                closeEditor();
            }
            setStatus({ type: 'success', message: 'Memory file deleted' });
            await fetchFiles();
        } catch (err) {
            setStatus({
                type: 'error',
                message: err instanceof Error ? err.message : 'Failed to delete memory file',
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
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 flex items-center justify-center">
            <div className="w-full max-w-4xl h-[calc(100vh-1rem)] sm:h-[min(88vh,920px)] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-3 sm:p-4 border-b bg-muted/20">
                    <div className="min-w-0 space-y-1">
                        <p className="text-base font-semibold truncate">{editorFileName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{editorPath}</p>
                    </div>
                    <button
                        onClick={closeEditor}
                        className="p-1.5 rounded hover:bg-muted"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 p-2 sm:p-4 overflow-hidden">
                    {editorLoading ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Loading file...
                        </div>
                    ) : (
                        <textarea
                            value={editorContent}
                            onChange={(event) => setEditorContent(event.target.value)}
                            className="w-full h-full min-h-0 resize-none rounded-lg border border-border bg-background p-3 sm:p-4 text-[13px] leading-6 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    )}
                </div>

                <div className="p-3 sm:p-4 border-t bg-muted/20 flex items-center justify-end gap-2">
                    <button
                        onClick={closeEditor}
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => void handleSave()}
                        disabled={saving || editorLoading}
                        className="px-3 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className={cn("flex flex-col h-full bg-card", className)}>
            <div className="p-3 border-b flex items-center justify-between bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-sm">Knowledge Base</h2>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCreate}
                        className="p-1.5 hover:bg-accent rounded-md transition-colors"
                        title="Create GEMINI.md"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
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
                        status.type === 'success'
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
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
                                Create <code>GEMINI.md</code> in your workspace or run <code>/init</code> in chat to scaffold memory context.
                            </p>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg mx-auto hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Initialize GEMINI.md
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Loaded Memory Documents</p>
                        {files.map((filePath) => {
                            const segments = filePath.split(/[\\/]/);
                            const name = segments[segments.length - 1] || filePath;
                            const dir = filePath.slice(0, Math.max(0, filePath.length - name.length)).replace(/[\\/]$/, '');

                            return (
                                <div
                                    key={filePath}
                                    className="group flex flex-col p-3 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/20 transition-all cursor-pointer relative"
                                    onClick={() => onFileSelect?.({ name, path: filePath })}
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
                                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void openEditor(filePath);
                                                }}
                                                className="p-1.5 hover:bg-background rounded-md text-muted-foreground transition-colors"
                                                title="Edit"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleDelete(filePath);
                                                }}
                                                className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md text-muted-foreground transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
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
                    The agent uses these files as long-lived project context. Save updates and click refresh when needed.
                </p>
                <div className="flex items-center gap-2 text-primary font-medium hover:underline cursor-pointer">
                    <ExternalLink className="w-3 h-3" />
                    Learn about GEMINI.md patterns
                </div>
            </div>

            {portalReady && editorModal ? createPortal(editorModal, document.body) : null}
        </div>
    );
}
