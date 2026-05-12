'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode2,
  LayoutList,
  Code2,
  TerminalSquare,
  FolderTree,
  GitBranch,
  Clock,
  LayoutGrid,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkbenchPanelType } from './SidePanel';

interface PanelTab {
  type: NonNullable<WorkbenchPanelType>;
  label: string;
  icon: React.ElementType;
  enabled: boolean;
  badge?: number;
  lowPriority?: boolean;
}

interface PanelSwitcherProps {
  currentPanel: NonNullable<WorkbenchPanelType>;
  tabs: PanelTab[];
  onSelect: (type: NonNullable<WorkbenchPanelType>) => void;
}

export const PanelSwitcher = React.memo(function PanelSwitcher({
  currentPanel,
  tabs,
  onSelect,
}: PanelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Use capture phase + passive for early bailout without blocking scroll
    document.addEventListener('mousedown', handleClick, { capture: true, passive: true });
    return () => document.removeEventListener('mousedown', handleClick, { capture: true });
  }, [open]);

  const active = tabs.find((t) => t.type === currentPanel && t.enabled);
  const ActiveIcon = active?.icon || FileCode2;

  return (
    <div className="relative min-w-0 flex-1" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        title="Switch panel"
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium transition-colors",
          "text-foreground hover:bg-muted/80 active:scale-[0.98]",
          "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 focus:outline-none"
        )}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{active?.label || 'Panel'}</span>
        <ChevronDown className={cn(
          "h-3 w-3 shrink-0 opacity-40 transition-transform",
          open && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.6 }}
            className={cn(
              "absolute left-0 top-full mt-1 w-44 rounded-lg border border-border/50 bg-background/95 backdrop-blur-xl",
              "shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] z-50 overflow-hidden p-1"
            )}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = tab.type === currentPanel;
              return (
                <button
                  key={tab.type}
                  disabled={!tab.enabled}
                  title={!tab.enabled ? `Open an artifact first` : tab.label}
                  onClick={() => {
                    onSelect(tab.type);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors",
                    selected
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    !tab.enabled && "cursor-not-allowed opacity-40",
                    tab.lowPriority && !selected && "opacity-50"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-5 h-5 rounded shrink-0",
                    selected ? "bg-background border shadow-sm" : "bg-transparent"
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <span className="truncate">{tab.label}</span>
                    {Boolean(tab.badge) && (
                      <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0 leading-none">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
