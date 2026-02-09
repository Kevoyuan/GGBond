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
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  duration_ms?: number;
  cached?: number;
  cachedContentTokenCount?: number;
  [key: string]: unknown;
}

interface TokenUsageDisplayProps {
  stats: TokenStats;
  compact?: boolean;
  className?: string;
  hideModelInfo?: boolean;
  hideContextPercentage?: boolean;
  showMemoryUsage?: boolean;
}

export function TokenUsageDisplay({ stats, compact = true, className, hideModelInfo = false, hideContextPercentage = false, showMemoryUsage = true }: TokenUsageDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Safely extract values with defaults (handling both camelCase and snake_case)
  const inputTokens = stats.inputTokenCount || stats.input_tokens || 0;
  const outputTokens = stats.outputTokenCount || stats.output_tokens || 0;
  const totalTokens = stats.totalTokenCount || stats.total_tokens || (inputTokens + outputTokens);
  const cost = stats.totalCost !== undefined ? `$${stats.totalCost.toFixed(6)}` : null;
  const durationMs = stats.duration || stats.duration_ms;
  const duration = durationMs ? `${(durationMs / 1000).toFixed(2)}s` : null;
  const cachedTokens = stats.cachedContentTokenCount || stats.cached || 0;
  
  // Model info for context window
  const modelName = stats.model || 'auto-gemini-3';
  const { pricing, name: resolvedModelName } = getModelInfo(modelName);
  const contextLimit = pricing.contextWindow;
  const contextPercent = Math.min((totalTokens / contextLimit) * 100, 100);

  // Calculate percentages for the bar
  const inputPercent = totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0;
  const outputPercent = totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0;

  return (
    <div className={cn("flex flex-col gap-2 font-sans", className)}>
      {/* Compact Header / Toggle */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground/70 hover:text-primary transition-colors group select-none w-fit"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="font-medium">{totalTokens.toLocaleString()} tokens</span>
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-card/50 border border-border/50 rounded-lg shadow-sm backdrop-blur-sm space-y-3 mt-1 min-w-[260px]">
              
              {/* Token Bar Chart */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  <span>Input</span>
                  <span>Output</span>
                </div>
                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-blue-500/70" 
                    style={{ width: `${inputPercent}%` }}
                  />
                  <div 
                    className="h-full bg-green-500/70" 
                    style={{ width: `${outputPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{inputTokens.toLocaleString()}</span>
                  <span>{outputTokens.toLocaleString()}</span>
                </div>
              </div>

              {/* Context Window Usage */}
              {!hideContextPercentage && (
                <div className="space-y-1.5 pt-1 border-t border-border/30">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Context Window
                    </span>
                    {!hideModelInfo && (
                      <span className="text-muted-foreground font-medium">
                        {resolvedModelName.replace('gemini-', '')}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden relative group/ctx">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        contextPercent > 90 ? "bg-red-500/70" : 
                        contextPercent > 70 ? "bg-yellow-500/70" : 
                        "bg-purple-500/70"
                      )}
                      style={{ width: `${Math.max(contextPercent, 1)}%` }} // Ensure at least 1% visible
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{((totalTokens / contextLimit) * 100).toFixed(2)}% used</span>
                    <span>{Math.round(contextLimit / 1024)}k limit</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 pt-0.5 flex items-center gap-1">
                    <Info className="w-2.5 h-2.5" />
                    <a 
                      href="https://ai.google.dev/gemini-api/docs/gemini-3?hl=zh-cn" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-primary underline decoration-dotted transition-colors"
                    >
                      Context Window Info
                    </a>
                  </div>
                </div>
              )}

              {/* Extra Details Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                {showMemoryUsage && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Database className="w-3 h-3" />
                    <span>Cached: {cachedTokens.toLocaleString()}</span>
                  </div>
                )}
                {duration && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Time: {duration}</span>
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
