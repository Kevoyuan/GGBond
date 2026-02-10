'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface ThinkingBlockProps {
    content: string;
    status?: 'loading' | 'done';
}

export function ThinkingBlock({ content, status = 'done' }: ThinkingBlockProps) {
    const [expanded, setExpanded] = useState(false);

    if (!content) return null;

    return (
        <div className="relative">
            {/* Dot for timeline */}
            <div className="absolute -left-[32px] top-[7px] w-2 h-2 rounded-full z-10 bg-muted-foreground/40" />

            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
            >
                <span className="italic text-sm">Thinking</span>
                <ChevronDown className={cn(
                    "w-3 h-3 transition-transform duration-200",
                    expanded && "rotate-180"
                )} />
            </button>

            {expanded && (
                <div className="mt-2 text-sm text-muted-foreground/80 leading-relaxed">
                    <div className="prose dark:prose-invert prose-sm max-w-none opacity-80">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
}
