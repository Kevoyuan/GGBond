import { Bot, User, Info, Loader2 } from 'lucide-react';
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

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const [expandedStats, setExpandedStats] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-4 max-w-4xl mx-auto animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[85%] md:max-w-[75%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-sm",
            isUser 
              ? "bg-primary text-primary-foreground rounded-br-sm" 
              : "bg-card border border-border rounded-bl-sm"
          )}
        >
          {!isUser ? (
            <div className="prose dark:prose-invert prose-sm max-w-none break-words">
              <ReactMarkdown
                components={{
                  code({className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                      // @ts-expect-error - react-syntax-highlighter types incompatibility
                      <SyntaxHighlighter
                        {...props}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
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
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {!isUser && (message.stats || message.sessionId) && (
          <div className="mt-2 ml-1">
            <button 
              onClick={() => setExpandedStats(!expandedStats)}
              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Info className="w-3 h-3" />
              {expandedStats ? 'Hide details' : 'Show details'}
            </button>
            
            {expandedStats && (
              <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto animate-fade-in border border-border">
                {message.sessionId && (
                  <div className="mb-2 pb-2 border-b border-border/50">
                    <span className="font-semibold">Session ID:</span> {message.sessionId}
                  </div>
                )}
                {message.stats && <pre>{JSON.stringify(message.stats, null, 2)}</pre>}
              </div>
            )}
          </div>
        )}
        
        {message.error && (
          <div className="text-destructive text-sm mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Error processing request
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
          <User className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}

export function LoadingBubble() {
  return (
    <div className="flex gap-4 max-w-4xl mx-auto animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
        <Bot className="w-5 h-5 text-primary" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Thinking...</span>
      </div>
    </div>
  );
}
