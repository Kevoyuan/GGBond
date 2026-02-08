'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Bot, Menu } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { MessageBubble, LoadingBubble, Message } from '../components/MessageBubble';
import { cn } from '@/lib/utils';

interface ChatSettings {
  model: string;
  systemInstruction: string;
}

interface Session {
  id: string;
  title: string;
  updated_at: number;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'gemini-2.5-flash',
    systemInstruction: '',
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load Theme
  useEffect(() => {
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

  // Fetch Sessions on Mount
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Handle Session Selection
  const handleSelectSession = async (id: string) => {
    if (id === currentSessionId) return;
    
    setIsLoading(true);
    setCurrentSessionId(id);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        // Also update settings if stored in session (future feature)
      }
    } catch (error) {
      console.error('Failed to load session', error);
    } finally {
      setIsLoading(false);
      // Close sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session', error);
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
          systemInstruction: settings.systemInstruction,
          sessionId: currentSessionId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch response');
      }

      // Handle response
      const content = data.response || data.content || (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      const stats = data.stats;
      const responseSessionId = data.session_id;

      const modelMessage: Message = { 
        role: 'model', 
        content,
        stats,
        sessionId: responseSessionId
      };

      setMessages((prev) => [...prev, modelMessage]);

      // If it was a new session, update state and refresh list
      if (!currentSessionId && responseSessionId) {
        setCurrentSessionId(responseSessionId);
        fetchSessions(); // Refresh list to show new title
      } else {
        // Just refresh list to update timestamp
        fetchSessions();
      }

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
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed md:relative z-50 h-full transition-transform duration-300 ease-in-out transform",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <Sidebar 
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          theme={theme}
          toggleTheme={toggleTheme}
          settings={settings}
          setSettings={setSettings}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-muted rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="font-semibold truncate">
              {currentSessionId 
                ? sessions.find(s => s.id === currentSessionId)?.title || 'Chat'
                : 'New Chat'}
            </h2>
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            {settings.model}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-50 p-8">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Bot className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">How can I help you today?</h2>
              <p className="max-w-md">
                I'm ready to assist with your coding tasks. Configure the model in the sidebar and start chatting.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <MessageBubble 
                  key={idx} 
                  message={msg} 
                  isLast={idx === messages.length - 1} 
                />
              ))}
              {isLoading && <LoadingBubble />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-background/80 backdrop-blur-sm sticky bottom-0 z-20">
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
                className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 py-2 text-sm placeholder:text-muted-foreground/50"
                rows={1}
                style={{ minHeight: '44px' }}
              />

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <div className="text-center text-[10px] text-muted-foreground mt-2 opacity-70">
              Gemini CLI GUI • Powered by Next.js & Tailwind v4 • {settings.model}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
