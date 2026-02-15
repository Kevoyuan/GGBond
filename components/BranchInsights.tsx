'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, GitBranch, Layers, Leaf, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchInsightsProps {
  nodeCount: number;
  leafCount: number;
  maxDepth: number;
  branchPointCount: number;
  onBranchPointClick?: (id: string) => void;
  branchPoints?: Array<{ id: string; content: string; role?: 'user' | 'model' }>;
  className?: string;
}

export function BranchInsights({
  nodeCount,
  leafCount,
  maxDepth,
  branchPointCount,
  onBranchPointClick,
  branchPoints = [],
  className
}: BranchInsightsProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (nodeCount === 0) return null;

  return (
    <div className={cn("absolute top-4 right-4 z-20", className)}>
      <motion.div
        initial={false}
        animate={{
          width: isMinimized ? 40 : 256,
          // Removed height animation to prevent 'auto' measurement bounce
          // borderRadius remains for the circle-to-square transition
          borderRadius: isMinimized ? 20 : 16
        }}
        transition={{
          duration: 0.15,
          ease: "easeInOut"
        }}
        className={cn(
          "flex flex-col items-end overflow-hidden origin-top-right",
          "bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-white/20"
        )}
      >
        {/* Toggle Button Anchor - Fixed 40x40 */}
        <div className="flex items-center w-full h-[40px] relative shrink-0">
          <AnimatePresence>
            {!isMinimized && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex-1 text-[11px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-[0.2em] pl-4 pt-0.5 pointer-events-none"
              >
                Insights
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className={cn(
              "absolute top-0 right-0 w-10 h-10 flex items-center justify-center focus:outline-none rounded-full transition-colors",
              isMinimized
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10"
            )}
          >
            {isMinimized ? (
              <GitBranch className="w-5 h-5 shrink-0" />
            ) : (
              <ChevronUp className="w-5 h-5 shrink-0" />
            )}
          </button>
        </div>

        {/* Content Expansion Area */}
        <AnimatePresence initial={false}>
          {!isMinimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.1, ease: "easeInOut" } }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="w-64 px-4 pb-5 space-y-4 overflow-hidden"
            >
              {/* Stats - Maximum Contrast */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <StatItem label="Nodes" value={nodeCount} icon={Layers} color="text-blue-600 dark:text-blue-400" />
                <StatItem label="Leaves" value={leafCount} icon={Leaf} color="text-emerald-600 dark:text-emerald-400" />
                <StatItem label="Depth" value={maxDepth} icon={Maximize2} color="text-amber-600 dark:text-amber-400" />
              </div>

              {/* Branch List - Maximum Contrast */}
              {branchPoints.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <div className="text-[10px] uppercase font-black text-zinc-900 dark:text-zinc-100 tracking-widest px-1">
                    Branches
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-none">
                    {branchPoints.slice(0, 12).map((bp) => {
                      const isUser = bp.role === 'user';
                      return (
                        <button
                          key={bp.id}
                          onClick={() => onBranchPointClick?.(bp.id)}
                          className={cn(
                            "w-full text-left pl-3 pr-2 py-2 rounded-r-lg rounded-bl-lg transition-colors border-l-2 text-[11px] hover:bg-zinc-100 dark:hover:bg-white/5",
                            isUser 
                              ? "border-emerald-500/70 hover:border-emerald-500 text-zinc-700 dark:text-zinc-300"
                              : "border-blue-500/70 hover:border-blue-500 text-zinc-600 dark:text-zinc-400"
                          )}
                        >
                          <div className={cn("font-medium line-clamp-2 leading-relaxed", isUser ? "text-zinc-900 dark:text-zinc-100" : "")}>
                            {bp.content || 'Untitled'}
                          </div>
                          <div className="text-[9px] font-mono opacity-40 mt-1">#{bp.id.slice(-4)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StatItem({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("mb-0.5", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{value}</span>
      <span className="text-[9px] font-black text-zinc-900/40 dark:text-zinc-100/30 uppercase tracking-tighter">{label}</span>
    </div>
  );
}
