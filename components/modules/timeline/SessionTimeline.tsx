'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { GitBranch, GitCommit, Clock, RotateCcw, Loader2, MessageSquare } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  workspace?: string;
}

export function SessionTimeline() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Session Timeline" description="Recent sessions" icon={GitBranch} className="h-full">
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <ModuleCard title="Session Timeline" description={`${sessions.length} recent sessions`} icon={GitBranch} className="h-full">
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">No sessions yet</div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
          {sessions.map((session, index) => {
            const isFirst = index === 0;
            return (
              <div key={session.id} className="relative group">
                {/* Node */}
                <div className={`absolute -left-[17px] top-2 w-3 h-3 rounded-full border-2 z-10 transition-colors ${isFirst
                    ? 'bg-blue-500 border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]'
                    : 'bg-white border-zinc-300 dark:bg-zinc-900 dark:border-zinc-600'
                  }`} />

                {/* Content */}
                <div className={`p-3 rounded-lg border transition-all ${isFirst
                    ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30'
                    : 'bg-card border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm text-foreground line-clamp-1">{session.title}</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">{formatTime(session.updated_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <GitCommit size={11} />
                      <span className="font-mono">{session.id.slice(0, 8)}...</span>
                    </div>
                    {session.workspace && (
                      <div className="flex items-center gap-1 truncate">
                        <span className="truncate">{session.workspace.split('/').pop()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModuleCard>
  );
}
