'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { MessageSquare, Loader2, RefreshCw, GitBranch } from 'lucide-react';

// ─── Module 3: Chat Session Manager ─────────────────────
interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  workspace?: string;
}

export function ChatManager() {
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
        <button onClick={fetchSessions} className="p-1 text-zinc-500 hover:text-foreground transition-colors"><RefreshCw size={14} /></button>
      }
    >
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">No sessions yet. Start a chat!</div>
        ) : sessions.slice(0, 8).map(session => (
          <div key={session.id} className="flex items-center justify-between p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground line-clamp-1">{session.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">{session.id.slice(0, 8)}...</span>
                {session.workspace && (
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {session.workspace.split('/').pop()}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatTime(session.updated_at)}</span>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}
