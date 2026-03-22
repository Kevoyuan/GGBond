'use client';

import React from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface PlanBlockProps {
    content: string;
}

interface PlanItem {
    id: string;
    type: 'task';
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
    content: string;
    indent: number;
}

function parsePlan(markdown: string): PlanItem[] {
    const lines = markdown.split('\n');
    const items: PlanItem[] = [];

    const taskRegex = /^(\s*)- \[([ xX/~])\] (.*)$/;

    lines.forEach((line, index) => {
        const match = line.match(taskRegex);
        if (match) {
            const indent = match[1].length;
            const statusChar = match[2];
            let status: PlanItem['status'] = 'pending';

            if (statusChar === 'x' || statusChar === 'X') status = 'completed';
            else if (statusChar === '/') status = 'in-progress';
            else if (statusChar === '~') status = 'cancelled';

            // Check for failure indicator in content or status? 
            // Usually [ ] is pending, [x] is done. 
            // Let's assume standard GFM + custom [/] for in-progress.

            let content = match[3];

            // Extract ID if present (<!-- id: 0 -->)
            const idMatch = content.match(/<!-- id: (\d+) -->/);
            const id = idMatch ? idMatch[1] : `task-${index}`;

            // Clean content from ID
            content = content.replace(/<!-- id: \d+ -->/, '').trim();

            items.push({
                id,
                type: 'task',
                status,
                content,
                indent
            });
        }
    });

    return items;
}

export function PlanBlock({ content }: PlanBlockProps) {
    const items = parsePlan(content);

    // Extract title if present (Lines starting with # before the first task)
    // For now, simpler approach: The PlanBlock receives the full content of the "Updated Plan" section.
    // We can render non-task lines as well?

    return (
        <div className="my-4 rounded-xl overflow-hidden border border-border/50 bg-card/50 shadow-sm w-full max-w-2xl animate-fade-in relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border/40 dashed" />

            <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/50">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h3 className="text-sm font-semibold text-foreground">Updated Plan</h3>
            </div>

            <div className="p-4 space-y-4 relative">
                {items.map((item, idx) => (
                    <div
                        key={item.id}
                        className={cn(
                            "relative flex gap-3 group",
                            item.indent > 0 ? "ml-6" : ""
                        )}
                    >
                        {/* Timeline Connector */}
                        {idx !== items.length - 1 && (
                            <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-border/30 group-last:hidden" />
                        )}

                        {/* Status Icon */}
                        <div className={cn(
                            "relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors duration-300",
                            item.status === 'completed'
                                ? "bg-green-500/20 border-green-500/50 text-green-500"
                                : item.status === 'in-progress'
                                    ? "bg-blue-500/20 border-blue-500/50 text-blue-500"
                                    : "bg-muted/30 border-border text-muted-foreground"
                        )}>
                            {item.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                            {item.status === 'in-progress' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {item.status === 'pending' && <Circle className="w-3.5 h-3.5 opacity-0" />}
                        </div>

                        {/* Content */}
                        <div className={cn(
                            "flex-1 text-sm pt-0.5 transition-colors duration-200",
                            item.status === 'completed' ? "text-muted-foreground line-through decoration-border" : "text-foreground"
                        )}>
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => <span className="m-0 text-inherit leading-normal block">{children}</span>
                                }}
                            >
                                {item.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
