'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Settings, Plus, Sun, Moon, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  role: 'user' | 'model';
  content: string;
  error?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stats?: Record<string, any>;
  sessionId?: string;
}

interface ChatSettings {
  model: string;
  systemInstruction: string;
}

const AVAILABLE_MODELS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedStats, setExpandedStats] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'gemini-2.5-flash',
    systemInstruction: '',
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMessage.content,
          model: settings.model,
          systemInstruction: settings.systemInstruction
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch response');
      }

      // Handle different response structures
      const content = data.response || data.content || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      const stats = data.stats;
      const sessionId = data.session_id;

      setMessages((prev) => [...prev, { 
        role: 'model', 
        content,
        stats,
        sessionId
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, error: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="font-bold text-xl flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Gemini UI
          </h1>
          <button onClick={toggleTheme} className="p-2 hover:bg-muted rounded-full transition-colors">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={() => setMessages([])}
            className="w-full flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm font-medium text-muted-foreground mb-2">Configuration</div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Model</label>
              <select 
                value={settings.model}
                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">System Instructions</label>
              <textarea 
                value={settings.systemInstruction}
                onChange={(e) => setSettings(prev => ({ ...prev, systemInstruction: e.target.value }))}
                placeholder="You are a helpful assistant..."
                className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border text-xs text-muted-foreground">
          v0.1.0 • gemini-cli
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-border flex items-center justify-between bg-card">
          <h1 className="font-bold text-lg">Gemini UI</h1>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-50">
              <Bot className="w-16 h-16 mb-4" />
              <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
              <p>Configure settings in the sidebar and start chatting.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-4 max-w-4xl mx-auto animate-fade-in",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                )}
                
                <div className={cn(
                  "flex flex-col max-w-[85%] md:max-w-[75%]",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 shadow-sm",
                      msg.role === 'user' 
                        ? "bg-primary text-primary-foreground rounded-br-sm" 
                        : "bg-card border border-border rounded-bl-sm"
                    )}
                  >
                    {msg.role === 'model' ? (
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
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>

                  {msg.role === 'model' && (msg.stats || msg.sessionId) && (
                    <div className="mt-2 ml-1">
                      <button 
                        onClick={() => setExpandedStats(expandedStats === idx ? null : idx)}
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        <Info className="w-3 h-3" />
                        {expandedStats === idx ? 'Hide details' : 'Show details'}
                      </button>
                      
                      {expandedStats === idx && (
                        <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto animate-fade-in border border-border">
                          {msg.sessionId && (
                            <div className="mb-2 pb-2 border-b border-border/50">
                              <span className="font-semibold">Session ID:</span> {msg.sessionId}
                            </div>
                          )}
                          <pre>{JSON.stringify(msg.stats, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {msg.error && (
                    <div className="text-destructive text-sm mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Error processing request
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                    <User className="w-5 h-5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-background/80 backdrop-blur-sm sticky bottom-0">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-card border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all shadow-sm">
              <button 
                type="button" 
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                title="Attach file (coming soon)"
              >
                <Plus className="w-5 h-5" />
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 py-2 text-sm"
                rows={1}
                style={{ minHeight: '40px' }}
              />

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <div className="text-center text-xs text-muted-foreground mt-2">
              Gemini CLI GUI • Powered by Next.js & Tailwind v4
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
