import { CodeBlock } from '../CodeBlock';

interface ReadToolViewProps {
    args: Record<string, unknown>;
    result?: string;
}

export function ReadToolView({ args, result }: ReadToolViewProps) {
    return (
        <div className="space-y-2">
            {result && (
                <CodeBlock
                    language={args.path?.toString().split('.').pop() || 'text'}
                    code={result}
                    collapsible={false}
                />
            )}
        </div>
    );
}
