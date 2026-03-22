import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DefaultToolViewProps {
    args: Record<string, unknown>;
    result?: string;
    status?: string;
}

export function DefaultToolView({ args, result, status = 'completed' }: DefaultToolViewProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (result) {
            navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1 opacity-70">
                    <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">input</span>
                </div>
                <div className="font-mono text-[11px] overflow-x-auto bg-muted/5 p-2 rounded border border-border/10">
                    <pre className="text-muted-foreground leading-relaxed">
                        {JSON.stringify(args, null, 2)}
                    </pre>
                </div>
            </div>
            {result && (
                <div className="min-w-0">
                    <div className="flex items-center justify-between mb-1 opacity-70">
                        <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">output</span>
                        <button
                            onClick={handleCopy}
                            className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                            title="Copy output"
                        >
                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                    <div className="font-mono text-[11px] overflow-x-auto max-h-[400px] custom-scrollbar relative bg-muted/5 p-2 rounded border border-border/10">
                        <pre className={cn("text-muted-foreground whitespace-pre-wrap break-words leading-relaxed", status === 'failed' && "text-rose-500")}>
                            {result}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
