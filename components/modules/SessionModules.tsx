'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

export function CheckpointManager() {
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
        <button onClick={fetchAllSessions} className="p-1.5 text-zinc-500 hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid md:grid-cols-3 gap-2">
          <button
            onClick={() => copyCommand('/chat save milestone-1')}
            className="text-left p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="text-xs text-muted-foreground">Save Checkpoint</div>
            <div className="text-[11px] mt-1 font-mono text-foreground flex items-center gap-1"><Save size={11} />/chat save &lt;tag&gt;</div>
          </button>
          <button
            onClick={() => copyCommand('/chat list')}
            className="text-left p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="text-xs text-muted-foreground">List Checkpoints</div>
            <div className="text-[11px] mt-1 font-mono text-foreground flex items-center gap-1"><Clock3 size={11} />/chat list</div>
          </button>
          <button
            onClick={() => copyCommand('/chat resume <tag>')}
            className="text-left p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="text-xs text-muted-foreground">Resume Checkpoint</div>
            <div className="text-[11px] mt-1 font-mono text-foreground flex items-center gap-1"><ArchiveRestore size={11} />/chat resume &lt;tag&gt;</div>
          </button>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
            Session History Proxy (for /resume)
          </div>
          <div className="max-h-[260px] overflow-auto divide-y divide-zinc-200 dark:divide-zinc-800">
            {recent.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No session data yet</div>
            ) : (
              recent.map((session) => (
                <div key={session.id} className="px-3 py-2.5 flex items-start justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{session.title || session.id}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">{session.id}</div>
                    {session.workspace && (
                      <div className="text-[10px] text-muted-foreground truncate">{session.workspace}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{formatAgo(session.updated_at ?? session.lastUpdated)}</span>
                    <button
                      onClick={() => copyCommand(`/resume ${session.id}`)}
                      className="p-1.5 text-zinc-500 hover:text-foreground"
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
}
