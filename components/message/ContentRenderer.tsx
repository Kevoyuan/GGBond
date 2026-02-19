import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { ToolCallCard } from '../ToolCallCard';
import { PlanBlock } from '../PlanBlock';
import { DiffBlock } from '../DiffBlock';
import { CodeBlock } from '../CodeBlock';
import {
    SkillMetaMap,
    loadSkillMetaMap,
    collectSkillSpans,
    injectSkillRefs,
    renderTextWithSkillRefs,
    parseSkillFrontmatter
} from './SkillBadge';
import { CodeCopyButton } from './CopyButtons';
import { useToolExecutionOutputContext } from '../ToolExecutionOutputProvider';

interface ContentRendererProps {
    content: string;
    sourceMessageId?: string;
    onUndoTool?: (restoreId: string, sourceMessageId?: string) => Promise<void> | void;
    onRetry?: (mode: 'once' | 'session') => void;
    onCancel?: () => void;
    hideTodoToolCalls?: boolean;
}

export const ContentRenderer = React.memo(function ContentRenderer({
    content,
    sourceMessageId,
    onUndoTool,
    onRetry,
    onCancel,
    hideTodoToolCalls = false
}: ContentRendererProps) {
    // Use context for live tool outputs
    const { getOutput } = useToolExecutionOutputContext();

    const [skillMetaMap, setSkillMetaMap] = useState<SkillMetaMap>({});
    const skillSpans = useMemo(() => collectSkillSpans(content, skillMetaMap), [content, skillMetaMap]);
    const attemptedSkillPathRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        let disposed = false;
        loadSkillMetaMap().then((map) => {
            if (!disposed) {
                setSkillMetaMap(map);
            }
        });
        return () => {
            disposed = true;
        };
    }, []);

    useEffect(() => {
        let disposed = false;

        const unresolvedPathSpans = skillSpans.filter(
            (span) =>
                span.source === 'path' &&
                !!span.path &&
                !attemptedSkillPathRef.current.has(span.path) &&
                !skillMetaMap[span.skillId]?.description
        );

        if (unresolvedPathSpans.length === 0) {
            return;
        }

        const fetchPathDescriptions = async () => {
            const nextMeta: SkillMetaMap = { ...skillMetaMap };
            let changed = false;

            for (const span of unresolvedPathSpans) {
                if (!span.path) continue;
                attemptedSkillPathRef.current.add(span.path);

                try {
                    const response = await fetch(`/api/files/content?path=${encodeURIComponent(span.path)}`);
                    if (!response.ok) continue;

                    const data = await response.json() as { content?: string };
                    if (typeof data.content !== 'string' || !data.content) continue;

                    const parsed = parseSkillFrontmatter(data.content);
                    const previous = nextMeta[span.skillId];
                    const nextEntry = {
                        id: span.skillId,
                        name: parsed.name || previous?.name || span.skillId,
                        description: parsed.description || previous?.description || '',
                    };

                    if (
                        !previous ||
                        previous.name !== nextEntry.name ||
                        previous.description !== nextEntry.description
                    ) {
                        nextMeta[span.skillId] = nextEntry;
                        changed = true;
                    }
                } catch {
                    // Ignore unresolved
                }
            }

            if (!disposed && changed) {
                setSkillMetaMap(nextMeta);
            }
        };

        void fetchPathDescriptions();

        return () => {
            disposed = true;
        };
    }, [skillMetaMap, skillSpans]);

    const parts = content.split(/(<tool-call[^>]*\/>|<thinking>[\s\S]*?<\/thinking>|#\s*Updated\s*Plan[\s\S]*?(?=\n#|\n<|$))/g);
    const lastTodoToolPartIndex = parts.reduce((lastIndex, part, partIndex) => {
        if (!part || !part.startsWith('<tool-call')) return lastIndex;
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch?.[1]?.toLowerCase().includes('todo')) return lastIndex;
        return partIndex;
    }, -1);

    const handleUndoFromTool = onUndoTool
        ? (restoreId: string) => onUndoTool(restoreId, sourceMessageId)
        : undefined;

    const markdownComponents: Components = useMemo(() => ({
        p({ children, ...props }) {
            return <p {...props}>{injectSkillRefs(children, skillMetaMap)}</p>;
        },
        li({ children, ...props }) {
            return <li {...props}>{injectSkillRefs(children, skillMetaMap)}</li>;
        },
        strong({ children, ...props }) {
            return <strong {...props} className="font-bold text-zinc-900 dark:text-white">{children}</strong>;
        },
        h1({ children, ...props }) {
            return <h1 {...props} className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 mt-6">{children}</h1>;
        },
        h2({ children, ...props }) {
            return <h2 {...props} className="text-xl font-bold text-zinc-900 dark:text-white mb-3 mt-5">{children}</h2>;
        },
        h3({ children, ...props }) {
            return <h3 {...props} className="text-lg font-bold text-zinc-900 dark:text-white mb-2 mt-4">{children}</h3>;
        },
        h4({ children, ...props }) {
            return <h4 {...props} className="text-base font-bold text-zinc-900 dark:text-white mb-2 mt-3">{children}</h4>;
        },
        h5({ children, ...props }) {
            return <h5 {...props} className="text-sm font-bold text-zinc-900 dark:text-white mb-1 mt-2">{children}</h5>;
        },
        h6({ children, ...props }) {
            return <h6 {...props} className="text-xs font-bold text-zinc-900 dark:text-white mb-1 mt-2">{children}</h6>;
        },
        a({ children, ...props }) {
            return <a {...props} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{children}</a>;
        },
        blockquote({ children, ...props }) {
            return <blockquote {...props} className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-4 py-1 my-2 text-zinc-600 dark:text-zinc-300 italic">{children}</blockquote>;
        },
        code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const lang = match?.[1];
            const codeStr = String(children).replace(/\n$/, '');
            const inlineSpans = !match ? collectSkillSpans(codeStr, skillMetaMap) : [];

            if (lang === 'diff') {
                return <DiffBlock code={codeStr} />;
            }

            if (match && lang) {
                return (
                    <div className="relative group">
                        <CodeBlock language={lang} code={codeStr} />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CodeCopyButton content={codeStr} />
                        </div>
                    </div>
                );
            }

            if (inlineSpans.length > 0) {
                return <>{renderTextWithSkillRefs(codeStr, skillMetaMap, { variant: 'plain' })}</>;
            }

            return (
                <code {...props} className={cn(className, "text-[13px] font-mono bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/10 px-1.5 py-0.5 rounded-md text-zinc-800 dark:text-zinc-100")}>
                    {children}
                </code>
            )
        }
    }), [skillMetaMap]);

    return (
        <div className="timeline-group">
            {parts.map((part, index) => {
                if (!part || !part.trim()) return null;

                if (part.startsWith('<tool-call')) {
                    const idMatch = part.match(/id="([^"]*)"/);
                    const nameMatch = part.match(/name="([^"]+)"/);
                    const argsMatch = part.match(/args="([^"]+)"/);
                    const checkpointMatch = part.match(/checkpoint="([^"]+)"/);
                    const statusMatch = part.match(/status="([^"]+)"/);
                    const resultMatch = part.match(/result="([^"]+)"/);
                    const resultDataMatch = part.match(/result_data="([^"]+)"/);
                    const safeDecode = (value?: string) => {
                        if (!value) return undefined;
                        try {
                            return decodeURIComponent(value);
                        } catch {
                            return value;
                        }
                    };

                    const toolId = idMatch ? idMatch[1] : undefined;
                    const name = nameMatch ? nameMatch[1] : 'Unknown Tool';
                    const isTodoTool = name.toLowerCase().includes('todo');
                    if (isTodoTool && index !== lastTodoToolPartIndex) {
                        return null;
                    }
                    if (hideTodoToolCalls && isTodoTool) {
                        return null;
                    }
                    const argsStr = safeDecode(argsMatch?.[1]) ?? '{}';
                    const checkpoint = safeDecode(checkpointMatch?.[1]);
                    const status = statusMatch ? statusMatch[1] as 'running' | 'completed' | 'failed' : 'completed';
                    const result = safeDecode(resultMatch?.[1]);
                    const resultDataStr = safeDecode(resultDataMatch?.[1]);
                    let resultData: unknown = undefined;
                    if (resultDataStr) {
                        try {
                            resultData = JSON.parse(resultDataStr);
                        } catch {
                            resultData = resultDataStr;
                        }
                    }

                    let args = {};
                    try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }

                    // Get live output for this tool call
                    const liveOutput = toolId && getOutput ? getOutput(toolId) : undefined;

                    return (
                        <ToolCallCard
                            key={index}
                            toolId={toolId}
                            checkpointId={checkpoint}
                            toolName={name}
                            args={args}
                            status={status}
                            result={result}
                            resultData={resultData}
                            liveOutput={liveOutput}
                            onUndo={handleUndoFromTool}
                            onRetry={onRetry}
                            onCancel={onCancel}
                        />
                    );
                }

                if (part.startsWith('<thinking>')) {
                    return null;
                }

                if (part.trim().startsWith('# Updated Plan')) {
                    return <PlanBlock key={index} content={part} />;
                }

                return (
                    <div key={index} className="timeline-item">
                        <div className="prose dark:prose-invert prose-sm max-w-none break-words prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:bg-muted/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none text-primary">
                            <ReactMarkdown
                                components={markdownComponents}
                            >
                                {part}
                            </ReactMarkdown>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});
