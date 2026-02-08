'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'model';
  content: string;
  error?: boolean;
  stats?: any;
  sessionId?: string;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedStats, setExpandedStats] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        body: JSON.stringify({ prompt: userMessage.content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch response');
      }

      // Handle gemini CLI output structure
      // Expected structure: { response: "...", session_id: "...", stats: {...} }
      // Or fallback to content/data
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

  const toggleStats = (index: number) => {
    setExpandedStats(expandedStats === index ? null : index);
  };


  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <header className="flex items-center p-4 border-b border-gray-800 bg-gray-950">
        <Bot className="w-6 h-6 mr-2 text-blue-400" />
        <h1 className="text-xl font-bold">Gemini CLI GUI</h1>
        <div className="ml-auto text-xs text-gray-500">
          No API Key Required • Auto-Auth
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
            <Bot className="w-16 h-16 mb-4" />
            <p>Start a conversation with Gemini CLI</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            className={cn(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg p-3",
                msg.role === 'user' 
                  ? "bg-blue-600 text-white" 
                  : msg.error 
                    ? "bg-red-900/50 border border-red-800" 
                    : "bg-gray-800 text-gray-100"
              )}
            >
              <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                <span>{msg.role === 'user' ? 'You' : 'Gemini'}</span>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                 {msg.role === 'model' ? (
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                 ) : (
                   <p className="whitespace-pre-wrap">{msg.content}</p>
                 )}
              </div>
              
              {/* Stats / Metadata Section */}
              {msg.role === 'model' && (msg.stats || msg.sessionId) && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  <button 
                    onClick={() => toggleStats(index)}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Info className="w-3 h-3" />
                    <span>Debug Info</span>
                    {expandedStats === index ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  
                  {expandedStats === index && (
                    <div className="mt-2 text-xs font-mono bg-black/20 p-2 rounded overflow-x-auto text-gray-400">
                      {msg.sessionId && (
                        <div className="mb-1">
                          <span className="text-gray-500">Session ID:</span> {msg.sessionId}
                        </div>
                      )}
                      {msg.stats && (
                        <pre>{JSON.stringify(msg.stats, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-gray-400">Gemini is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 border-t border-gray-800 bg-gray-950">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border-gray-700 text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors flex items-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
