import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Loader2,
  FileCode,
  FileJson,
  FileImage,
  FileText,
  Home,
  ArrowUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileEntry {
  name: string;
  type: 'directory' | 'file';
  path: string;
  extension: string | null;
}

interface FileExplorerProps {
  initialPath?: string;
  onFileSelect?: (file: FileEntry) => void;
}

export function FileExplorer({ initialPath, onFileSelect }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async (path?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (path) params.append('path', path);
      
      const res = await fetch(`/api/files?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load files');
      
      const data = await res.json();
      setFiles(data.files);
      setCurrentPath(data.path);
    } catch (err) {
      setError('Could not load directory');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(initialPath);
  }, [initialPath]);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      loadFiles(entry.path);
    } else {
      onFileSelect?.(entry);
    }
  };

  const navigateUp = () => {
    if (!currentPath) return;
    // Simple parent directory calculation
    // This assumes standard path separators. 
    // For a robust solution, the API could return the parent path.
    // But let's try to handle it client side for now or ask API for parent.
    // Actually, asking API for parent path logic is safer but let's try simple splitting.
    const parentPath = currentPath.split(/[/\\]/).slice(0, -1).join('/') || '/';
    loadFiles(parentPath);
  };

  const getFileIcon = (entry: FileEntry) => {
    if (entry.type === 'directory') return <Folder className="w-4 h-4 text-blue-400" />;
    
    switch (entry.extension) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        return <FileCode className="w-4 h-4 text-yellow-400" />;
      case '.json':
        return <FileJson className="w-4 h-4 text-green-400" />;
      case '.png':
      case '.jpg':
      case '.svg':
        return <FileImage className="w-4 h-4 text-purple-400" />;
      case '.md':
      case '.txt':
        return <FileText className="w-4 h-4 text-gray-400" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/5">
      {/* Header / Breadcrumbs */}
      <div className="p-3 border-b bg-card/50 flex items-center gap-2">
        <button 
          onClick={() => loadFiles(undefined)} // Go to root/home
          className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Go to Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <button 
          onClick={navigateUp}
          className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Go Up"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <div className="text-xs text-muted-foreground truncate flex-1 font-mono direction-rtl">
            {currentPath}
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center p-4 text-red-400 text-sm">{error}</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {files.map((file) => (
              <div
                key={file.path}
                onClick={() => handleEntryClick(file)}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors group"
              >
                {getFileIcon(file)}
                <span className="truncate flex-1">{file.name}</span>
                {file.type === 'directory' && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                )}
              </div>
            ))}
            {files.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs opacity-60">
                Empty directory
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
