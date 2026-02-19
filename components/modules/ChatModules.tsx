'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { MessageSquare, Loader2, RefreshCw, GitBranch, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Module 3: Chat Session Manager ─────────────────────
interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  workspace?: string;
}

export const ChatManager = memo(function ChatManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = () => {
    setLoading(true);
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, []);

  if (loading) {
    return (
      <ModuleCard title="Sessions" description="Chat sessions" icon={MessageSquare}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <ModuleCard
      title="Sessions"
      description={`${sessions.length} total`}
      icon={MessageSquare}
      actions={
        <button onClick={fetchSessions} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 pr-1">
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-2 text-zinc-400">
              <MessageSquare size={18} />
            </div>
            <div className="text-xs font-medium text-zinc-500">No sessions yet</div>
            <div className="text-[10px] text-zinc-400 mt-1">Start a new chat to see it here</div>
          </div>
        ) : sessions.slice(0, 8).map(session => (
          <div key={session.id} className="group relative flex flex-col p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm cursor-pointer">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 max-w-[calc(100%-60px)]">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate font-mono tracking-tight">{session.title || 'Untitled Session'}</div>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 shrink-0">
                <Clock size={10} />
                {formatTime(session.updated_at)}
              </span>
            </div>

            <div className="flex items-center justify-between pl-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700/50">
                  {session.id.slice(0, 8)}
                </span>
                {session.workspace && (
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400 truncate max-w-[120px]">
                    <GitBranch size={10} />
                    {session.workspace.split('/').pop()}
                  </span>
                )}
              </div>
              <ArrowRight size={12} className="text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300" />
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
});
