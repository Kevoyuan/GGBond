import { Bot, User, Info, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { DiffBlock } from './DiffBlock';
import { CodeBlock } from './CodeBlock';

import { ToolCallBlock } from './ToolCallBlock';
import { ThinkingBlock } from './ThinkingBlock';

export interface Message {
  role: 'user' | 'model';
  content: string;
  error?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats?: Record<string, any>;
  sessionId?: string;
}

import { ChatSettings } from './SettingsDialog';
import { StateSnapshotDisplay } from './StateSnapshotDisplay';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  settings?: ChatSettings;
}

// Custom renderer to handle <tool-call> and <thinking> tags mixed with Markdown
function ContentRenderer({ content }: { content: string }) {
  // Regex to split content by special tags
  // <tool-call ... />
  // <thinking>...</thinking>
  const parts = content.split(/(<tool-call[^>]*\/>|<thinking>[\s\S]*?<\/thinking>)/g);

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, index) => {
        if (!part) return null;

        // Handle Tool Call
        if (part.startsWith('<tool-call')) {
          const nameMatch = part.match(/name="([^"]+)"/);
          const argsMatch = part.match(/args="([^"]+)"/);
          const statusMatch = part.match(/status="([^"]+)"/);
          const resultMatch = part.match(/result="([^"]+)"/);

          const name = nameMatch ? nameMatch[1] : 'Unknown Tool';
          const argsStr = argsMatch ? decodeURIComponent(argsMatch[1]) : '{}';
          const status = statusMatch ? statusMatch[1] as any : 'completed';
          const result = resultMatch ? decodeURIComponent(resultMatch[1]) : undefined;

          let args = {};
          try {
            args = JSON.parse(argsStr);
          } catch (e) {
            args = { raw: argsStr };
          }

          return (
            <ToolCallBlock
              key={index}
              toolName={name}
              args={args}
              status={status}
              result={result}
            />
          );
        }

        // Handle Thinking Block
        if (part.startsWith('<thinking>')) {
          const content = part.replace(/<\/?thinking>/g, '').trim();
          return <ThinkingBlock key={index} content={content} />;
        }

        // Handle Regular Markdown
        return (
          <div key={index} className="prose dark:prose-invert prose-sm max-w-none break-words prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none">
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
                    <code {...props} className={className}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {part}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

export function MessageBubble({ message, settings }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSnapshot = !isUser && message.content.includes('<state_snapshot>');

  return (
    <div className={cn("flex gap-4 w-full animate-fade-in group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[85%] md:max-w-[80%] min-w-0", isUser ? "items-end" : "items-start", isSnapshot && "w-full max-w-3xl")}>
        {isSnapshot ? (
          <StateSnapshotDisplay content={message.content} />
        ) : (
          <div
            className={cn(
              "rounded-xl px-5 py-3.5 shadow-sm text-sm leading-relaxed max-w-full overflow-x-hidden",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border/60"
            )}
          >
            {!isUser ? (
              <ContentRenderer content={message.content} />
            ) : (
              <div className="whitespace-pre-wrap font-medium">{message.content}</div>
            )}
          </div>
        )}

        {!isUser && message.stats && !isSnapshot && (
          <div className="mt-1 ml-1">
            <TokenUsageDisplay
              stats={message.stats}
              hideModelInfo={settings?.ui?.footer?.hideModelInfo}
              hideContextPercentage={settings?.ui?.footer?.hideContextPercentage}
              showMemoryUsage={settings?.ui?.showMemoryUsage}
            />
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
      <div className="bg-card border border-border/60 rounded-xl px-5 py-3.5 flex items-center gap-3 shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">Thinking...</span>
      </div>
    </div>
  );
}
