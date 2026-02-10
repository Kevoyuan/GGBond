'use client';

import React, { useState, useEffect } from 'react';
import { X, FileCode, FileJson, FileText, FileImage, File, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
    filePath: string;
    fileName: string;
    onClose: () => void;
    className?: string;
}

interface FileContent {
    content: string;
    language: string;
    size: number;
    name: string;
    path: string;
}

const LANG_COLORS: Record<string, string> = {
    typescript: 'text-blue-400',
    tsx: 'text-blue-400',
    javascript: 'text-yellow-400',
    jsx: 'text-yellow-400',
    python: 'text-green-400',
    markdown: 'text-gray-400',
    json: 'text-green-500',
    css: 'text-purple-400',
    html: 'text-orange-400',
    rust: 'text-orange-500',
    go: 'text-cyan-400',
};

export function FilePreview({ filePath, fileName, onClose, className }: FilePreviewProps) {
    const [fileContent, setFileContent] = useState<FileContent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'Failed to load file');
                    return;
                }

                setFileContent(data);
            } catch {
                setError('Failed to load file');
            } finally {
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [filePath]);

    const handleCopy = async () => {
        if (!fileContent) return;
        await navigator.clipboard.writeText(fileContent.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getFileIcon = () => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': case 'tsx': case 'js': case 'jsx': case 'py': case 'rs': case 'go':
                return <FileCode className="w-4 h-4" />;
            case 'json':
                return <FileJson className="w-4 h-4" />;
            case 'md': case 'txt':
                return <FileText className="w-4 h-4" />;
            case 'png': case 'jpg': case 'svg':
                return <FileImage className="w-4 h-4" />;
            default:
                return <File className="w-4 h-4" />;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={cn(
            "flex flex-col h-full bg-background animate-in fade-in duration-200",
            className
        )}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/80 backdrop-blur-sm shrink-0">
                <div className={cn(
                    "shrink-0",
                    fileContent ? LANG_COLORS[fileContent.language] || 'text-muted-foreground' : 'text-muted-foreground'
                )}>
                    {getFileIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{fileName}</h3>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">{filePath}</p>
                </div>
                {fileContent && (
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {fileContent.language}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {formatSize(fileContent.size)}
                        </span>
                        <button
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy content"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                )}
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Close preview"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading file...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-500" />
                        <p className="text-sm text-muted-foreground text-center">{error}</p>
                        <p className="text-xs text-muted-foreground/60">{filePath}</p>
                    </div>
                ) : fileContent ? (
                    <div className="relative">
                        <pre className="text-[13px] leading-relaxed font-mono p-0 m-0">
                            <code>
                                {fileContent.content.split('\n').map((line, i) => (
                                    <div key={i} className="flex hover:bg-muted/30 transition-colors">
                                        <span className="select-none text-right text-muted-foreground/40 w-12 pr-4 shrink-0 text-[12px] leading-relaxed">
                                            {i + 1}
                                        </span>
                                        <span className="flex-1 pr-4 break-all whitespace-pre-wrap">
                                            {line || '\u00A0'}
                                        </span>
                                    </div>
                                ))}
                            </code>
                        </pre>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
