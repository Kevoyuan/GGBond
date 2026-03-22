'use client';

import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffBlockProps {
    code: string;
    filename?: string;
}

interface DiffLine {
    type: 'add' | 'remove' | 'context' | 'header' | 'meta';
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
}

function parseDiffLines(code: string): DiffLine[] {
    const rawLines = code.split('\n');
    const lines: DiffLine[] = [];
    let oldLine = 0;
    let newLine = 0;

    for (const raw of rawLines) {
        if (raw.startsWith('@@')) {
            // Parse hunk header: @@ -start,count +start,count @@
            const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
                oldLine = parseInt(match[1], 10);
                newLine = parseInt(match[2], 10);
            }
            lines.push({ type: 'header', content: raw });
        } else if (raw.startsWith('---') || raw.startsWith('+++') || raw.startsWith('diff ') || raw.startsWith('index ')) {
            lines.push({ type: 'meta', content: raw });
        } else if (raw.startsWith('+')) {
            lines.push({ type: 'add', content: raw.slice(1), newLineNum: newLine });
            newLine++;
        } else if (raw.startsWith('-')) {
            lines.push({ type: 'remove', content: raw.slice(1), oldLineNum: oldLine });
            oldLine++;
        } else {
            // Context line (may start with space)
            const content = raw.startsWith(' ') ? raw.slice(1) : raw;
            lines.push({ type: 'context', content, oldLineNum: oldLine, newLineNum: newLine });
            oldLine++;
            newLine++;
        }
    }

    return lines;
}

function extractFilename(code: string): string | undefined {
    // Try to extract filename from diff headers
    const lines = code.split('\n');
    for (const line of lines) {
        if (line.startsWith('+++ b/')) return line.slice(6);
        if (line.startsWith('+++ ')) return line.slice(4);
    }
    return undefined;
}

export function DiffBlock({ code, filename }: DiffBlockProps) {
    const [copied, setCopied] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const detectedFilename = filename || extractFilename(code);
    const lines = parseDiffLines(code);

    // Stats
    const additions = lines.filter(l => l.type === 'add').length;
    const deletions = lines.filter(l => l.type === 'remove').length;

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-4 rounded-lg overflow-hidden border border-border/50 bg-card max-w-full w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/50">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-0.5 hover:bg-background rounded transition-colors shrink-0"
                    >
                        {collapsed
                            ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                    </button>
                    <FileCode2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">
                        {detectedFilename || 'diff'}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                        {additions > 0 && (
                            <span className="text-[10px] font-mono font-semibold text-green-600 dark:text-green-400">
                                +{additions}
                            </span>
                        )}
                        {deletions > 0 && (
                            <span className="text-[10px] font-mono font-semibold text-red-600 dark:text-red-400">
                                -{deletions}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-background rounded-md transition-colors opacity-0 group-hover/code:opacity-100 shrink-0"
                    title="Copy diff"
                >
                    {copied
                        ? <Check className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                </button>
            </div>

            {/* Diff content */}
            {!collapsed && (
                <div className="overflow-x-auto text-[13px] font-mono leading-[1.6]">
                    {lines.map((line, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex",
                                line.type === 'add' && "bg-green-50 dark:bg-green-950/40",
                                line.type === 'remove' && "bg-red-50 dark:bg-red-950/40",
                                line.type === 'header' && "bg-blue-50 dark:bg-blue-950/30",
                                line.type === 'meta' && "bg-muted/30",
                            )}
                        >
                            {/* Indicator bar */}
                            <div
                                className={cn(
                                    "w-1 shrink-0",
                                    line.type === 'add' && "bg-green-400 dark:bg-green-500",
                                    line.type === 'remove' && "bg-red-400 dark:bg-red-500",
                                )}
                            />

                            {/* Line numbers */}
                            {line.type !== 'header' && line.type !== 'meta' && (
                                <>
                                    <span className="w-10 shrink-0 text-right pr-1.5 text-[11px] text-muted-foreground/50 select-none py-px">
                                        {line.type === 'add' ? '' : (line.oldLineNum ?? '')}
                                    </span>
                                    <span className="w-10 shrink-0 text-right pr-1.5 text-[11px] text-muted-foreground/50 select-none py-px">
                                        {line.type === 'remove' ? '' : (line.newLineNum ?? '')}
                                    </span>
                                </>
                            )}

                            {/* Sign */}
                            <span
                                className={cn(
                                    "w-5 shrink-0 text-center select-none py-px font-bold",
                                    line.type === 'add' && "text-green-600 dark:text-green-400",
                                    line.type === 'remove' && "text-red-600 dark:text-red-400",
                                    line.type === 'header' && "text-blue-600 dark:text-blue-400",
                                )}
                            >
                                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'header' ? '' : ' '}
                            </span>

                            {/* Content */}
                            <span
                                className={cn(
                                    "flex-1 whitespace-pre pr-4 py-px",
                                    line.type === 'add' && "text-green-900 dark:text-green-200",
                                    line.type === 'remove' && "text-red-900 dark:text-red-200",
                                    line.type === 'header' && "text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-1",
                                    line.type === 'meta' && "text-muted-foreground text-xs italic",
                                    line.type === 'context' && "text-foreground/80",
                                )}
                            >
                                {line.content}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
