'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Loader2, Code, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

// Fix for SyntaxHighlighter types if needed, or ignore
const CodeHighlighter = SyntaxHighlighter as any;

interface Message {
  role: 'user' | 'model';
  content: string;
  stats?: any;
  error?: boolean;
}

export function ChatInterface({ 
  sessionId,
  onNewSession
}: { 
  sessionId?: string;
  onNewSession: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      fetchMessages(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMessage,
          sessionId 
        }),
      });

      const data = await res.json();
      
      if (!sessionId && data.sessionId) {
        onNewSession(data.sessionId);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch response');
      }

      const content = data.response || data.content || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        content,
        stats: data.stats 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        error: true 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="flex flex-col gap-4 max-w-3xl mx-auto pb-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-20">
              <h1 className="text-2xl font-bold mb-2">GeminiPilot</h1>
              <p>Start a conversation to begin coding.</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow",
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {msg.role === 'user' ? <Terminal className="h-4 w-4" /> : <Code className="h-4 w-4" />}
              </div>
              <div className={cn(
                "flex flex-col gap-2 max-w-[80%]",
                msg.role === 'user' ? "items-end" : "items-start"
              )}>
                <Card className={cn(
                  "p-3",
                  msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted/50"
                )}>
                  {msg.role === 'model' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                      <ReactMarkdown
                        components={{
                          code({node, inline, className, children, ...props}: any) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                              <CodeHighlighter
                                {...props}
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                              >
                                {String(children).replace(/\n$/, '')}
                              </CodeHighlighter>
                            ) : (
                              <code {...props} className={className}>
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </Card>
                {msg.stats && (
                  <div className="text-xs text-muted-foreground">
                    {msg.stats.models?.['gemini-2.5-flash-lite']?.tokens?.total} tokens
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-background">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
