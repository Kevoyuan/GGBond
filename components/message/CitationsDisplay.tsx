import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CitationsDisplayProps {
    citations: string[];
}

export const CitationsDisplay = React.memo(function CitationsDisplay({ citations }: CitationsDisplayProps) {
    if (!citations || citations.length === 0) return null;

    // Deduplicate and clean
    const uniqueCitations = Array.from(new Set(citations.filter(c => c && c.trim())));

    return (
        <div className="mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-1.5 mb-2.5">
                <div className="w-1 h-3.5 bg-primary/40 rounded-full" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Sources & Citations</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {uniqueCitations.map((citation, i) => {
                    const isUrl = citation.startsWith('http');
                    let label = citation;
                    let icon: React.ReactNode = <Info className="w-3 h-3" />;

                    if (isUrl) {
                        try {
                            const url = new URL(citation);
                            label = url.hostname.replace('www.', '');
                            // Simple domain icons
                            if (url.hostname.includes('github.com')) icon = <span className="text-[10px] font-bold text-blue-500">GH</span>;
                            else if (url.hostname.includes('google.com')) icon = <span className="text-[10px] font-bold text-blue-400">G</span>;
                            else if (url.hostname.includes('wikipedia.org')) icon = <span className="text-[10px] font-bold text-slate-500">W</span>;
                        } catch {
                            label = citation;
                        }
                    }

                    return (
                        <a
                            key={i}
                            href={isUrl ? citation : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-all text-[11px] font-medium",
                                isUrl ? "text-primary hover:border-primary/30" : "text-muted-foreground cursor-default"
                            )}
                        >
                            <div className="w-4 h-4 rounded-md bg-background flex items-center justify-center shrink-0 border border-border/50 shadow-sm">
                                {icon}
                            </div>
                            <span className="truncate max-w-[150px]">{label}</span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
});
