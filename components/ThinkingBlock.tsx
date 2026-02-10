'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface ThinkingBlockProps {
    content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
    const [collapsed, setCollapsed] = useState(true);

    if (!content) return null;

    return (
        <div className="my-2 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Thinking Process</span>
                <div className="ml-auto">
                    {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 rotate-180" />}
                </div>
            </button>

            {!collapsed && (
                <div className="px-4 py-3 text-sm text-muted-foreground border-t border-border/50 bg-background/50">
                    <div className="prose dark:prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
}
