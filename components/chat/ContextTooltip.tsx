'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextTooltipProps {
  usedTokens: number;
  contextLimit: number;
  contextPercent: number;
  currentModel: string;
  compressionThreshold: number;
  circumference: number;
  strokeDashoffset: number;
  radius: number;
}

export const ContextTooltip = React.memo(function ContextTooltip({
  usedTokens,
  contextLimit,
  contextPercent,
  currentModel,
  compressionThreshold,
  circumference,
  strokeDashoffset,
  radius,
}: ContextTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative flex items-center gap-1.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        className="flex items-center justify-center gap-1 px-1.5 h-[28px] w-[64px] text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-transparent transition-colors hidden sm:flex group"
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="8" cy="8" r={radius}
              stroke="currentColor" strokeWidth="2" fill="transparent"
              className="text-muted/20"
            />
            <circle
              cx="8" cy="8" r={radius}
              stroke="currentColor" strokeWidth="2" fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={cn(
                "transition-colors duration-300",
                contextPercent > 90 ? "text-red-500" :
                  contextPercent > 75 ? "text-yellow-500" : "text-primary"
              )}
            />
          </svg>
        </div>
        <span>{contextPercent.toFixed(0)}%</span>
      </button>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-full mb-3 left-0 w-[280px] p-4 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-border/50 shadow-2xl backdrop-blur-xl z-50 ring-1 ring-black/5 dark:ring-white/10"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-md",
                    contextPercent > 90 ? "bg-red-500/10 text-red-500" :
                      contextPercent > 75 ? "bg-amber-500/10 text-amber-500" :
                        "bg-primary/10 text-primary"
                  )}>
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold tracking-wide">CONTEXT WINDOW</span>
                    <span className="text-[10px] text-muted-foreground">{currentModel}</span>
                  </div>
                </div>
                <div className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full border",
                  contextPercent > 90 ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    contextPercent > 75 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                )}>
                  {contextPercent.toFixed(1)}%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Used</span>
                  <span className="text-sm font-bold font-mono text-foreground flex items-center gap-1">
                    {usedTokens.toLocaleString()}
                    <span className="text-[10px] font-normal text-muted-foreground">tok</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Remaining</span>
                  <span className="text-sm font-bold font-mono text-foreground flex items-center gap-1">
                    {(contextLimit - usedTokens).toLocaleString()}
                    <span className="text-[10px] font-normal text-muted-foreground">tok</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-medium text-muted-foreground px-0.5">
                  <span>Capacity Usage</span>
                  <span>{(contextLimit / 1000).toFixed(0)}k Limit</span>
                </div>
                <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/5 relative">
                  <div className="absolute inset-0 flex justify-between px-[25%] opacity-20 z-0">
                    <div className="w-px h-full bg-foreground/50" />
                    <div className="w-px h-full bg-foreground/50" />
                    <div className="w-px h-full bg-foreground/50" />
                  </div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(contextPercent, 2)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full relative z-10 shadow-sm",
                      contextPercent > 90
                        ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        : contextPercent > 75
                          ? "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                          : "bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                    )}
                  />
                </div>
              </div>

              <div className="text-[9px] text-center text-muted-foreground/50">
                Auto-compression at {Math.round(compressionThreshold * 100)}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
