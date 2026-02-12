import { Bot, User, Info, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import React, { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { DiffBlock } from './DiffBlock';
import { CodeBlock } from './CodeBlock';
import { ToolCallCard } from './ToolCallCard';
import { PlanBlock } from './PlanBlock';

export interface Message {
  id?: string;
  role: 'user' | 'model';
  content: string;
  error?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats?: Record<string, any>;
  sessionId?: string;
  parentId?: string | null;
  thought?: string;
  citations?: string[];
}

import { ThinkingBlock } from './ThinkingBlock';

import { ChatSettings } from './SettingsDialog';
import { StateSnapshotDisplay } from './StateSnapshotDisplay';

interface MessageBubbleProps {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
  settings?: ChatSettings;
  onRetry?: (mode: 'once' | 'session') => void;
  onCancel?: () => void;
}

type SkillMeta = {
  id: string;
  name: string;
  description: string;
};

type SkillMetaMap = Record<string, SkillMeta>;

type SkillSpan = {
  start: number;
  end: number;
  skillId: string;
  source: 'path' | 'token';
  path?: string;
};

let skillMetaCache: SkillMetaMap | null = null;
let skillMetaPromise: Promise<SkillMetaMap> | null = null;

function toTitleCaseSkill(skillId: string): string {
  return skillId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function loadSkillMetaMap(): Promise<SkillMetaMap> {
  if (skillMetaCache) return skillMetaCache;
  if (skillMetaPromise) return skillMetaPromise;

  skillMetaPromise = fetch('/api/skills')
    .then(async (res) => {
      if (!res.ok) return {} as SkillMetaMap;
      const skills = await res.json() as Array<{ id: string; name?: string; description?: string }>;
      const map: SkillMetaMap = {};
      for (const skill of skills) {
        const id = String(skill.id || '').trim();
        if (!id) continue;
        map[id] = {
          id,
          name: String(skill.name || id),
          description: String(skill.description || '').trim(),
        };
      }
      skillMetaCache = map;
      return map;
    })
    .catch(() => ({} as SkillMetaMap))
    .finally(() => {
      skillMetaPromise = null;
    });

  return skillMetaPromise;
}

function collectSkillSpans(text: string, skillMetaMap?: SkillMetaMap): SkillSpan[] {
  const spans: SkillSpan[] = [];
  const pathRe = /(?:~?\/[^\s`'"]*\/([A-Za-z0-9._-]+)\/SKILL\.md)/g;
  const dollarRe = /\$([A-Za-z0-9._-]+)/g;
  const skillsCmdRe = /\/skills\s+([A-Za-z0-9._-]+)/gi;
  const useSkillRe = /\buse skill\s+([A-Za-z0-9._-]+)\b/gi;
  const activateSkillRe = /\bactivate_skill\s+([A-Za-z0-9._-]+)\b/gi;

  let match: RegExpExecArray | null;

  while ((match = pathRe.exec(text)) !== null) {
    const full = match[0];
    const skillId = match[1];
    spans.push({
      start: match.index,
      end: match.index + full.length,
      skillId,
      source: 'path',
      path: full,
    });
  }

  while ((match = dollarRe.exec(text)) !== null) {
    const full = match[0];
    const skillId = match[1];
    spans.push({
      start: match.index,
      end: match.index + full.length,
      skillId,
      source: 'token',
    });
  }

  while ((match = skillsCmdRe.exec(text)) !== null) {
    const full = match[0];
    const skillId = match[1];
    const localIndex = full.lastIndexOf(skillId);
    const start = match.index + (localIndex >= 0 ? localIndex : 0);
    spans.push({
      start,
      end: start + skillId.length,
      skillId,
      source: 'token',
    });
  }

  while ((match = useSkillRe.exec(text)) !== null) {
    const full = match[0];
    const skillId = match[1];
    const localIndex = full.lastIndexOf(skillId);
    const start = match.index + (localIndex >= 0 ? localIndex : 0);
    spans.push({
      start,
      end: start + skillId.length,
      skillId,
      source: 'token',
    });
  }

  while ((match = activateSkillRe.exec(text)) !== null) {
    const full = match[0];
    const skillId = match[1];
    const localIndex = full.lastIndexOf(skillId);
    const start = match.index + (localIndex >= 0 ? localIndex : 0);
    spans.push({
      start,
      end: start + skillId.length,
      skillId,
      source: 'token',
    });
  }

  if (skillMetaMap && Object.keys(skillMetaMap).length > 0) {
    const knownSkillIds = new Set(Object.keys(skillMetaMap));
    const tokenRe = /\b([A-Za-z0-9._-]+)\b/g;
    while ((match = tokenRe.exec(text)) !== null) {
      const skillId = match[1];
      if (!knownSkillIds.has(skillId)) continue;
      if (!skillId.includes('-') && !skillId.includes('_') && !skillId.includes('.')) continue;
      spans.push({
        start: match.index,
        end: match.index + skillId.length,
        skillId,
        source: 'token',
      });
    }
  }

  // Fallback: when metadata is unavailable, still treat obvious skill-like ids as chips.
  if (!skillMetaMap || Object.keys(skillMetaMap).length === 0) {
    const fallbackSkillTokenRe = /\b([A-Za-z0-9]+(?:[-_][A-Za-z0-9._-]+)+)\b/g;
    while ((match = fallbackSkillTokenRe.exec(text)) !== null) {
      const skillId = match[1];
      if (!/skill/i.test(skillId)) continue;
      spans.push({
        start: match.index,
        end: match.index + skillId.length,
        skillId,
        source: 'token',
      });
    }
  }

  if (spans.length === 0) return spans;

  spans.sort((a, b) => a.start - b.start);
  const nonOverlapping: SkillSpan[] = [];
  for (const span of spans) {
    const prev = nonOverlapping[nonOverlapping.length - 1];
    if (!prev || span.start >= prev.end) {
      nonOverlapping.push(span);
    }
  }
  return nonOverlapping;
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!frontmatterMatch) return {};

  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/name:\s*(.+)/);
  const descriptionMatch = frontmatter.match(/description:\s*(.+)/);

  return {
    name: nameMatch?.[1]?.trim(),
    description: descriptionMatch?.[1]?.trim(),
  };
}

function SkillBadge({
  skillId,
  source,
  meta,
}: {
  skillId: string;
  source: 'path' | 'token';
  meta?: SkillMeta;
}) {
  const label = source === 'path'
    ? 'SKILL.md'
    : (meta?.name || toTitleCaseSkill(skillId));
  const description = meta?.description || `Skill: ${skillId}`;

  return (
    <span className="group/skillref relative inline-flex align-baseline">
      <span className="inline-flex items-center rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-200 dark:text-violet-300">
        {label}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-border/60 bg-card px-2.5 py-2 text-[11px] leading-snug text-card-foreground opacity-0 shadow-xl transition-opacity duration-150 group-hover/skillref:opacity-100">
        {description}
      </span>
    </span>
  );
}

function renderTextWithSkillRefs(text: string, skillMetaMap: SkillMetaMap): ReactNode {
  const spans = collectSkillSpans(text, skillMetaMap);
  if (spans.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, index) => {
    if (span.start > cursor) {
      nodes.push(text.slice(cursor, span.start));
    }
    nodes.push(
      <SkillBadge
        key={`skill-ref-${span.skillId}-${span.start}-${index}`}
        skillId={span.skillId}
        source={span.source}
        meta={skillMetaMap[span.skillId]}
      />
    );
    cursor = span.end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function injectSkillRefs(children: ReactNode, skillMetaMap: SkillMetaMap): ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      return renderTextWithSkillRefs(child, skillMetaMap);
    }

    if (React.isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
      const element = child as ReactElement<{ children?: ReactNode }>;
      return React.cloneElement(element, {
        children: injectSkillRefs(element.props.children, skillMetaMap),
      });
    }

    return child;
  });
}

/**
 * ContentRenderer: Splits AI content into timeline items.
 * Each segment (text paragraph or tool-call) becomes a `.timeline-item` sibling
 * inside a `.timeline-group` container so CSS handles dots & connector lines.
 */
function ContentRenderer({ content, onRetry, onCancel }: { content: string, onRetry?: (mode: 'once' | 'session') => void, onCancel?: () => void }) {
  const skillSpans = useMemo(() => collectSkillSpans(content), [content]);
  const [skillMetaMap, setSkillMetaMap] = useState<SkillMetaMap>(skillMetaCache || {});
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
          const nextEntry: SkillMeta = {
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
          // Ignore unresolved path metadata; badge falls back to id-based tooltip.
        }
      }

      if (!disposed && changed) {
        skillMetaCache = { ...(skillMetaCache || {}), ...nextMeta };
        setSkillMetaMap(nextMeta);
      }
    };

    void fetchPathDescriptions();

    return () => {
      disposed = true;
    };
  }, [skillMetaMap, skillSpans]);

  // Split content by <tool-call .../> tags AND <thinking> blocks AND "Updated Plan" sections
  // Regex:
  // 1. <tool-call ... />
  // 2. <thinking> ... </thinking>
  // 3. # Updated Plan ... (until next # or end)
  const parts = content.split(/(<tool-call[^>]*\/>|<thinking>[\s\S]*?<\/thinking>|#\s*Updated\s*Plan[\s\S]*?(?=\n#|\n<|$))/g);

  return (
    <div className="timeline-group">
      {parts.map((part, index) => {
        if (!part || !part.trim()) return null;

        // ── Tool Call ──
        if (part.startsWith('<tool-call')) {
          const nameMatch = part.match(/name="([^"]+)"/);
          const argsMatch = part.match(/args="([^"]+)"/);
          const statusMatch = part.match(/status="([^"]+)"/);
          const resultMatch = part.match(/result="([^"]+)"/);
          const resultDataMatch = part.match(/result_data="([^"]+)"/);

          const name = nameMatch ? nameMatch[1] : 'Unknown Tool';
          const argsStr = argsMatch ? decodeURIComponent(argsMatch[1]) : '{}';
          const status = statusMatch ? statusMatch[1] as 'running' | 'completed' | 'failed' : 'completed';
          const result = resultMatch ? decodeURIComponent(resultMatch[1]) : undefined;
          const resultDataStr = resultDataMatch ? decodeURIComponent(resultDataMatch[1]) : undefined;
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

          return (
            <ToolCallCard
              key={index}
              toolName={name}
              args={args}
              status={status}
              result={result}
              resultData={resultData}
              onRetry={onRetry}
              onCancel={onCancel}
            />
          );
        }

        // ── Skip <thinking> blocks entirely ──
        if (part.startsWith('<thinking>')) {
          return null;
        }

        // ── Plan Block ──
        if (part.trim().startsWith('# Updated Plan')) {
          // Remove the header line for cleaner rendering? Or keep it?
          // PlanBlock handles the header visual, so we pass the content.
          // But PlanBlock expects valid markdown list items.
          // Let's pass the whole part and let PlanBlock parse it.
          return <PlanBlock key={index} content={part} />;
        }

        // ── Markdown text segment ──
        return (
          <div key={index} className="timeline-item">
            <div className="prose dark:prose-invert prose-sm max-w-none break-words prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:bg-muted/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none opacity-90">
              <ReactMarkdown
                components={{
                  p({ children, ...props }) {
                    return <p {...props}>{injectSkillRefs(children, skillMetaMap)}</p>;
                  },
                  li({ children, ...props }) {
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
                      return <CodeBlock language={lang} code={codeStr} />;
                    }

                    if (inlineSpans.length > 0) {
                      return <>{renderTextWithSkillRefs(codeStr, skillMetaMap)}</>;
                    }

                    return (
                      <code {...props} className={cn(className, "text-xs font-mono")}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {part}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CitationsDisplay({ citations }: { citations: string[] }) {
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
          let icon = <Info className="w-3 h-3" />;

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
}

export function MessageBubble({ message, isFirst, isLast, settings, onRetry, onCancel }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSnapshot = !isUser && message.content.includes('<state_snapshot>');

  return (
    <div className={cn("flex gap-4 w-full animate-fade-in group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col min-w-0", isUser ? "items-end max-w-[85%] md:max-w-[80%]" : "items-start w-full", isSnapshot && "w-full max-w-3xl")}>
        {isSnapshot ? (
          <StateSnapshotDisplay content={message.content} />
        ) : (
          <div
            className={cn(
              "text-sm leading-relaxed max-w-full overflow-x-hidden",
              isUser
                ? "bg-primary text-primary-foreground rounded-xl px-5 py-3.5 shadow-sm font-medium"
                : "w-full"
            )}
          >
            {!isUser ? (
              <div className="flex flex-col gap-2">
                {message.thought && <ThinkingBlock content={message.thought} />}
                <ContentRenderer
                  content={message.content}
                  onRetry={onRetry}
                  onCancel={onCancel}
                />
                {message.citations && message.citations.length > 0 && (
                  <CitationsDisplay citations={message.citations} />
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>
        )}

        {!isUser && message.stats && !isSnapshot && (
          <div className="mt-1 pl-[30px]">
            {/* Stats ... */}
            <TokenUsageDisplay
              stats={message.stats}
              hideModelInfo={settings?.ui?.footer?.hideModelInfo}
              hideContextPercentage={settings?.ui?.footer?.hideContextPercentage}
              showMemoryUsage={settings?.ui?.showMemoryUsage}
            />
          </div>
        )}

        {/* Action Bar */}
        {!isUser && !isSnapshot && !message.error && (
          <div className="flex items-center gap-2 mt-1 pl-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => onRetry?.('once')}
              className="p-1.5 h-7 text-xs flex items-center gap-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Regenerate response (New Branch)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
          </div>
        )}

        {message.error && (
          <div className="text-destructive text-sm mt-2 flex items-center gap-1.5 bg-destructive/10 px-3 py-2 rounded-md">
            <Info className="w-4 h-4" />
            <span>Error processing request</span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5 border border-border">
          <User className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 bg-muted/80 backdrop-blur-sm hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-all"
      title="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function LoadingBubble() {
  return (
    <div className="flex gap-4 w-full animate-fade-in">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
        <Bot className="w-5 h-5 text-primary" />
      </div>
      <div className="w-full">
        <div className="timeline-group">
          <div className="timeline-item timeline-item-loading">
            <span className="text-sm text-muted-foreground italic font-medium">Processing...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
