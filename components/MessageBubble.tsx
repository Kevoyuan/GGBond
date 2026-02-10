import { Bot, User, Info, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { DiffBlock } from './DiffBlock';
import { CodeBlock } from './CodeBlock';

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
              <div className="prose dark:prose-invert prose-sm max-w-none break-words prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '')
                      const lang = match?.[1];
                      const codeStr = String(children).replace(/\n$/, '');

                      // Special handling for diff blocks
                      if (lang === 'diff') {
                        return <DiffBlock code={codeStr} />;
                      }

                      // Enhanced code block with line numbers & collapsing
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
                  {message.content}
                </ReactMarkdown>
              </div>
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
