'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MessageBubble, LoadingBubble, Message } from '../components/MessageBubble';
import { SkillsDialog } from '../components/SkillsDialog';
import { SettingsDialog, ChatSettings } from '../components/SettingsDialog';
import { cn } from '@/lib/utils';

import { ChatInput } from '../components/ChatInput';
import { UsageStatsDialog } from '../components/UsageStatsDialog';

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  workspace?: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'auto-gemini-3',
    systemInstruction: '',
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showUsageStats, setShowUsageStats] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sessionStats = useMemo(() => {
    return messages.reduce((acc, msg) => {
      if (msg.stats) {
        acc.inputTokens += msg.stats.inputTokenCount || msg.stats.input_tokens || 0;
        acc.outputTokens += msg.stats.outputTokenCount || msg.stats.output_tokens || 0;
        acc.totalTokens += msg.stats.totalTokenCount || msg.stats.total_tokens || ((msg.stats.inputTokenCount || msg.stats.input_tokens || 0) + (msg.stats.outputTokenCount || msg.stats.output_tokens || 0));
        acc.totalCost += msg.stats.totalCost || 0;
      }
      return acc;
    }, { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 });
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load Settings
  useEffect(() => {
    const saved = localStorage.getItem('gem-ui-settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) { console.error('Failed to parse settings', e); }
    }
  }, []);

  const handleSaveSettings = (newSettings: ChatSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gem-ui-settings', JSON.stringify(newSettings));
  };

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
    
    // Find session to set workspace
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentWorkspace(session.workspace || null);
    }

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
    setCurrentWorkspace(null); // Reset workspace or keep it? Let's reset for now.
    setMessages([]);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChatInWorkspace = (workspace: string) => {
    setCurrentSessionId(null);
    setCurrentWorkspace(workspace);
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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Handle slash commands
    const trimmedInput = text.trim();
    if (trimmedInput.startsWith('/clear')) {
      handleNewChat();
      return;
    }

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Map UI model aliases to actual CLI model IDs
    let actualModel = settings.model;
    if (settings.model === 'auto-gemini-3') {
      actualModel = 'gemini-3-pro-preview';
    } else if (settings.model === 'auto-gemini-2.5') {
      actualModel = 'gemini-2.5-pro';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMessage.content,
          model: actualModel,
          systemInstruction: settings.systemInstruction,
          sessionId: currentSessionId,
          workspace: currentWorkspace // Pass current workspace
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch response');
      }
      
      if (!response.body) {
         throw new Error('No response body');
      }

      // Initialize assistant message
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let streamSessionId = currentSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            if (data.type === 'init' && data.session_id) {
               if (!streamSessionId) {
                 streamSessionId = data.session_id;
                 setCurrentSessionId(data.session_id);
                 fetchSessions();
               }
            }

            if (data.type === 'message' && data.role === 'assistant' && data.content) {
               assistantContent += data.content;
               setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg.role === 'model') {
                     lastMsg.content = assistantContent;
                     if (streamSessionId) lastMsg.sessionId = streamSessionId;
                  }
                  return newMessages;
               });
            }

            if (data.type === 'result' && data.stats) {
               setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg.role === 'model') {
                     lastMsg.stats = data.stats;
                  }
                  return newMessages;
               });
            }
          } catch (e) {
             console.error('JSON parse error', e);
          }
        }
      }

      // Final refresh
      fetchSessions();

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
          onNewChatInWorkspace={handleNewChatInWorkspace}
          onOpenSkills={() => setSkillsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          isDark={theme === 'dark'}
          toggleTheme={toggleTheme}
          onShowStats={() => setShowUsageStats(true)}
        />
      </div>

      <SkillsDialog 
        open={skillsOpen} 
        onClose={() => setSkillsOpen(false)} 
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <UsageStatsDialog 
        open={showUsageStats} 
        onClose={() => setShowUsageStats(false)} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <Header stats={sessionStats} onShowStats={() => setShowUsageStats(true)} />

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth relative" ref={scrollContainerRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', opacity: 1 }}>
              <div className="text-center space-y-4 max-w-lg mx-auto">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-xl ring-1 ring-white/20">
                  <Bot className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  I can help you write code, debug issues, or answer questions about your project.
                </p>
              </div>
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
              {isLoading && messages[messages.length - 1]?.role !== 'model' && <LoadingBubble />}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <ChatInput 
          onSend={handleSendMessage} 
          isLoading={isLoading} 
          currentModel={settings.model}
          onModelChange={(model) => setSettings(s => ({ ...s, model }))}
        />
      </div>
    </div>
  );
}
