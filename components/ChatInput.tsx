import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Image as ImageIcon, AtSign, Globe, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="p-4 bg-background border-t">
      <div className="max-w-3xl mx-auto">
        <div className={cn(
          "relative flex flex-col gap-2 p-2 rounded-xl border bg-muted/20 transition-all duration-200",
          "focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (@ to mention)"
            className="w-full bg-transparent border-none focus:outline-none resize-none min-h-[40px] max-h-[200px] text-sm leading-relaxed px-2 py-1"
            rows={1}
          />
          
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Add Image">
                <ImageIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                <AtSign className="w-3.5 h-3.5" />
                <span>Context</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
               <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                 Cmd+Enter
               </span>
               <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-200 flex items-center justify-center",
                  input.trim() && !isLoading 
                    ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm" 
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
