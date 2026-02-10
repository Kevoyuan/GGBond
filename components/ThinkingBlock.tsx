
import { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils'; // Assuming cn utility exists

interface ThinkingBlockProps {
    content: string;
    defaultExpanded?: boolean;
}

export function ThinkingBlock({ content, defaultExpanded = false }: ThinkingBlockProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    if (!content) return null;

    return (
        <div className="my-2 border rounded-lg overflow-hidden bg-muted/30 border-border/50">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                title={isExpanded ? "Collapse thought process" : "Expand thought process"}
            >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Thinking Process</span>
                {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-50" />
                ) : (
                    <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />
                )}
            </button>

            {isExpanded && (
                <div className="px-4 py-3 border-t border-border/50 bg-background/50 text-sm text-muted-foreground">
                    <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-muted/50">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
}
