import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, AtSign, Slash, Sparkles, ChevronDown, Zap, Code2, RefreshCw, MessageSquare, History, RotateCcw, Copy, Hammer, Server, Puzzle, Brain, FileText, Folder, Settings, Cpu, Palette, ArchiveRestore, Shrink, ClipboardList, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModelInfo } from '@/lib/pricing';
import { AnimatePresence, motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  currentModel: string;
  onModelChange: (model: string) => void;
  sessionStats?: {
    totalTokens: number;
    [key: string]: any;
  };
  currentContextUsage?: number;
  mode?: string;
  onModeChange?: (mode: string) => void;
  onApprovalModeChange?: (mode: 'safe' | 'auto') => void;
}

interface CommandItem {
  command: string;
  description: string;
  icon: React.ElementType;
  group?: string;
}

const BASE_COMMANDS: CommandItem[] = [
  // Chat Management
  { command: '/chat', description: 'Manage chat sessions (save, list, resume)', icon: MessageSquare, group: 'Built-in' },
  { command: '/clear', description: 'Clear conversation history', icon: Slash, group: 'Built-in' },
  { command: '/resume', description: 'Resume previous session', icon: History, group: 'Built-in' },
  { command: '/rewind', description: 'Rewind conversation', icon: RotateCcw, group: 'Built-in' },
  { command: '/restore', description: 'Restore state', icon: ArchiveRestore, group: 'Built-in' },
  { command: '/compress', description: 'Compress context', icon: Shrink, group: 'Built-in' },
  { command: '/copy', description: 'Copy last response', icon: Copy, group: 'Built-in' },

  // Tools & MCP
  { command: '/tools', description: 'Manage tools', icon: Hammer, group: 'Built-in' },
  { command: '/mcp', description: 'Manage MCP servers', icon: Server, group: 'Built-in' },

  // Skills & Extensions
  { command: '/skills', description: 'Manage skills', icon: Sparkles, group: 'Built-in' },
  { command: '/extensions', description: 'Manage extensions', icon: Puzzle, group: 'Built-in' },

  // Context & Memory
  { command: '/memory', description: 'Manage memory/context', icon: Brain, group: 'Built-in' },
  { command: '/init', description: 'Initialize GEMINI.md', icon: FileText, group: 'Built-in' },
  { command: '/directory', description: 'Manage working directories', icon: Folder, group: 'Built-in' },

  // Settings
  { command: '/settings', description: 'Open settings', icon: Settings, group: 'Built-in' },
  { command: '/model', description: 'Select model', icon: Cpu, group: 'Built-in' },
  { command: '/theme', description: 'Change theme', icon: Palette, group: 'Built-in' },
];

interface ModeOption {
  value: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'code', label: 'Code', icon: Code2, description: '读写文件 & 执行命令' },
  { value: 'plan', label: 'Plan', icon: ClipboardList, description: '分析规划，不执行' },
  { value: 'ask', label: 'Ask', icon: HelpCircle, description: '仅回答问题' },
];

const MODELS = [
  { id: 'auto-gemini-3', name: 'Gemini 3 Auto', icon: Zap },
  { id: 'auto-gemini-2.5', name: 'Gemini 2.5 Auto', icon: Zap },
  { id: 'gemini-3-pro-preview', name: '3 Pro Preview', icon: Code2 },
  { id: 'gemini-3-flash-preview', name: '3 Flash Preview', icon: Zap },
  { id: 'gemini-2.5-pro', name: '2.5 Pro', icon: Code2 },
  { id: 'gemini-2.5-flash', name: '2.5 Flash', icon: Zap },
  { id: 'gemini-2.5-flash-lite', name: '2.5 Flash Lite', icon: Zap },
];

export function ChatInput({ onSend, isLoading, currentModel, onModelChange, sessionStats, currentContextUsage, mode = 'code', onModeChange, onApprovalModeChange }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>(BASE_COMMANDS);
  const [installedSkills, setInstalledSkills] = useState<CommandItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandListRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showContextTooltip, setShowContextTooltip] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const currentMode = MODE_OPTIONS.find(m => m.value === mode) || MODE_OPTIONS[0];

  // Calculate context usage
  const { pricing } = getModelInfo(currentModel);
  const contextLimit = pricing.contextWindow;
  // Use currentContextUsage if available, otherwise fallback to sessionStats.totalTokens (legacy) or 0
  const usedTokens = currentContextUsage !== undefined ? currentContextUsage : (sessionStats?.totalTokens || 0);
  const contextPercent = Math.min((usedTokens / contextLimit) * 100, 100);

  // Ring calculations
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (contextPercent / 100) * circumference;

  const handleCompress = async () => {
    setIsCompressing(true);
    try {
      // Use the native /compress command from gemini-cli
      onSend("/compress");
      setShowContextTooltip(false);
    } catch (error) {
      console.error('Compression failed:', error);
    } finally {
      setIsCompressing(false);
    }
  };

  // Helper to get current command bounds
  const getCommandBounds = (text: string, index: number) => {
    const textBefore = text.slice(0, index);
    const lastSlash = textBefore.lastIndexOf('/');

    if (lastSlash === -1) return null;

    // Check if it's a valid command start (beginning of line or preceded by whitespace)
    if (lastSlash > 0 && /\S/.test(text[lastSlash - 1])) {
      return null;
    }

    return { start: lastSlash, query: textBefore.slice(lastSlash) };
  };

  useEffect(() => {
    // Scroll selected item into view
    if (showCommands && commandListRef.current) {
      const selectedElement = commandListRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showCommands]);

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
            icon: Sparkles,
            group: 'Skills'
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

  const updateSuggestions = (value: string, cursorIndex: number) => {
    const bounds = getCommandBounds(value, cursorIndex);

    if (bounds) {
      const search = bounds.query.toLowerCase();

      // Combine base commands and skills
      const allCommands = [...BASE_COMMANDS, ...installedSkills];

      const matches = allCommands.filter(c =>
        c.command.toLowerCase().startsWith(search) ||
        (search.length > 1 && c.description.toLowerCase().includes(search.replace(/^\//, '')))
      );

      // Sort: Built-in first, then Skills
      matches.sort((a, b) => {
        if (a.group === b.group) return 0;
        return a.group === 'Built-in' ? -1 : 1;
      });

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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const newCursorPos = e.target.selectionStart;
    setInput(value);
    setCursorPosition(newCursorPos);
    updateSuggestions(value, newCursorPos);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setCursorPosition(target.selectionStart);
    updateSuggestions(target.value, target.selectionStart);
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
        handleCommandSelect(cmd.command);
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
      return;
    }
  };

  const handleCommandSelect = (cmd: string) => {
    const bounds = getCommandBounds(input, cursorPosition);
    if (!bounds) return;

    const { start } = bounds;

    const textBefore = input.slice(0, start);
    const textAfter = input.slice(cursorPosition);

    // Find end of current word (if any, e.g. replacing a partial command)
    let end = 0;
    while (end < textAfter.length && /\S/.test(textAfter[end])) {
      end++;
    }
    const suffix = textAfter.slice(end);

    const newValue = textBefore + cmd + ' ' + suffix;
    setInput(newValue);

    const newCursorPos = start + cmd.length + 1;

    setShowCommands(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    onSend(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const getModelName = (id: string) => {
    const m = MODELS.find(m => m.id === id);
    return m ? m.name : id;
  };

  const [approvalMode, setApprovalMode] = useState<'safe' | 'auto'>('safe');

  // Propagate approval mode up
  useEffect(() => {
    // We need to pass this up to the parent, but the current interface doesn't support it yet.
    // For now, let's attach it to the onSend payload or use a separate prop if we refactor page.tsx first.
    // Actually, let's expose it via a new prop `onApprovalModeChange` in the interface, 
    // but since I can't change the interface and the usage simultaneously in one atomic step easily without breaking types if I'm not careful.
    // Let's assume the parent will be updated to pass `onApprovalModeChange`.
    // Wait, I can't assume that. I should update the interface first? 
    // No, I can update ChatInput first, but I need to be careful about the prop.
    // Let's do it in `page.tsx` first? No, `ChatInput` is the child.
    // I will add the prop to the interface and use it if it exists.
    if (onApprovalModeChange) {
      onApprovalModeChange(approvalMode);
    }
  }, [approvalMode]);


  return (
    <div className="p-4 bg-background border-t relative">
      <div className="max-w-3xl mx-auto relative">
        {/* Command Suggestions */}
        {showCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
            <div className="max-h-64 overflow-y-auto p-1" ref={commandListRef}>
              {filteredCommands.map((cmd, index) => {
                const showHeader = index === 0 || cmd.group !== filteredCommands[index - 1].group;
                return (
                  <React.Fragment key={cmd.command}>
                    {showHeader && (
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-y first:border-t-0 border-border sticky top-0 z-10 backdrop-blur-sm">
                        {cmd.group || 'Commands'}
                      </div>
                    )}
                    <button
                      data-index={index}
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
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className={cn(
          "relative flex flex-col gap-2 p-2 rounded-xl border bg-secondary transition-all duration-200",
          "focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Type / for commands)"
            className="w-full bg-transparent border-none focus:outline-none resize-none min-h-[40px] max-h-[200px] text-sm leading-relaxed px-2 py-1"
            rows={1}
          />

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 relative">
              {/* Model Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors mr-1"
                  title="Select Model"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{getModelName(currentModel)}</span>
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>

                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-background border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 py-1">
                      {MODELS.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            onModelChange(model.id);
                            setShowModelMenu(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
                            currentModel === model.id
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <model.icon className="w-3.5 h-3.5" />
                          <span>{model.name}</span>
                          {currentModel === model.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Mode Selector */}
              <div className="relative" ref={modeMenuRef}>
                <button
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  title={`Mode: ${currentMode.label}`}
                >
                  <currentMode.icon className="w-3.5 h-3.5" />
                  <span>{currentMode.label}</span>
                  <ChevronDown className={cn("w-3 h-3 opacity-50 transition-transform duration-200", showModeMenu && "rotate-180")} />
                </button>

                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-background border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 py-1">
                      {MODE_OPTIONS.map(opt => {
                        const isActive = opt.value === mode;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              onModeChange?.(opt.value);
                              setShowModeMenu(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                          >
                            <opt.icon className="w-4 h-4 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-[10px] opacity-70">{opt.description}</span>
                            </div>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Approval Mode Toggle */}
              <button
                onClick={() => {
                  const nextMode = approvalMode === 'safe' ? 'auto' : 'safe';
                  setApprovalMode(nextMode);
                  if (onApprovalModeChange) onApprovalModeChange(nextMode);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all duration-300",
                  approvalMode === 'auto'
                    ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 ring-1 ring-red-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={approvalMode === 'auto' ? "Auto-Approve: ON (Dangerous)" : "Safe Mode: Ask for approval"}
              >
                {approvalMode === 'auto' ? (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current animate-pulse" />
                    <span>Auto</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  </>
                ) : (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border border-current opacity-70" />
                    <span>Safe</span>
                  </>
                )}
              </button>

              <div className="w-px h-4 bg-border mx-1" />


              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Add Image">
                <ImageIcon className="w-4 h-4" />
              </button>

              <div
                className="relative flex items-center gap-1.5"
                onMouseEnter={() => setShowContextTooltip(true)}
                onMouseLeave={() => setShowContextTooltip(false)}
              >
                <button
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors hidden sm:flex group"
                >
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="8"
                        cy="8"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="transparent"
                        className="text-muted/20"
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-500",
                          contextPercent > 90 ? "text-red-500" :
                            contextPercent > 75 ? "text-yellow-500" :
                              "text-primary"
                        )}
                      />
                    </svg>
                  </div>
                  <span>{contextPercent.toFixed(0)}%</span>
                </button>

                <AnimatePresence>
                  {showContextTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl z-50 text-white"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-400">Context Usage</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-semibold tracking-tight">
                              {contextPercent.toFixed(0)}%
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              of {(contextLimit / 1000).toFixed(0)}K
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                            {usedTokens.toLocaleString()} tokens used
                          </div>
                        </div>

                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              contextPercent > 90 ? "bg-red-500" :
                                contextPercent > 75 ? "bg-yellow-500" :
                                  "bg-blue-500"
                            )}
                            style={{ width: `${contextPercent}%` }}
                          />
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompress();
                          }}
                          disabled={isCompressing}
                          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-xs font-medium text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", isCompressing && "animate-spin")} />
                          {isCompressing ? "Compressing..." : "Compress Context"}
                        </button>
                      </div>

                      {/* Arrow */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1e1e1e] border-b border-r border-white/10 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
