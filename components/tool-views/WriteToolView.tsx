import { CodeBlock } from '../CodeBlock';
import { DiffBlock } from '../DiffBlock';

interface WriteToolViewProps {
    args: Record<string, unknown>;
    target?: string;
    result?: string;
}

function parseResult(result: string | undefined) {
    let diffContent = result;
    let sourcePath: string | undefined;

    if (result && result.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(result);
            if (parsed.fileDiff) {
                diffContent = parsed.fileDiff;
            }
            if (parsed.fileName) {
                sourcePath = parsed.fileName;
            }
        } catch {
            // Fallback to raw result
        }
    }

    return { diffContent, sourcePath };
}

export function WriteToolView({ args, target, result }: WriteToolViewProps) {
    const { diffContent, sourcePath } = parseResult(result);
    const lang = target?.split('.').pop() || 'text';
    const code = String(args.content || args.code || JSON.stringify(args, null, 2));

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5 opacity-70">
                <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
                    writing to {target}
                </span>
            </div>
            <CodeBlock
                language={lang}
                code={code}
            />
            {diffContent && (diffContent.includes('@@') || diffContent.includes('Index:')) ? (
                <div className="mt-4 pt-4 border-t border-border/40">
                    <div className="flex items-center gap-1.5 mb-2 opacity-70">
                        <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">changes</span>
                    </div>
                    <DiffBlock code={diffContent} filename={sourcePath || target} />
                </div>
            ) : result ? (
                <div className="text-[11px] text-muted-foreground/60 italic px-1 mt-2">
                    {result}
                </div>
            ) : null}
        </div>
    );
}
