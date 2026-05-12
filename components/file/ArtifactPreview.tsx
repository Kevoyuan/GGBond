'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import type { ChangeEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Code,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPreviewProps {
  filePath: string;
  onClose: () => void;
  className?: string;
}

export const ArtifactPreview = memo(function ArtifactPreview({ filePath, onClose, className }: ArtifactPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isDirty = editedContent !== content;
  const fileMeta = useMemo(() => {
    const segments = filePath.split('/').filter(Boolean);
    const name = segments.at(-1) || filePath;
    const extension = name.includes('.') ? name.split('.').pop() || 'file' : 'file';
    const parent = segments.slice(-3, -1).join('/');

    return { name, extension, parent };
  }, [filePath]);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load artifact');
      const data = await res.json();
      setContent(data.content);
      setEditedContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleRefresh = useCallback(() => {
    fetchContent();
  }, [fetchContent]);

  const handleOpenNewTab = useCallback(() => {
    // Create a blob URL to open in new tab
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }, [content]);

  const handleEditSource = useCallback(async () => {
    try {
      await fetch('/api/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      });
    } catch (err) {
      console.error('Failed to open file in IDE:', err);
    }
  }, [filePath]);

  const handleSetViewMode = useCallback((mode: 'preview' | 'code') => {
    if (mode === 'code' && viewMode === 'preview') {
      setEditedContent(content);
    }
    setViewMode(mode);
  }, [viewMode, content]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/files/content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath, content: editedContent }),
      });

      if (!res.ok) throw new Error('Failed to save file');

      setContent(editedContent);
      setViewMode('preview');
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  }, [filePath, editedContent]);

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(viewMode === 'code' ? editedContent : content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [content, editedContent, viewMode]);

  const handleEditContentChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  }, []);

  return (
    <div className={cn("flex h-full flex-col overflow-hidden border-l border-border/70 bg-background text-foreground shadow-2xl", className)}>
      <div className="shrink-0 border-b border-border/70 bg-background/95">
        <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/45 text-muted-foreground">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold leading-5 text-foreground">{fileMeta.name}</span>
                <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none text-muted-foreground">
                  {fileMeta.extension}
                </span>
                {isDirty && (
                  <span className="shrink-0 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-600 dark:text-amber-400">
                    Unsaved
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                {fileMeta.parent ? `${fileMeta.parent}/` : ''}{fileMeta.name}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {viewMode === 'code' && (
              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors",
                  isDirty
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground/45",
                  (isSaving || !isDirty) && "cursor-not-allowed"
                )}
                title="Save changes"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
            )}
            <button onClick={handleEditSource} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Open source file">
              <FolderOpen className="h-4 w-4" />
            </button>
            <button onClick={handleCopy} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Copy content">
              {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button onClick={handleRefresh} className="group flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Refresh">
              <RefreshCw className={cn("h-4 w-4 transition-transform group-hover:rotate-180", isLoading && "animate-spin")} />
            </button>
            {viewMode === 'preview' && (
              <button onClick={handleOpenNewTab} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Close preview">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-2">
          <div className="flex rounded-md border border-border bg-muted/35 p-0.5">
            <button
              onClick={() => handleSetViewMode('preview')}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                viewMode === 'preview' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={() => handleSetViewMode('code')}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                viewMode === 'code' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Code className="h-3.5 w-3.5" />
              Source
            </button>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {content.length ? `${content.length.toLocaleString()} chars` : 'Waiting for artifact'}
          </div>
        </div>
      </div>

      <div className="relative h-full w-full flex-1 overflow-hidden bg-muted/20">
        {isLoading && !content && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-background px-5 py-4 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Loading artifact</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center bg-background p-8 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Failed to load artifact</h3>
            <p className="mx-auto max-w-xs text-xs leading-5 text-muted-foreground">{error}</p>
            <button
              onClick={fetchContent}
              className="mt-4 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        ) : viewMode === 'code' ? (
          <textarea
            value={editedContent}
            onChange={handleEditContentChange}
            spellCheck={false}
            className="h-full w-full resize-none border-none bg-background p-5 font-mono text-[13px] leading-relaxed text-foreground selection:bg-primary/20 focus:outline-none focus:ring-0"
            placeholder="File content..."
          />
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={content}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin allow-downloads"
            title="Artifact Preview"
          />
        )}
      </div>
    </div>
  );
});
