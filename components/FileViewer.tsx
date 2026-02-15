'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, FileCode, FileJson, FileText, FileImage, File, Loader2, AlertTriangle, Copy, Check, Save, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface FileViewerProps {
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

export function FileViewer({ filePath, fileName, onClose, className }: FileViewerProps) {
    const [fileContent, setFileContent] = useState<FileContent | null>(null);
    const [editedContent, setEditedContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showRender, setShowRender] = useState(false);

    const isMarkdown = fileContent?.language === 'markdown';
    const isDirty = editedContent !== (fileContent?.content || '');
    const canEdit = fileContent && !['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'pdf'].some(ext => filePath.toLowerCase().endsWith(ext));

    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
                setEditedContent(data.content);
            } catch {
                setError('Failed to load file');
            } finally {
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [filePath]);

    const handleSave = async () => {
        if (!fileContent || !isDirty) return;

        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/files/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: filePath,
                    content: editedContent,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Failed to save file');
                return;
            }

            setFileContent({ ...fileContent, content: editedContent });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch {
            setError('Failed to save file');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async () => {
        if (!fileContent) return;
        await navigator.clipboard.writeText(editedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newValue = editedContent.substring(0, start) + '  ' + editedContent.substring(end);
            setEditedContent(newValue);
            setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 2;
            }, 0);
        }
    };


    const getFileIcon = () => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts':
            case 'tsx':
            case 'js':
            case 'jsx':
            case 'py':
            case 'rs':
            case 'go':
                return <FileCode className="w-4 h-4" />;
            case 'json':
                return <FileJson className="w-4 h-4" />;
            case 'md':
            case 'txt':
                return <FileText className="w-4 h-4" />;
            case 'png':
            case 'jpg':
            case 'svg':
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
        <div className={cn('flex flex-col h-full bg-background animate-in fade-in duration-200', className)}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/80 backdrop-blur-sm shrink-0">
                <div
                    className={cn(
                        'shrink-0',
                        fileContent ? LANG_COLORS[fileContent.language] || 'text-muted-foreground' : 'text-muted-foreground'
                    )}
                >
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
                        <span className="text-[10px] text-muted-foreground">{formatSize(fileContent.size)}</span>
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
                    title="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/20">
                {isMarkdown && (
                    <button
                        onClick={() => setShowRender(false)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            !showRender
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                    >
                        <FileCode className="w-3.5 h-3.5" />
                        Code
                    </button>
                )}
                {isMarkdown && (
                    <button
                        onClick={() => setShowRender(true)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            showRender
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                    </button>
                )}
                {canEdit && (
                    <div className="ml-auto flex items-center gap-2">
                        {isDirty && (
                            <span className="text-[10px] text-amber-500">Unsaved changes</span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                isDirty && !isSaving
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                            )}
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : saveSuccess ? (
                                <Check className="w-3.5 h-3.5" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}
                        </button>
                    </div>
                )}
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading file...</p>
                    </div>
                ) : error && !fileContent ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-500" />
                        <p className="text-sm text-muted-foreground text-center">{error}</p>
                        <p className="text-xs text-muted-foreground/60">{filePath}</p>
                    </div>
                ) : fileContent ? (
                    <>
                        {/* Code View (Editable with syntax highlighting) */}
                        {(!isMarkdown || !showRender) && (
                            canEdit ? (
                                <div className="h-full flex flex-col font-mono text-[13px]">
                                    {/* Editor container with syntax highlighting */}
                                    <div className="flex-1 overflow-auto relative" ref={(el) => {
                                        if (el) {
                                            const textarea = el.querySelector('textarea');
                                            const pre = el.querySelector('pre');
                                            if (textarea && pre) {
                                                textarea.addEventListener('scroll', () => {
                                                    pre.scrollTop = textarea.scrollTop;
                                                    pre.scrollLeft = textarea.scrollLeft;
                                                });
                                            }
                                        }
                                    }}>
                                        {/* Syntax highlighted layer */}
                                        <pre className="absolute inset-0 m-0 p-[0.75rem_1rem_0.75rem_3.5em] overflow-auto pointer-events-none text-transparent bg-[#1e1e1e]">
                                            <code>
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={fileContent.language}
                                                    customStyle={{
                                                        margin: 0,
                                                        padding: 0,
                                                        background: 'transparent',
                                                        font: 'inherit',
                                                    }}
                                                    codeTagProps={{
                                                        style: {
                                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                            fontSize: '13px',
                                                            lineHeight: '1.5',
                                                        }
                                                    }}
                                                >
                                                    {editedContent}
                                                </SyntaxHighlighter>
                                            </code>
                                        </pre>
                                        {/* Line numbers */}
                                        <div className="absolute left-0 top-0 bottom-0 w-[3.5em] bg-[#1e1e1e] text-right pr-2 pt-[0.75rem] select-none overflow-hidden text-[#858585] text-[13px] leading-[1.5]">
                                            {editedContent.split('\n').map((_, i) => (
                                                <div key={i}>{i + 1}</div>
                                            ))}
                                        </div>
                                        {/* Editable textarea */}
                                        <textarea
                                            ref={textareaRef}
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-white border-0 p-[0.75rem_1rem_0.75rem_3.5em] m-0 font-mono text-[13px] leading-[1.5] focus:outline-none focus:ring-0 whitespace-pre overflow-auto"
                                            spellCheck={false}
                                            autoCapitalize="off"
                                            autoComplete="off"
                                            autoCorrect="off"
                                            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2 overflow-auto h-full">
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={fileContent.language}
                                        showLineNumbers={true}
                                        lineNumberStyle={{
                                            minWidth: '2.5em',
                                            paddingRight: '1em',
                                            color: 'rgba(255,255,255,0.25)',
                                            fontSize: '0.75rem',
                                            userSelect: 'none',
                                        }}
                                        customStyle={{
                                            margin: 0,
                                            borderRadius: '0.5rem',
                                            padding: '0.75rem 1rem',
                                            background: 'var(--color-code-bg, #1e1e1e)',
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        {fileContent.content}
                                    </SyntaxHighlighter>
                                </div>
                            )
                        )}

                        {/* Render View (Markdown) */}
                        {isMarkdown && showRender && (
                            <div className="p-6 overflow-auto h-full">
                                <div className="text-sm">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                            components={{
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                code: ({ node, className, children, ...props }: any) => {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    const isInline = !match && !String(children).includes('\n');

                                                    if (isInline) {
                                                        return (
                                                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground font-normal before:content-none after:content-none" {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    }

                                                    return (
                                                        <div className="relative my-4 rounded-lg overflow-hidden border bg-[#1e1e1e] not-prose">
                                                            {match?.[1] && (
                                                                <div className="absolute right-2 top-2 text-[10px] text-muted-foreground/50 font-mono select-none">
                                                                    {match[1]}
                                                                </div>
                                                            )}
                                                            <SyntaxHighlighter
                                                                style={vscDarkPlus}
                                                                language={match?.[1] || 'text'}
                                                                PreTag="div"
                                                                customStyle={{
                                                                    margin: 0,
                                                                    padding: '1rem',
                                                                    background: 'transparent',
                                                                    fontSize: '0.875rem',
                                                                }}
                                                                codeTagProps={{
                                                                    style: {
                                                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                                    }
                                                                }}
                                                                {...props}
                                                            >
                                                                {String(children).replace(/\n$/, '')}
                                                            </SyntaxHighlighter>
                                                        </div>
                                                    );
                                                },
                                            }}
                                        >
                                            {editedContent}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}
