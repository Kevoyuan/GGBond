'use client';

import React, { useEffect, useMemo, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { BookmarkCheck, Loader2, RefreshCw, Copy, Clock3, ArchiveRestore, Save } from 'lucide-react';

interface SessionItem {
  id: string;
  title: string;
  created_at?: string | number;
  updated_at?: string | number;
  lastUpdated?: string;
  workspace?: string;
  isCore?: boolean;
}

function toTs(value: string | number | undefined) {
  if (value === undefined) return 0;
  if (typeof value === 'number') return value;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export const CheckpointManager = memo(function CheckpointManager() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllSessions = async () => {
    setLoading(true);
    try {
      const [dbRes, coreRes] = await Promise.all([
        fetch('/api/sessions').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/sessions/core').then((r) => (r.ok ? r.json() : [])),
      ]);

      const merged: SessionItem[] = [...(Array.isArray(dbRes) ? dbRes : [])];
      for (const item of Array.isArray(coreRes) ? coreRes : []) {
        if (!merged.some((session) => session.id === item.id)) {
          merged.push(item);
        }
      }

      merged.sort((a, b) => {
        const ta = toTs(a.updated_at ?? a.lastUpdated);
        const tb = toTs(b.updated_at ?? b.lastUpdated);
        return tb - ta;
      });

      setSessions(merged);
    } catch (err) {
      console.error('Failed to load checkpoint data:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSessions();
  }, []);

  const recent = useMemo(() => sessions.slice(0, 12), [sessions]);

  const copyCommand = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const formatAgo = (value: string | number | undefined) => {
    const ts = toTs(value);
    if (!ts) return 'unknown';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <ModuleCard title="Checkpointing" description="/chat save | /chat list | /chat resume" icon={BookmarkCheck}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="Checkpointing"
      description={`${sessions.length} resumable sessions`}
      icon={BookmarkCheck}
      actions={
        <button onClick={fetchAllSessions} className="p-1.5 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid md:grid-cols-3 gap-2">
          <button
            onClick={() => copyCommand('/chat save milestone-1')}
            className="text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-purple-300 dark:hover:border-purple-700/50 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Save size={14} className="text-purple-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Save Checkpoint</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400">/chat save &lt;tag&gt;</div>
          </button>

          <button
            onClick={() => copyCommand('/chat list')}
            className="text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-blue-300 dark:hover:border-blue-700/50 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock3 size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">List Checkpoints</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">/chat list</div>
          </button>

          <button
            onClick={() => copyCommand('/chat resume <tag>')}
            className="text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <ArchiveRestore size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Resume Checkpoint</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">/chat resume &lt;tag&gt;</div>
          </button>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white/50 dark:bg-zinc-900/20">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 backdrop-blur-sm">
            Session History Proxy (for /resume)
          </div>
          <div className="max-h-[260px] overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800/50 custom-scrollbar">
            {recent.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground italic">No session data yet</div>
            ) : (
              recent.map((session) => (
                <div key={session.id} className="px-3 py-3 flex items-start justify-between gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{session.title || session.id}</span>
                      {session.isCore && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">CORE</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 px-1 rounded">{session.id.slice(0, 8)}...</span>
                      {session.workspace && (
                        <span className="text-[10px] text-zinc-500 truncate max-w-[150px] flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></span>
                          {session.workspace.split('/').pop()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-zinc-400 font-mono">{formatAgo(session.updated_at ?? session.lastUpdated)}</span>
                    <button
                      onClick={() => copyCommand(`/resume ${session.id}`)}
                      className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Copy /resume command"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ModuleCard>
  );
});
