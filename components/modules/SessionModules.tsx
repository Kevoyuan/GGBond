'use client';

import React, { useEffect, useMemo, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { BookmarkCheck, Loader2, RefreshCw, Copy, Clock3, ArchiveRestore, Save, GitBranch, ArrowRight } from 'lucide-react';

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
      <ModuleCard title="Checkpointing" description="/chat save | /chat list | /chat resume" icon={BookmarkCheck} className="h-[30rem] flex flex-col">
        <div className="flex items-center justify-center flex-1"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="Checkpointing"
      description={`${sessions.length} resumable sessions`}
      icon={BookmarkCheck}
      className="h-[40rem] flex flex-col w-full"
      actions={
        <button onClick={fetchAllSessions} className="p-1.5 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="flex-1 min-h-[0] flex flex-col gap-3">
        {/* Dense Utility Bar */}
        <div className="flex gap-2 p-1.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 shrink-0">
          <button
            onClick={() => copyCommand('/chat save milestone-1')}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/50 hover:border-purple-300 dark:hover:border-purple-800 transition-all group"
          >
            <Save size={10} className="text-purple-500" />
            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-mono tracking-tight group-hover:text-purple-600">SAVE</span>
          </button>

          <button
            onClick={() => copyCommand('/chat list')}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/50 hover:border-blue-300 dark:hover:border-blue-800 transition-all group"
          >
            <Clock3 size={10} className="text-blue-500" />
            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-mono tracking-tight group-hover:text-blue-600">LIST</span>
          </button>

          <button
            onClick={() => copyCommand('/chat resume milestone-1')}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/50 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all group"
          >
            <ArchiveRestore size={10} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-mono tracking-tight group-hover:text-emerald-600">RESUME</span>
          </button>
        </div>

        <div className="flex-1 min-h-[0] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 pr-2 space-y-2">
          {recent.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground italic">No session data yet</div>
          ) : (
            recent.map((session) => (
              <div key={session.id} className="group relative flex flex-col p-1.5 rounded-md border border-zinc-200/40 dark:border-zinc-800/40 bg-white/30 dark:bg-zinc-900/10 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-[0_1px_4px_-1px_rgba(0,0,0,0.03)] transition-all duration-200 cursor-pointer">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 max-w-[calc(100%-50px)]">
                    <div className="w-1.2 h-1.2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate font-mono tracking-tight leading-tight">{session.title || 'Untitled Session'}</div>
                    {session.isCore && <span className="px-1 py-0.5 rounded-[2px] text-[8px] font-bold bg-amber-100/50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500 border border-amber-200/50 dark:border-amber-800/30 shrink-0">CORE</span>}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1 shrink-0 bg-zinc-50/80 dark:bg-zinc-800/80 px-1 py-0.5 rounded-sm border border-zinc-200/50 dark:border-zinc-700/50">
                    {formatAgo(session.updated_at ?? session.lastUpdated)}
                  </span>
                </div>

                <div className="flex items-center justify-between pl-2.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100/80 dark:bg-zinc-800/50 px-1 rounded-sm border border-zinc-200/50 dark:border-zinc-700/50 shrink-0">
                      {session.id.slice(0, 7)}
                    </span>
                    {session.workspace && (
                      <div className="flex items-center gap-1 text-[9px] text-zinc-500 dark:text-zinc-400 truncate font-medium">
                        <GitBranch size={8} className="opacity-70" />
                        <span className="truncate">{session.workspace.split('/').pop()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyCommand(`/resume ${session.id}`); }}
                      className="p-1 text-zinc-400 hover:text-blue-600 transition-colors"
                      title="Copy resume command"
                    >
                      <Copy size={10} />
                    </button>
                    <ArrowRight size={10} className="text-zinc-400 dark:text-zinc-600 translate-x-1 group-hover:translate-x-0 transition-transform duration-200" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ModuleCard>
  );
});
