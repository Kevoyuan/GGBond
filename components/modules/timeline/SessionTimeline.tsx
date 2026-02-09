import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { GitCommit, GitBranch, GitPullRequest, Clock, RotateCcw } from 'lucide-react';
import { fetchCheckpoints } from '@/lib/api/gemini';
import { Checkpoint } from '@/lib/types/gemini';

export function SessionTimeline() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCheckpoints()
      .then(setCheckpoints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Session Timeline" description="Checkpoints & Restore Points" icon={GitBranch} className="h-full">
        <div className="flex items-center justify-center h-40 text-sm text-zinc-500">Loading timeline...</div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="Session Timeline" description="Checkpoints & Restore Points" icon={GitBranch} className="h-full">
      <div className="relative pl-6 space-y-6 before:absolute before:left-[29px] before:top-4 before:bottom-4 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
        {checkpoints.map((cp, index) => {
          const isLast = index === checkpoints.length - 1;
          const formattedTime = new Date(cp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          return (
            <div key={cp.id} className="relative group">
              {/* Node */}
              <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${
                isLast 
                  ? 'bg-blue-500 border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.2)]' 
                  : cp.type === 'manual' 
                    ? 'bg-zinc-900 border-zinc-900 dark:bg-zinc-100 dark:border-zinc-100' 
                    : 'bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-600'
              }`}>
                {isLast && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>

              {/* Content */}
              <div className={`p-3 rounded-lg border transition-all ${
                isLast 
                  ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30' 
                  : 'bg-card border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{cp.tag}</span>
                    {cp.type === 'manual' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                        Manual
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{formattedTime}</span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    <GitCommit size={12} />
                    <span>{cp.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{cp.messageCount} msgs</span>
                  </div>
                </div>

                {!isLast && (
                  <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200">
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button className="flex items-center gap-1.5 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <GitPullRequest size={12} /> Fork
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ModuleCard>
  );
}
