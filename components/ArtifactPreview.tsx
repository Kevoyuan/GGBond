'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactPreviewProps {
  filePath: string;
  onClose: () => void;
  className?: string;
}

export function ArtifactPreview({ filePath, onClose, className }: ArtifactPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchContent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to load artifact');
      const data = await res.json();
      setContent(data.content);
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

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background/95 backdrop-blur-xl border-l border-border/40 shadow-2xl z-50 overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-gradient-to-r from-background/50 to-muted/30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 border border-primary/20 shadow-inner">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          </div>
          <span className="text-sm font-semibold tracking-wide truncate text-foreground/90">{filePath.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-1 border border-border/50 shadow-sm backdrop-blur-md">
          <button onClick={handleCopy} className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all duration-300 group" title="Copy Source Code">
            {isCopied ? <Check className="w-4 h-4 text-green-500 transition-all duration-300 scale-110" /> : <Copy className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />}
          </button>
          <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
          <button onClick={handleRefresh} className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all duration-300 group" title="Refresh">
            <RefreshCw className={cn("w-4 h-4 group-hover:rotate-180 transition-transform duration-500", isLoading && "animate-spin")} />
          </button>
          <button onClick={handleOpenNewTab} className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all duration-300 group" title="Open in New Tab">
            <ExternalLink className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform duration-300" />
          </button>
          <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
          <button onClick={onClose} className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:shadow-sm transition-all duration-300 group" title="Close Preview">
            <X className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-white w-full h-full overflow-hidden">
        {isLoading && !content && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Loading preview...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="p-8 text-center">
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
