import { CodeBlock } from '../CodeBlock';

interface ShellToolViewProps {
    args: Record<string, unknown>;
    result?: string;
}

export function ShellToolView({ args, result }: ShellToolViewProps) {
    return (
        <div className="rounded-lg border border-border/40 bg-muted/5 overflow-hidden">
            <div className="flex gap-3 px-3 py-2 border-b border-border/10 bg-muted/20">
                <span className="text-[10px] font-bold text-muted-foreground/50 shrink-0 w-6 mt-0.5">IN</span>
                <div className="flex-1 font-mono text-[11px]">
                    <pre className="text-foreground/90 whitespace-pre-wrap">
                        {String(args.command || args.cmd || JSON.stringify(args, null, 2))}
                    </pre>
                </div>
            </div>
            {result && (
                <div className="flex gap-3 px-3 py-2">
                    <span className="text-[10px] font-bold text-muted-foreground/50 shrink-0 w-6 mt-0.5">OUT</span>
                    <div className="flex-1">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            <CodeBlock language="shell" code={result} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
