'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink, Loader2, Copy, Check, Code, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPreviewProps {
  filePath: string;
  onClose: () => void;
  className?: string;
}

export function ArtifactPreview({ filePath, onClose, className }: ArtifactPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchContent = async () => {
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
  };

  useEffect(() => {
    fetchContent();
  }, [filePath]);

  const handleRefresh = () => {
    fetchContent();
  };

  const handleOpenNewTab = () => {
    // Create a blob URL to open in new tab
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleEditSource = async () => {
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
  };

  const handleToggleViewMode = () => {
    if (viewMode === 'preview') {
      setEditedContent(content); // Reset edited content to current saved content when entering code mode
      setViewMode('code');
    } else {
      setViewMode('preview');
    }
  };

  const handleSave = async () => {
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
      // You could add a toast error notification here if you have a toast system
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(viewMode === 'code' ? editedContent : content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };


  return (
    <div className={cn("flex flex-col h-full bg-background/95 backdrop-blur-xl border-l border-border/40 shadow-2xl z-50 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-background/60 backdrop-blur-xl shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-colors duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-primary/10 border border-primary/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse transition-colors duration-300", viewMode === 'code' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-green-500')} />
          </div>
          <span className="text-sm font-medium tracking-tight truncate text-foreground/90">{filePath.split('/').pop()}{viewMode === 'code' && <span className="text-muted-foreground ml-2 font-normal text-xs">— Code View</span>}</span>
        </div>
        <div className="flex items-center gap-1 bg-background/40 rounded-lg p-1 border border-border/50 shadow-sm backdrop-blur-md">
          {viewMode === 'code' && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving || editedContent === content}
                className={cn(
                  "relative flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md transition-all duration-200 group cursor-pointer",
                  isSaving ? "text-primary/70 cursor-not-allowed" :
                    editedContent !== content ? "text-primary hover:bg-primary/10 hover:shadow-sm hover:scale-105" : "text-muted-foreground/50 cursor-not-allowed"
                )}
                title="Save Changes"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 transition-transform duration-200" />}
              </button>
              <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
            </>
          )}

          <button
            onClick={handleToggleViewMode}
            className={cn(
              "relative flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md transition-all duration-200 group cursor-pointer",
              viewMode === 'code' ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm hover:scale-105"
            )}
            title={viewMode === 'code' ? "Preview Output" : "View Source Code"}
          >
            <Code className="w-4 h-4 transition-transform duration-200" />
          </button>
          <div className="w-[1px] h-4 bg-border/50 mx-0.5" />

          <button onClick={handleCopy} className="relative flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm hover:scale-105 transition-all duration-200 group cursor-pointer" title="Copy Content">
            {isCopied ? <Check className="w-4 h-4 text-green-500 transition-all duration-300 scale-110" /> : <Copy className="w-4 h-4 transition-transform duration-300" />}
          </button>
          <div className="w-[1px] h-4 bg-border/50 mx-0.5" />

          <button onClick={handleRefresh} className="relative flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm hover:scale-105 transition-all duration-200 group cursor-pointer" title="Refresh">
            <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 group-hover:rotate-180", isLoading && "animate-spin")} />
          </button>

          {viewMode === 'preview' && (
            <button onClick={handleOpenNewTab} className="relative flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm hover:scale-105 transition-all duration-200 group cursor-pointer" title="Open in New Tab">
              <ExternalLink className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-[1px] group-hover:translate-x-[1px]" />
            </button>
          )}

          <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
          <button onClick={onClose} className="relative flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-red-500/15 hover:text-red-600 hover:shadow-sm hover:scale-105 transition-all duration-200 group cursor-pointer" title="Close Preview">
            <X className="w-4 h-4 transition-transform duration-200" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-background w-full h-full overflow-hidden">
        {isLoading && !content && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading preview...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="p-8 text-center h-full flex flex-col items-center justify-center bg-white">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">Failed to load preview</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">{error}</p>
            <button
              onClick={fetchContent}
              className="mt-4 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : viewMode === 'code' ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            spellCheck={false}
            className="w-full h-full resize-none p-5 font-mono text-[13px] leading-relaxed bg-[var(--background)] text-[var(--foreground)] border-none focus:outline-none focus:ring-0 selection:bg-primary/20 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
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
}
