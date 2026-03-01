'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { CheckCircle2, XCircle, Clock, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

interface ToolStatsData {
  toolName: string;
  success: number;
  failed: number;
  total: number;
  successRate: number;
  avgDurationMs: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

export function ToolStatsPanel() {
  const [stats, setStats] = useState<ToolStatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/analytics/tool-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data.tools || []);
      })
      .catch(err => {
        console.error('Failed to load tool stats:', err);
        setError('Failed to load data');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-zinc-400" />
        </div>
      </ModuleCard>
    );
  }

  if (error) {
    return (
      <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
        <div className="flex h-48 flex-col items-center justify-center text-zinc-500">
          <AlertTriangle size={20} className="mb-2 text-red-400" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </ModuleCard>
    );
  }

  if (stats.length === 0) {
    return (
      <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp}>
        <div className="flex h-48 items-center justify-center text-sm font-medium text-zinc-500">
          No tool execution data yet
        </div>
      </ModuleCard>
    );
  }

  const totalExecutions = stats.reduce((sum, t) => sum + t.total, 0);
  const totalSuccesses = stats.reduce((sum, t) => sum + t.success, 0);
  const overallSuccessRate = totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0;

  return (
    <ModuleCard title="Tool Success Rates" description="Track tool execution reliability" icon={TrendingUp} className="h-[30rem]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex h-full flex-col gap-2.5"
      >
        {/* Overall stats - Liquid Glass Banner */}
        <motion.div variants={itemVariants} className="flex shrink-0 items-center justify-between rounded-lg border border-zinc-200/60 bg-zinc-50/50 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={14} strokeWidth={2.5} />
            </div>
            <span className="text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">Overall Success Rate</span>
          </div>
          <span className={`font-mono text-lg font-bold tracking-tight ${overallSuccessRate >= 90 ? 'text-emerald-500' : overallSuccessRate >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
            {overallSuccessRate.toFixed(1)}%
          </span>
        </motion.div>

        {/* Tool list */}
        <div className="flex flex-1 min-h-[0px] flex-col gap-1.5 overflow-y-auto pr-1">
          {stats.map((tool) => (
            <motion.div
              key={tool.toolName}
              variants={itemVariants}
              className="group flex flex-col gap-1.5 shrink-0 rounded-lg border border-zinc-200/40 bg-white/50 px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:bg-zinc-50 hover:shadow-md dark:border-zinc-800/40 dark:bg-zinc-900/20 dark:hover:bg-zinc-800/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex-1 truncate font-mono text-xs font-medium text-zinc-700 transition-colors group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100" title={tool.toolName}>
                  {tool.toolName}
                </span>
                <span className={`font-mono text-xs font-semibold tracking-tight ${tool.successRate >= 90 ? 'text-emerald-500' : tool.successRate >= 70 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                  {tool.successRate.toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={10} className="text-emerald-500/70" />
                  <span>{tool.success}</span>
                </div>
                {tool.failed > 0 && (
                  <div className="flex items-center gap-1.5">
                    <XCircle size={10} className="text-red-500/70" />
                    <span className="text-red-500/90">{tool.failed}</span>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-1 opacity-80">
                  <Clock size={10} />
                  <span>{Math.round(tool.avgDurationMs)}ms</span>
                </div>
              </div>

              {/* Liquid Glass Progress bar */}
              <div className="relative mt-0.5 flex h-1.5 w-full items-center rounded-full bg-zinc-200/50 p-[1px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.06)] dark:bg-zinc-800/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="flex h-full w-full overflow-hidden rounded-full gap-[0.5px]">
                  <motion.div
                    initial={{ flexBasis: '0%' }}
                    animate={{ flexBasis: `${tool.successRate}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
                    style={{ willChange: 'flex-basis' }}
                    className="h-full shrink-0 bg-emerald-500"
                  />
                  {tool.failed > 0 && (
                    <motion.div
                      initial={{ flexBasis: '0%' }}
                      animate={{ flexBasis: `${100 - tool.successRate}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
                      style={{ willChange: 'flex-basis' }}
                      className="h-full shrink-0 bg-red-500"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </ModuleCard>
  );
}
