
import { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils'; // Assuming cn utility exists

interface ThinkingBlockProps {
    content: string;
    defaultExpanded?: boolean;
}

interface ParsedThoughtItem {
    subject: string;
    description: string;
}

function splitConcatenatedJsonObjects(input: string): string[] {
    const chunks: string[] = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
            continue;
        }

        if (ch === '}') {
            if (depth > 0) depth--;
            if (depth === 0 && start >= 0) {
                chunks.push(input.slice(start, i + 1));
                start = -1;
            }
        }
    }

    return chunks;
}

function toThoughtItem(obj: unknown): ParsedThoughtItem | null {
    if (!obj || typeof obj !== 'object') return null;
    const record = obj as Record<string, unknown>;
    const subject = typeof record.subject === 'string' ? record.subject.trim() : '';
    const description = typeof record.description === 'string' ? record.description.trim() : '';
    if (!subject && !description) return null;

    return {
        subject: subject || 'Untitled',
        description,
    };
}

function parseThinkingItems(content: string): ParsedThoughtItem[] {
    const normalized = content.trim();
    if (!normalized) return [];

    const items: ParsedThoughtItem[] = [];

    const direct = (() => {
        try {
            return JSON.parse(normalized) as unknown;
        } catch {
            return null;
        }
    })();

    if (Array.isArray(direct)) {
        for (const entry of direct) {
            const item = toThoughtItem(entry);
            if (item) items.push(item);
        }
    } else if (direct) {
        const item = toThoughtItem(direct);
        if (item) items.push(item);
    }

    if (items.length > 0) return items;

    const byLines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of byLines) {
        try {
            const parsed = JSON.parse(line) as unknown;
            const item = toThoughtItem(parsed);
            if (item) items.push(item);
        } catch {
            // ignore non-JSON lines
        }
    }
    if (items.length > 0) return items;

    for (const chunk of splitConcatenatedJsonObjects(normalized)) {
        try {
            const parsed = JSON.parse(chunk) as unknown;
            const item = toThoughtItem(parsed);
            if (item) items.push(item);
        } catch {
            // ignore malformed chunk
        }
    }

    return items;
}

export function ThinkingBlock({ content, defaultExpanded = false }: ThinkingBlockProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const parsedItems = parseThinkingItems(content);
    const hasStructuredItems = parsedItems.length > 0;

    if (!content) return null;

    return (
        <div className="my-2 overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                title={isExpanded ? "Collapse thought process" : "Expand thought process"}
            >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Thinking Process</span>
                <ChevronRight className={cn(
                    "w-3.5 h-3.5 ml-auto opacity-50",
                    isExpanded && "rotate-90"
                )} />
            </button>

            {isExpanded && (
                <div className="px-3 py-2 text-sm text-muted-foreground border-l-2 border-border/40 ml-3.5 my-1">
                    {hasStructuredItems ? (
                        <div className="space-y-4">
                            {parsedItems.map((item, idx) => (
                                <div
                                    key={`${item.subject}-${idx}`}
                                    className="relative pl-4"
                                >
                                    <div className="text-xs font-medium text-foreground/90">
                                        {item.subject}
                                    </div>
                                    {item.description && (
                                        <div className="mt-1 text-xs leading-relaxed text-muted-foreground/90">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50">
                            <ReactMarkdown>{content}</ReactMarkdown>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
