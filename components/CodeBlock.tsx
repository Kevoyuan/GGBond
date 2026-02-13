'use client';

import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
    language: string;
    code: string;
    collapsible?: boolean;
}

const COLLAPSE_THRESHOLD = 20;
const VISIBLE_LINES = 10;

export function CodeBlock({ language, code, collapsible = true }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const lineCount = code.split('\n').length;
    const shouldCollapse = collapsible && lineCount > COLLAPSE_THRESHOLD;
    const [collapsed, setCollapsed] = useState(shouldCollapse);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const displayCode = collapsed
        ? code.split('\n').slice(0, VISIBLE_LINES).join('\n')
        : code;

    return (
        <div className="relative group/code my-4 rounded-lg overflow-hidden border border-border/50 max-w-full w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{language}</span>
                    <span className="text-[10px] text-muted-foreground/50">{lineCount} lines</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-background rounded-md transition-colors opacity-0 group-hover/code:opacity-100"
                    title="Copy code"
                >
                    {copied
                        ? <Check className="w-3.5 h-3.5 text-green-500" />
                        : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                </button>
            </div>

            {/* Code */}
            <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
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
                    borderRadius: 0,
                    padding: '0.75rem 1rem',
                    background: 'var(--color-code-bg, #1e1e1e)',
                    fontSize: '0.8125rem',
                }}
            >
                {displayCode}
            </SyntaxHighlighter>

            {/* Collapse/Expand overlay */}
            {shouldCollapse && (
                <div
                    className={cn(
                        "relative",
                        collapsed && "mt-0"
                    )}
                >
                    {collapsed && (
                        <div className="absolute bottom-full left-0 right-0 h-10 bg-gradient-to-t from-[#1e1e1e] to-transparent pointer-events-none" />
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-[#1e1e1e] hover:bg-[#252525] border-t border-border/30 transition-colors"
                    >
                        {collapsed ? (
                            <>
                                <ChevronDown className="w-3 h-3" />
                                <span>Show remaining {lineCount - VISIBLE_LINES} lines</span>
                            </>
                        ) : (
                            <>
                                <ChevronRight className="w-3 h-3 rotate-[-90deg]" />
                                <span>Collapse</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
