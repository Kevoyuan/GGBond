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

    const parts = content.split(/(<tool-call[^>]*\/>|<tool-call[^>]*$|<thinking>[\s\S]*?<\/thinking>|<thinking>[\s\S]*$|#\s*Updated\s*Plan[\s\S]*?(?=\n#|\n<|$))/g);
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
        ul({ children, ...props }) {
            // Check if this is a task list (contains checkbox items)
            const hasCheckboxes = React.Children.toArray(children).some((child) => {
                if (React.isValidElement(child) && (child.props as { className?: string })?.className?.includes('task-list-item')) {
                    return true;
                }
                
                // Safer check for raw checkbox string patterns
                if (React.isValidElement(child)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const liChildren = React.Children.toArray((child.props as any).children);
                    let firstChild = liChildren[0];
                    // Handle wrapped in <p> tag
                    if (React.isValidElement(firstChild) && firstChild.type === 'p') {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        firstChild = React.Children.toArray((firstChild.props as any).children)[0];
                    }
                    if (typeof firstChild === 'string') {
                        return /^\s*\[(\s|x|X|~|\/)\]/.test(firstChild);
                    }
                }
                return false;
            });

            if (hasCheckboxes) {
                return (
                    <ul {...props} className="list-none space-y-2 my-4 pl-0">
                        {children}
                    </ul>
                );
            }

            return <ul {...props} className="list-disc list-inside my-2 space-y-1">{children}</ul>;
        },
        ol({ children, ...props }) {
            // Check if this looks like a plan with numbered steps
            return <ol {...props} className="list-decimal list-inside my-2 space-y-2">{children}</ol>;
        },
        li({ children, ...props }) {
            // Safely convert children to an array to prevent breaking React elements
            const childrenArray = React.Children.toArray(children);
            let firstChild = childrenArray[0];
            
            // Check if wrapped in paragraph (loose lists might wrap in <p>)
            const isParagraphWrap = React.isValidElement(firstChild) && firstChild.type === 'p';
            if (isParagraphWrap) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const pChildren = React.Children.toArray((firstChild.props as any).children);
                if (pChildren.length > 0 && typeof pChildren[0] === 'string') {
                    firstChild = pChildren[0];
                }
            }

            // --- 1. Check if Task List Item ---
            if (typeof firstChild === 'string') {
                const checkboxMatch = firstChild.match(/^\s*\[(\s|x|X|~|\/)\]\s*(.*)$/);
                
                if (checkboxMatch) {
                    const status = checkboxMatch[1].trim() || ' ';
                    const remainingText = checkboxMatch[2];
                    
                    // Strip the "[ ] " from the first node, keeping remaining text and other nodes
                    if (isParagraphWrap) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const pChildren = React.Children.toArray((childrenArray[0] as React.ReactElement).props.children);
                        pChildren[0] = remainingText;
                        childrenArray[0] = React.cloneElement(childrenArray[0] as React.ReactElement, {}, ...pChildren);
                    } else {
                        childrenArray[0] = remainingText;
                    }

                    let statusClass = 'border-zinc-300 dark:border-zinc-600 text-muted-foreground';
                    let icon = null;

                    if (status === 'x' || status === 'X') {
                        statusClass = 'bg-green-500/20 border-green-500 text-green-500';
                        icon = <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
                    } else if (status === '/') {
                        statusClass = 'bg-blue-500/20 border-blue-500 text-blue-500 animate-pulse';
                        icon = <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
                    } else if (status === '~') {
                        statusClass = 'bg-amber-500/20 border-amber-500 text-amber-500';
                        icon = <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>;
                    }

                    return (
                        <li {...props} className="flex items-start gap-3 group">
                            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${statusClass}`}>
                                {icon}
                            </div>
                            <div className={`flex-1 pt-0.5 ${(status === 'x' || status === 'X') ? 'line-through text-muted-foreground' : ''}`}>
                                {childrenArray}
                            </div>
                        </li>
                    );
                }

                // --- 2. Check if Plan Step (Numbered) ---
                const planStepMatch = firstChild.match(/^(\d+)[\.\)]\s+(.*)$/);
                if (planStepMatch) {
                    const number = planStepMatch[1];
                    const remainingText = planStepMatch[2];

                    if (isParagraphWrap) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const pChildren = React.Children.toArray((childrenArray[0] as React.ReactElement).props.children);
                        pChildren[0] = remainingText;
                        childrenArray[0] = React.cloneElement(childrenArray[0] as React.ReactElement, {}, ...pChildren);
                    } else {
                        childrenArray[0] = remainingText;
                    }

                    return (
                        <li {...props} className="flex items-start gap-3 group">
                            <div className="mt-0.5 w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0 text-xs font-bold">
                                {number}
                            </div>
                            <div className="flex-1 pt-0.5">
                                {childrenArray}
                            </div>
                        </li>
                    );
                }
            }

            // Fallback for regular list items
            return <li {...props}>{injectSkillRefs(children, skillMetaMap)}</li>;
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

                    const toolId = safeDecode(idMatch?.[1]);
                    const name = safeDecode(nameMatch?.[1]) || 'Unknown Tool';
                    const isTodoTool = name.toLowerCase().includes('todo');
                    if (isTodoTool && index !== lastTodoToolPartIndex) {
                        return null;
                    }
                    if (hideTodoToolCalls && isTodoTool) {
                        return null;
                    }
                    const argsStr = safeDecode(argsMatch?.[1]) ?? '{}';
                    const checkpoint = safeDecode(checkpointMatch?.[1]);
                    
                    // Determine status: explicitly parsed > 'running' if partial > default 'completed'
                    const isPartial = !part.endsWith('/>');
                    const parsedStatus = statusMatch ? statusMatch[1] as 'running' | 'completed' | 'failed' : undefined;
                    const status = parsedStatus || (isPartial ? 'running' : 'completed');

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
