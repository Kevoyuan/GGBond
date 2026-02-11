import { Bot, User, Info, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
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

/**
 * ContentRenderer: Splits AI content into timeline items.
 * Each segment (text paragraph or tool-call) becomes a `.timeline-item` sibling
 * inside a `.timeline-group` container so CSS handles dots & connector lines.
 */
function ContentRenderer({ content, onRetry, onCancel }: { content: string, onRetry?: (mode: 'once' | 'session') => void, onCancel?: () => void }) {
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

          const name = nameMatch ? nameMatch[1] : 'Unknown Tool';
          const argsStr = argsMatch ? decodeURIComponent(argsMatch[1]) : '{}';
          const status = statusMatch ? statusMatch[1] as 'running' | 'completed' | 'failed' : 'completed';
          const result = resultMatch ? decodeURIComponent(resultMatch[1]) : undefined;

          let args = {};
          try { args = JSON.parse(argsStr); } catch { args = { raw: argsStr }; }

          return (
            <ToolCallCard
              key={index}
              toolName={name}
              args={args}
              status={status}
              result={result}
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
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const lang = match?.[1];
                    const codeStr = String(children).replace(/\n$/, '');

                    if (lang === 'diff') {
                      return <DiffBlock code={codeStr} />;
                    }

                    if (match && lang) {
                      return <CodeBlock language={lang} code={codeStr} />;
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
