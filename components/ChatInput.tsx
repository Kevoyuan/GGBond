import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, AtSign, Slash, Command, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

interface CommandItem {
  command: string;
  description: string;
  icon: React.ElementType;
}

const BASE_COMMANDS: CommandItem[] = [
  { command: '/skills', description: 'Manage agent skills', icon: Command },
  { command: '/clear', description: 'Clear conversation history', icon: Slash },
];

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>(BASE_COMMANDS);
  const [installedSkills, setInstalledSkills] = useState<CommandItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Fetch installed skills
    const fetchSkills = async () => {
      try {
        const res = await fetch('/api/skills');
        if (res.ok) {
          const skills = await res.json();
          const skillCommands = skills.map((skill: any) => ({
            command: `/skill ${skill.name}`,
            description: skill.description || `Use ${skill.name} skill`,
            icon: Sparkles
          }));
          setInstalledSkills(skillCommands);
        }
      } catch (error) {
        console.error('Failed to fetch skills for autocomplete', error);
      }
    };
    fetchSkills();
  }, []);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Show commands when input starts with /
    if (value.startsWith('/')) {
        const trimmed = value.trim();
        // If exact match or starts with /skill, show skills
        if (trimmed === '/skill' || trimmed.startsWith('/skill ')) {
             // Filter installed skills based on search
             const search = trimmed.replace(/^\/skill\s*/, '').toLowerCase();
             const matchedSkills = installedSkills.filter(s => 
                 s.command.toLowerCase().includes(search) || 
                 s.description.toLowerCase().includes(search)
             );
             
             if (matchedSkills.length > 0) {
                 setFilteredCommands(matchedSkills);
                 setShowCommands(true);
                 setSelectedIndex(0);
                 return;
             }
        }
        
        // Default behavior: show base commands + filter
        if (!value.includes(' ')) {
            const search = value.toLowerCase();
            const matches = BASE_COMMANDS.filter(c => c.command.toLowerCase().startsWith(search));
            // Add a generic "/skill" hint if not present and input matches partial
            if (matches.length > 0) {
                setFilteredCommands(matches);
                setShowCommands(true);
                setSelectedIndex(0);
            } else {
                setShowCommands(false);
            }
        } else {
            setShowCommands(false);
        }
    } else {
      setShowCommands(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        // If it's a skill command, we might want to just set it and let user type more or send
        setInput(cmd.command + (cmd.command.startsWith('/skill ') ? '' : ' '));
        setShowCommands(false);
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCommandSelect = (cmd: string) => {
    setInput(cmd + (cmd.startsWith('/skill ') ? '' : ' '));
    setShowCommands(false);
    textareaRef.current?.focus();
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
    <div className="p-4 bg-background border-t relative">
      <div className="max-w-3xl mx-auto relative">
        {/* Command Suggestions */}
        {showCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
                Commands
              </div>
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.command}
                  onClick={() => handleCommandSelect(cmd.command)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                    index === selectedIndex 
                      ? "bg-accent text-accent-foreground" 
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
                    <cmd.icon className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium">{cmd.command}</span>
                    <span className="text-[10px] opacity-70 truncate">{cmd.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn(
          "relative flex flex-col gap-2 p-2 rounded-xl border bg-muted/20 transition-all duration-200",
          "focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
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
