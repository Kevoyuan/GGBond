import { CodeBlock } from '../CodeBlock';
import { DiffBlock } from '../DiffBlock';

interface EditToolViewProps {
    args: Record<string, unknown>;
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

export function EditToolView({ args, result }: EditToolViewProps) {
    const { diffContent, sourcePath } = parseResult(result);
    const path = String(args.path || args.file_path || sourcePath || '');

    if (diffContent && (diffContent.includes('@@') || diffContent.includes('Index:'))) {
        return <DiffBlock code={diffContent} filename={sourcePath || path} />;
    }

    const ext = sourcePath?.split('.').pop() || path?.split('.').pop() || 'text';

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5 opacity-70">
                <span className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">result content</span>
            </div>
            <CodeBlock
                language={String(ext)}
                code={result || ''}
            />
        </div>
    );
}
