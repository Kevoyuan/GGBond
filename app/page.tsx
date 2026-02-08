'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Menu, Paperclip, Mic } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MessageBubble, LoadingBubble, Message } from '../components/MessageBubble';
import { cn } from '@/lib/utils';

import { ChatInput } from '../components/ChatInput';

interface ChatSettings {
  model: string;
  systemInstruction: string;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'auto-gemini-3',
    systemInstruction: '',
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Map UI model aliases to actual CLI model IDs
    let actualModel = settings.model;
    if (settings.model === 'auto-gemini-3') {
      actualModel = 'gemini-3-flash-preview'; // Default for Auto (Gemini 3)
    } else if (settings.model === 'auto-gemini-2.5') {
      actualModel = 'gemini-2.5-flash'; // Default for Auto (Gemini 2.5)
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMessage.content,
          model: actualModel,
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "flex h-full"
      )}>
        <Sidebar 
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          isDark={theme === 'dark'}
          toggleTheme={toggleTheme}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <Header 
          currentModel={settings.model}
          onModelChange={(model) => setSettings(s => ({ ...s, model }))}
        />

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth relative" ref={scrollContainerRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', opacity: 1 }}>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center mb-6 border border-primary/10">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold mb-2 tracking-tight">How can I help you today?</h1>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                I'm ready to assist with your coding tasks, planning, or general questions.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full pb-8 pt-6 px-4 flex flex-col gap-6">
              {messages.map((msg, idx) => (
                <MessageBubble 
                  key={idx} 
                  message={msg} 
                  isLast={idx === messages.length - 1} 
                />
              ))}
              {isLoading && <LoadingBubble />}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <ChatInput onSend={(text) => {
          setInput(text);
          // Small timeout to allow state update before sending
          setTimeout(handleSendMessage, 0);
        }} isLoading={isLoading} />
      </div>
    </div>
  );
}
