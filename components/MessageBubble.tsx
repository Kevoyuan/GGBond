import { Bot, User, Info, Loader2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';

export interface Message {
  role: 'user' | 'model';
  content: string;
  error?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats?: Record<string, any>;
  sessionId?: string;
}

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [expandedStats, setExpandedStats] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-4 w-full animate-fade-in group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[85%] md:max-w-[80%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-xl px-5 py-3.5 shadow-sm text-sm leading-relaxed",
            isUser 
              ? "bg-primary text-primary-foreground" 
              : "bg-card border border-border/60"
          )}
        >
          {!isUser ? (
            <div className="prose dark:prose-invert prose-sm max-w-none break-words prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown
                components={{
                  code({className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                      <div className="relative group/code my-4 rounded-lg overflow-hidden border border-border/50">
                        <div className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                          <CopyButton content={String(children)} />
                        </div>
                        {/* @ts-expect-error - react-syntax-highlighter types incompatibility */}
                        <SyntaxHighlighter
                          {...props}
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: 0, padding: '1rem', background: 'var(--color-code-bg, #1e1e1e)' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
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

        {!isUser && (message.stats || message.sessionId) && (
          <div className="mt-2 ml-1 flex items-center gap-2">
            <button 
              onClick={() => setExpandedStats(!expandedStats)}
              className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wider font-medium opacity-60 hover:opacity-100"
            >
              <Info className="w-3 h-3" />
              {expandedStats ? 'Hide Details' : 'Details'}
            </button>
            
            {expandedStats && (
              <div className="absolute mt-6 p-3 bg-popover rounded-md text-xs font-mono shadow-lg border border-border z-10 animate-fade-in min-w-[200px]">
                {message.sessionId && (
                  <div className="mb-2 pb-2 border-b border-border/50">
                    <span className="font-semibold text-muted-foreground">ID:</span> {message.sessionId}
                  </div>
                )}
                {message.stats && <pre>{JSON.stringify(message.stats, null, 2)}</pre>}
              </div>
            )}
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
