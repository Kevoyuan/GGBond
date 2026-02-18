import { Zap, Clock, Coins, Database, ChevronDown, ChevronUp, Cpu, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getModelInfo } from '@/lib/pricing';

interface TokenStats {
  inputTokenCount?: number;
  outputTokenCount?: number;
  totalTokenCount?: number;
  totalCost?: number;
  duration?: number;
  model?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface TokenUsageDisplayProps {
  stats: TokenStats;
  compact?: boolean;
  className?: string;
  hideModelInfo?: boolean;
  hideContextPercentage?: boolean;
  showMemoryUsage?: boolean;
  floating?: boolean;
}

// Helper to format tokens in k units (e.g., 1500 -> 1.5k)
function formatTokensK(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toString();
}

export function TokenUsageDisplay({ stats, compact = true, className, hideModelInfo = false, hideContextPercentage = false, showMemoryUsage = true, floating = false }: TokenUsageDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Safely extract values with defaults (handling both camelCase and snake_case)
  const inputTokens = stats.inputTokenCount || stats.input_tokens || stats.inputTokens || 0;
  const outputTokens = stats.outputTokenCount || stats.output_tokens || stats.outputTokens || 0;
  const totalTokens = stats.totalTokenCount || stats.total_tokens || stats.totalTokens || (inputTokens + outputTokens);
  const cost = stats.totalCost !== undefined ? `$${stats.totalCost.toFixed(4)}` : null;
  const durationMs = stats.duration || stats.duration_ms;
  const duration = durationMs ? `${(durationMs / 1000).toFixed(2)}s` : null;
  const cachedTokens = stats.cachedContentTokenCount || stats.cached || 0;

  // Model info for context window
  const modelName = stats.model || 'gemini-3-pro-preview';
  const { pricing, name: resolvedModelName } = getModelInfo(modelName);
  const contextLimit = pricing.contextWindow;
  const contextPercent = Math.min((totalTokens / contextLimit) * 100, 100);

  // Calculate percentages for the bar
  const inputPercent = totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0;
  const outputPercent = totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0;

  return (
    <div className={cn("flex flex-col gap-2 font-sans", floating && "relative", className)}>
      {/* Compact Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground/70 hover:text-primary transition-colors group select-none w-fit"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="font-medium">{formatTokensK(totalTokens)} tokens</span>
        </div>

        {cost && (
          <>
            <span className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{cost}</span>
            </div>
          </>
        )}

        {duration && (
          <>
            <span className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{duration}</span>
            </div>
          </>
        )}

        <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -4, scale: 0.98 }}
            animate={{ height: 'auto', opacity: 1, y: 0, scale: 1 }}
            exit={{ height: 0, opacity: 0, y: -4, scale: 0.98 }}
            transition={{
              height: { type: "spring", stiffness: 600, damping: 35, restDelta: 0.01 },
              opacity: { duration: 0.1 },
              y: { type: "spring", stiffness: 600, damping: 35 },
              scale: { type: "spring", stiffness: 600, damping: 35 }
            }}
            className={cn(
              "overflow-hidden",
              floating && "absolute top-full right-0 mt-2 z-50 w-[300px]"
            )}
          >
            <div className={cn(
              "p-4 bg-background/80 dark:bg-zinc-900/60 border border-border/50 rounded-xl shadow-2xl backdrop-blur-xl space-y-4 mt-1 ring-1 ring-black/5 dark:ring-white/15",
              !floating && "min-w-[280px] bg-background/40 shadow-sm ring-0"
            )}>

              {/* Token Bar Chart */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] uppercase tracking-widest font-bold text-muted-foreground/80 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    Input
                  </span>
                  <span className="flex items-center gap-1.5">
                    Output
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden flex ring-1 ring-black/5 dark:ring-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${inputPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${outputPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  />
                </div>
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1">
                    {formatTokensK(inputTokens)}
                    <span className="text-[10px] text-muted-foreground font-normal">tokens</span>
                  </span>
                  <span className="flex items-center gap-1">
                    {formatTokensK(outputTokens)}
                    <span className="text-[10px] text-muted-foreground font-normal">tokens</span>
                  </span>
                </div>
              </div>

              {/* Context Window Usage */}
              {!hideContextPercentage && (
                <div className="space-y-2 pt-2 border-t border-border/20">
                  <div className="flex justify-between items-center text-[10px] sm:text-xs">
                    <span className="uppercase tracking-widest font-bold text-muted-foreground/80 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" /> Context Window
                    </span>
                    {!hideModelInfo && (
                      <span className="text-secondary-foreground font-bold bg-secondary/50 px-2 py-0.5 rounded-md border border-border/30">
                        {resolvedModelName.replace('gemini-', '')}
                      </span>
                    )}
                  </div>
                  <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden relative group/ctx ring-1 ring-black/5 dark:ring-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(contextPercent, 1)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full transition-colors duration-300",
                        contextPercent > 90
                          ? "bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                          : contextPercent > 70
                            ? "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                            : "bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500"
                      )}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-foreground font-semibold">
                    <span>{((totalTokens / contextLimit) * 100).toFixed(2)}% <span className="text-[10px] text-muted-foreground font-normal">capacity</span></span>
                    <span className="text-muted-foreground/70">{Math.round(contextLimit / 1024)}k <span className="text-[10px] font-normal">limit</span></span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 pt-0.5 flex items-center justify-center gap-1.5">
                    <Info className="w-3 h-3 text-primary/70" />
                    <a
                      href="https://ai.google.dev/gemini-api/docs/gemini-3?hl=zh-cn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary underline decoration-dotted underline-offset-2 transition-colors font-medium"
                    >
                      Context Documentation
                    </a>
                  </div>
                </div>
              )}

              {/* Extra Details Grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/20">
                {showMemoryUsage && (
                  <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30 border border-border/10">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80">
                      <Database className="w-3 h-3" /> Cached
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {formatTokensK(cachedTokens)}
                    </div>
                  </div>
                )}
                {duration && (
                  <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30 border border-border/10">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80">
                      <Clock className="w-3 h-3" /> Runtime
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {duration}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
