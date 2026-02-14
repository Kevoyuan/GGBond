
'use client';

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
    Search,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileEntry {
    name: string;
    type: 'directory' | 'file';
    path: string;
    extension: string | null;
}

interface FileTreeProps {
    initialPath?: string;
    onFileSelect?: (file: FileEntry) => void;
    className?: string;
}

export function FileTree({ initialPath, onFileSelect, className }: FileTreeProps) {
    const [rootPath, setRootPath] = useState<string>(initialPath || '');
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className={cn("flex flex-col h-full bg-card/30", className)}>
            <div className="p-3 border-b flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Workspace</h4>
                <button
                    onClick={() => setRootPath(initialPath || '')}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
            </div>

            <div className="p-2 border-b">
                <div className="relative group">
                    <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Filter files..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-muted/20 border border-border/50 rounded-md pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
                <DirectoryNode
                    path={rootPath}
                    name={rootPath.split('/').pop() || 'root'}
                    onFileSelect={onFileSelect}
                    defaultExpanded={true}
                    searchTerm={searchTerm}
                />
            </div>
        </div>
    );
}

interface DirectoryNodeProps {
    path: string;
    name: string;
    onFileSelect?: (file: FileEntry) => void;
    depth?: number;
    defaultExpanded?: boolean;
    searchTerm?: string;
}

function DirectoryNode({ path, name, onFileSelect, depth = 0, defaultExpanded = false, searchTerm }: DirectoryNodeProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        if (isExpanded && !hasLoaded) {
            loadFiles();
        }
    }, [isExpanded, hasLoaded]);

    const loadFiles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/files?path=${encodeURIComponent(path)}&ignore=0`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.files);
                setHasLoaded(true);
            }
        } catch (err) {
            console.error('Failed to load directory:', path, err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const filteredFiles = searchTerm
        ? files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.type === 'directory')
        : files;

    return (
        <div className="flex flex-col select-none">
            <div
                onClick={toggle}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer hover:bg-muted/60 transition-colors group",
                    depth > 0 && "ml-3"
                )}
            >
                <span className="shrink-0 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/70" />
                </span>
                <Folder className="w-4 h-4 text-blue-400/80 shrink-0" />
                <span className="text-[13px] truncate text-muted-foreground group-hover:text-foreground">{name}</span>
            </div>

            {isExpanded && (
                <div className="flex flex-col border-l border-border/30 ml-[18px]">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-1.5 ml-3">
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />
                            <span className="text-[11px] text-muted-foreground/50 italic">Loading...</span>
                        </div>
                    ) : (
                        <>
                            {filteredFiles.map((file) => (
                                file.type === 'directory' ? (
                                    <DirectoryNode
                                        key={file.path}
                                        path={file.path}
                                        name={file.name}
                                        onFileSelect={onFileSelect}
                                        depth={0} // Managed by padding
                                        searchTerm={searchTerm}
                                    />
                                ) : (
                                    <FileNode
                                        key={file.path}
                                        file={file}
                                        onSelect={onFileSelect}
                                    />
                                )
                            ))}
                            {hasLoaded && files.length === 0 && (
                                <div className="px-4 py-1 text-[11px] text-muted-foreground/40 italic ml-4">Empty</div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function FileNode({ file, onSelect }: { file: FileEntry; onSelect?: (file: FileEntry) => void }) {
    const getFileIcon = (entry: FileEntry) => {
        switch (entry.extension) {
            case '.ts':
            case '.tsx':
            case '.js':
            case '.jsx':
                return <FileCode className="w-3.5 h-3.5 text-yellow-500/80 shrink-0" />;
            case '.json':
                return <FileJson className="w-3.5 h-3.5 text-emerald-500/80 shrink-0" />;
            case '.png':
            case '.jpg':
            case '.svg':
                return <FileImage className="w-3.5 h-3.5 text-purple-500/80 shrink-0" />;
            case '.md':
            case '.txt':
                return <FileText className="w-3.5 h-3.5 text-slate-400/80 shrink-0" />;
            default:
                return <File className="w-3.5 h-3.5 text-slate-400/80 shrink-0" />;
        }
    };

    return (
        <div
            onClick={() => onSelect?.(file)}
            className="flex items-center gap-2 px-2 py-1 ml-4 rounded-md cursor-pointer hover:bg-muted/60 transition-colors group"
        >
            {getFileIcon(file)}
            <span className="text-[13px] truncate text-muted-foreground group-hover:text-foreground">{file.name}</span>
        </div>
    );
}
