'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
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

  return (
    <div className={cn("flex flex-col h-full bg-background border-l", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium truncate">{filePath.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleRefresh} className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          <button onClick={handleOpenNewTab} className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Open in New Tab">
            <ExternalLink className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Close Preview">
            <X className="w-4 h-4" />
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
