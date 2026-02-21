
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Command,
  Search,
  MessageSquare,
  Plus,
  Trash2,
  Settings,
  Terminal,
  Code2,
  ClipboardList,
  HelpCircle,
  Zap,
  Shield,
  Cpu,
  Eraser,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
  group?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: {
    onNewChat: () => void;
    onClearChat: () => void;
    onOpenSettings: () => void;
    onToggleTerminal: () => void;
    onSetMode: (mode: 'code' | 'plan' | 'ask') => void;
    onToggleApproval: () => void;
    onShowStats: () => void;
  };
  currentMode: 'code' | 'plan' | 'ask';
  currentApproval: 'safe' | 'auto';
}

export function CommandPalette({
  isOpen,
  onClose,
  actions,
  currentMode,
  currentApproval,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allCommands: CommandItem[] = useMemo(() => [
    {
      id: 'new-chat',
      name: 'New Chat',
      description: 'Start a fresh conversation',
      icon: Plus,
      action: actions.onNewChat,
      shortcut: 'Cmd+N',
      group: 'Conversation',
    },
    {
      id: 'clear-chat',
      name: 'Clear Conversation',
      description: 'Clear all messages in this session',
      icon: Eraser,
      action: actions.onClearChat,
      group: 'Conversation',
    },
    {
      id: 'mode-code',
      name: 'Code Mode',
      description: 'Full capabilities (Read/Write/Execute)',
      icon: Code2,
      action: () => actions.onSetMode('code'),
      shortcut: 'Ctrl+1',
      group: 'Mode',
    },
    {
      id: 'mode-plan',
      name: 'Plan Mode',
      description: 'Analyze and plan only',
      icon: ClipboardList,
      action: () => actions.onSetMode('plan'),
      shortcut: 'Ctrl+2',
      group: 'Mode',
    },
    {
      id: 'mode-ask',
      name: 'Ask Mode',
      description: 'Answer questions only',
      icon: HelpCircle,
      action: () => actions.onSetMode('ask'),
      shortcut: 'Ctrl+3',
      group: 'Mode',
    },
    {
      id: 'toggle-yolo',
      name: currentApproval === 'auto' ? 'Switch to Safe Mode' : 'Switch to YOLO Mode',
      description: 'Toggle tool permission strategy',
      icon: currentApproval === 'auto' ? Shield : Zap,
      action: actions.onToggleApproval,
      group: 'Security',
    },
    {
      id: 'toggle-terminal',
      name: 'Toggle Terminal',
      description: 'Show or hide the integrated terminal',
      icon: Terminal,
      action: actions.onToggleTerminal,
      shortcut: 'Cmd+J',
      group: 'View',
    },
    {
      id: 'show-stats',
      name: 'Usage Stats',
      description: 'View token usage and cost analysis',
      icon: Cpu,
      action: actions.onShowStats,
      group: 'System',
    },
    {
      id: 'settings',
      name: 'Settings',
      description: 'Configure GGBond preferences',
      icon: Settings,
      action: actions.onOpenSettings,
      shortcut: 'Cmd+,',
      group: 'System',
    },
  ], [actions, currentApproval, currentMode]);

  const filteredCommands = useMemo(() => {
    if (!query) return allCommands;
    const s = query.toLowerCase();
    return allCommands.filter(
      (c) => c.name.toLowerCase().includes(s) || c.description.toLowerCase().includes(s)
    );
  }, [query, allCommands]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          cmd.action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-background border border-border/50 shadow-2xl rounded-2xl overflow-hidden"
          >
            <div className="flex items-center px-4 py-3 border-b border-border/50">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent border-none focus:outline-none px-3 text-base"
              />
              <div className="flex items-center gap-1.5 ml-2">
                <kbd className="h-5 px-1.5 rounded border border-border bg-muted text-[10px] font-medium text-muted-foreground flex items-center">ESC</kbd>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Command className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No results found for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCommands.map((cmd, index) => {
                    const isSelected = index === selectedIndex;
                    const showGroup = index === 0 || cmd.group !== filteredCommands[index - 1].group;

                    return (
                      <React.Fragment key={cmd.id}>
                        {showGroup && (
                          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            {cmd.group}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            cmd.action();
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left",
                            isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.01]" : "hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg border",
                            isSelected ? "bg-white/20 border-white/20" : "bg-muted border-border/50"
                          )}>
                            <cmd.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{cmd.name}</div>
                            <div className={cn("text-xs truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                              {cmd.description}
                            </div>
                          </div>
                          {cmd.shortcut && (
                            <kbd className={cn(
                              "hidden sm:flex h-5 px-1.5 rounded items-center font-mono text-[10px] font-medium",
                              isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground border border-border"
                            )}>
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-muted/30 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><kbd className="border px-1 rounded">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1"><kbd className="border px-1 rounded">ENTER</kbd> Run</span>
              </div>
              <div>
                GGBond Command Palette
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
