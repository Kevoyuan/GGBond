'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Code2, ClipboardList, HelpCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeOption {
  value: 'code' | 'plan' | 'ask';
  label: string;
  icon: React.ElementType;
  description: string;
  shortcut?: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'code', label: 'Code', icon: Code2, description: 'GGBond default: read, write, and execute', shortcut: 'Ctrl+1' },
  { value: 'plan', label: 'Plan', icon: ClipboardList, description: 'Review-first planning, no execution', shortcut: 'Ctrl+2' },
  { value: 'ask', label: 'Ask', icon: HelpCircle, description: 'Answer questions only', shortcut: 'Ctrl+3' },
];

interface ModeMenuProps {
  mode: 'code' | 'plan' | 'ask';
  onChange?: (mode: 'code' | 'plan' | 'ask') => void;
}

export const ModeMenu = React.memo(function ModeMenu({ mode, onChange }: ModeMenuProps) {
  const [show, setShow] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show]);

  const currentMode = MODE_OPTIONS.find(m => m.value === mode) || MODE_OPTIONS[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShow(!show)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 cursor-pointer z-20 relative",
          "bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        title={`Mode: ${currentMode.label}`}
      >
        <currentMode.icon className="w-3.5 h-3.5" />
        <span>{currentMode.label}</span>
        <ChevronDown className={cn("w-3 h-3 opacity-50 transition-transform duration-200", show && "rotate-180")} />
      </button>

      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-background/90 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 p-1">
            {MODE_OPTIONS.map(opt => {
              const isActive = opt.value === mode;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange?.(opt.value);
                    setShow(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs flex items-center gap-3 transition-colors relative rounded-lg",
                    isActive
                      ? "bg-accent/80 text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <opt.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-foreground" : "text-muted-foreground/80")} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[10px] opacity-70 whitespace-nowrap overflow-hidden text-ellipsis">{opt.description}</span>
                  </div>
                  {opt.shortcut && (
                    <kbd className={cn(
                      "hidden sm:inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium",
                      isActive ? "bg-background/50 border-border/50 text-foreground/80" : "bg-muted text-muted-foreground"
                    )}>
                      {opt.shortcut}
                    </kbd>
                  )}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});
