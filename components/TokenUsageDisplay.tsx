import { Zap, Clock, Coins, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenStats {
  inputTokenCount?: number;
  outputTokenCount?: number;
  totalTokenCount?: number;
  totalCost?: number;
  duration?: number;
  model?: string;
  [key: string]: any;
}

interface TokenUsageDisplayProps {
  stats: TokenStats;
  compact?: boolean;
  className?: string;
}

export function TokenUsageDisplay({ stats, compact = true, className }: TokenUsageDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Safely extract values with defaults
  const inputTokens = stats.inputTokenCount || 0;
  const outputTokens = stats.outputTokenCount || 0;
  const totalTokens = stats.totalTokenCount || (inputTokens + outputTokens);
  const cost = stats.totalCost !== undefined ? `$${stats.totalCost.toFixed(6)}` : null;
  const duration = stats.duration ? `${(stats.duration / 1000).toFixed(2)}s` : null;
  
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
                <div className="flex justify-between text-[10px] font-mono text-foreground/80">
                  <span>{inputTokens.toLocaleString()}</span>
                  <span>{outputTokens.toLocaleString()}</span>
                </div>
              </div>

              {/* Grid Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                {stats.model && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Model</span>
                    <span className="text-xs font-medium truncate" title={stats.model}>{stats.model}</span>
                  </div>
                )}
                <div className="flex flex-col">
                   <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Cache</span>
                   <span className="text-xs font-medium">
                     {stats.cachedContentTokenCount ? stats.cachedContentTokenCount.toLocaleString() : '0'}
                   </span>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
