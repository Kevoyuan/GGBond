'use client';

import React from 'react';
import { Code2, ClipboardList, HelpCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ModeIndicatorProps {
  mode: 'code' | 'plan' | 'ask';
  onModeChange?: (mode: 'code' | 'plan' | 'ask') => void;
  compact?: boolean;
}

interface ModeOption {
  value: 'code' | 'plan' | 'ask';
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

const MODE_CONFIG: Record<'code' | 'plan' | 'ask', ModeOption> = {
  code: {
    value: 'code',
    label: 'Code',
    icon: Code2,
    description: 'Read/Write files & Execute commands',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
  },
  plan: {
    value: 'plan',
    label: 'Plan',
    icon: ClipboardList,
    description: 'Analyze & Plan, no execution',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  ask: {
    value: 'ask',
    label: 'Ask',
    icon: HelpCircle,
    description: 'Answer questions only',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
  },
};

export const PlanModeIndicator = React.memo(function PlanModeIndicator({
  mode,
  onModeChange,
  compact = false,
}: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  if (compact) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        key={mode}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-colors",
          config.bgColor,
          config.color
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-300",
          config.bgColor,
          config.color
        )}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
        <span className="tracking-wide">{config.label}</span>
        {mode === 'plan' && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[10px] opacity-70 ml-1 hidden sm:inline"
          >
            No execution
          </motion.span>
        )}
      </motion.div>
    </AnimatePresence>
  );
});

// Export mode config for use in other components
export { MODE_CONFIG };
