'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Brain, FolderOpen, Webhook, Loader2, Plus, Trash2, RefreshCw, FolderPlus, Edit3, Save, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Module 7: Memory Manager (GEMINI.md) ────────────────
// ─── Module 7: Memory Manager (GEMINI.md) ────────────────
export const MemoryManager = memo(function MemoryManager() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFiles = () => {
    setLoading(true);
    fetch('/api/memory')
      .then(r => r.json())
      .then(data => setFiles(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFiles(); }, []);

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditContent(files[idx].content);
  };

  const handleSave = async () => {
    if (editingIdx === null) return;
    setSaving(true);
    try {
      await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: files[editingIdx].path, content: editContent }),
      });
      setEditingIdx(null);
      fetchFiles();
    } catch (err) { console.error('Save failed:', err); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <ModuleCard title="Memory" description="GEMINI.md context" icon={Brain}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="Memory"
      description={`${files.length} context file${files.length !== 1 ? 's' : ''}`}
      icon={Brain}
      actions={
        <button onClick={fetchFiles} className="p-1.5 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="text-center py-6 text-xs font-bold uppercase tracking-widest text-zinc-400">
            No GEMINI.md files found
          </div>
        ) : (
          files.map((file, i) => (
            <div key={file.path} className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              file.scope === 'global'
                ? "border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-800"
                : "border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 hover:border-amber-300 dark:hover:border-amber-800"
            )}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Brain size={14} className={file.scope === 'global' ? 'text-blue-500' : 'text-amber-500'} />
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{file.scope === 'global' ? 'Global' : 'Project'}</span>
                  <span className="text-[10px] text-zinc-500 font-mono opacity-70">{(file.size / 1024).toFixed(1)}KB</span>
                </div>
                <div className="flex items-center gap-1">
                  {editingIdx === i ? (
                    <button onClick={handleSave} disabled={saving} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    </button>
                  ) : (
                    <button onClick={() => startEdit(i)} className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded transition-colors">
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {editingIdx === i ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-32 px-3 py-2 text-xs font-mono bg-white dark:bg-black/20 border border-zinc-200 dark:border-zinc-700/50 rounded resize-y outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
                  spellCheck={false}
                />
              ) : (
                <div className="bg-white/50 dark:bg-black/20 rounded p-2 border border-zinc-100 dark:border-zinc-800/50">
                  <pre className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {file.content.slice(0, 300)}{file.content.length > 300 ? '...' : ''}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ModuleCard>
  );
});

// ─── Module 15: Directory Manager ────────────────────────
// ─── Module 15: Directory Manager ────────────────────────
export const DirectoryManager = memo(function DirectoryManager() {
  const [dirs, setDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDir, setNewDir] = useState('');

  const fetchDirs = () => {
    fetch('/api/directories')
      .then(r => r.json())
      .then(data => setDirs(data.directories || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDirs(); }, []);

  const handleAdd = async () => {
    if (!newDir.trim()) return;
    try {
      await fetch('/api/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', directory: newDir.trim() }),
      });
      setNewDir('');
      fetchDirs();
    } catch (err) { console.error('Add failed:', err); }
  };

  const handleRemove = async (dir: string) => {
    try {
      await fetch('/api/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', directory: dir }),
      });
      fetchDirs();
    } catch (err) { console.error('Remove failed:', err); }
  };

  if (loading) {
    return (
      <ModuleCard title="Include Directories" description="Extra context directories" icon={FolderOpen}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="Include Directories" description={`${dirs.length} configured`} icon={FolderOpen}>
      <div className="space-y-3">
        {dirs.length === 0 ? (
          <div className="text-center py-6 text-xs font-bold uppercase tracking-widest text-zinc-400">No extra directories configured</div>
        ) : (
          <div className="space-y-1">
            {dirs.map(dir => (
              <div key={dir} className="flex items-center justify-between py-2 px-2.5 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FolderOpen size={14} className="text-blue-500 fill-blue-500/20 shrink-0" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 font-mono truncate">{dir}</span>
                </div>
                <button
                  onClick={() => handleRemove(dir)}
                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 p-1 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <input
            value={newDir}
            onChange={e => setNewDir(e.target.value)}
            placeholder="../lib, ../docs ..."
            className="flex-1 px-2 py-1.5 text-xs bg-transparent outline-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newDir.trim()}
            className="px-2 py-1 text-xs bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
    </ModuleCard>
  );
});

// ─── Module 13: Hooks Editor ─────────────────────────────
// ─── Module 13: Hooks Editor ─────────────────────────────
export const HooksManager = memo(function HooksManager() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hooks')
      .then(r => r.json())
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Hooks" description="Event hooks" icon={Webhook}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  const availableEvents = config?.availableEvents || [];
  const hooks = config?.hooks || {};
  const hooksConfig = config?.hooksConfig || {};
  const configuredHookNames = Object.keys(hooks);

  return (
    <ModuleCard
      title="Hooks"
      description={`${configuredHookNames.length} configured`}
      icon={Webhook}
    >
      <div className="space-y-4">
        {/* Global Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Webhook size={14} className="text-purple-500" />
            <span className="text-sm font-medium">Hooks System</span>
          </div>
          <span className={cn(
            "px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border",
            hooksConfig.enabled !== false
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
          )}>
            {hooksConfig.enabled !== false ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Available Events */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Available Events</h4>
          <div className="flex flex-wrap gap-1.5">
            {availableEvents.map((event: string) => {
              const hasHook = hooks[event];
              return (
                <span
                  key={event}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded-md border font-mono transition-colors",
                    hasHook
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20"
                      : "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700/50"
                  )}
                >
                  {event}
                </span>
              );
            })}
          </div>
        </div>

        {/* Configured Hooks Detail */}
        {configuredHookNames.length > 0 && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Hooks</h4>
            {configuredHookNames.map(name => (
              <div key={name} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={12} className="text-emerald-500" />
                  <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-200">{name}</span>
                </div>
                <div className="bg-white dark:bg-black/20 rounded p-2 border border-zinc-100 dark:border-zinc-800/50">
                  <pre className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(hooks[name], null, 2).slice(0, 150)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleCard>
  );
});


