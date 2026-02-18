'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Brain, FolderOpen, Webhook, Loader2, Plus, Trash2, RefreshCw, FolderPlus, Edit3, Save, CheckCircle } from 'lucide-react';

// ─── Module 7: Memory Manager (GEMINI.md) ────────────────
export function MemoryManager() {
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
        <button onClick={fetchFiles} className="p-1 text-zinc-500 hover:text-foreground transition-colors"><RefreshCw size={14} /></button>
      }
    >
      <div className="space-y-3">
        {files.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No GEMINI.md files found
          </div>
        ) : (
          files.map((file, i) => (
            <div key={file.path} className={`p-3 rounded-lg border ${file.scope === 'global'
                ? 'border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5'
                : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/5'
              }`}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Brain size={14} className={file.scope === 'global' ? 'text-blue-500' : 'text-amber-500'} />
                  <span className="text-sm font-medium">{file.scope === 'global' ? 'Global' : 'Project'}</span>
                  <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)}KB</span>
                </div>
                {editingIdx === i ? (
                  <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                    <Save size={14} />
                  </button>
                ) : (
                  <button onClick={() => startEdit(i)} className="p-1 text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
              {editingIdx === i ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-28 px-2 py-1.5 text-xs font-mono bg-background border border-zinc-200 dark:border-zinc-700 rounded resize-y"
                />
              ) : (
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-4">
                  {file.content.slice(0, 300)}{file.content.length > 300 ? '...' : ''}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </ModuleCard>
  );
}

// ─── Module 15: Directory Manager ────────────────────────
export function DirectoryManager() {
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
          <p className="text-center py-4 text-sm text-muted-foreground">No extra directories configured</p>
        ) : (
          <div className="space-y-1">
            {dirs.map(dir => (
              <div key={dir} className="flex items-center justify-between py-2 px-2 rounded group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen size={14} className="text-amber-500 shrink-0" />
                  <span className="text-sm text-foreground font-mono truncate">{dir}</span>
                </div>
                <button
                  onClick={() => handleRemove(dir)}
                  className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newDir}
            onChange={e => setNewDir(e.target.value)}
            placeholder="../lib, ../docs ..."
            className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded bg-transparent"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newDir.trim()}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded font-medium hover:opacity-90 disabled:opacity-50"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
    </ModuleCard>
  );
}

// ─── Module 13: Hooks Editor ─────────────────────────────
export function HooksManager() {
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
      <div className="space-y-3">
        {/* Global Status */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
          <span className="text-sm text-muted-foreground">Hooks System</span>
          <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${hooksConfig.enabled !== false
              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40'
              : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/40'
            }`}>
            {hooksConfig.enabled !== false ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Available Events */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Available Events</h4>
          <div className="flex flex-wrap gap-1">
            {availableEvents.map((event: string) => {
              const hasHook = hooks[event];
              return (
                <span
                  key={event}
                  className={`px-2 py-1 text-[10px] rounded-full border font-mono ${hasHook
                      ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/30'
                      : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                    }`}
                >
                  {event}
                </span>
              );
            })}
          </div>
        </div>

        {/* Configured Hooks Detail */}
        {configuredHookNames.length > 0 && (
          <div className="pt-2 border-t border-border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Active Hooks</h4>
            {configuredHookNames.map(name => (
              <div key={name} className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={12} className="text-green-500" />
                  <span className="text-sm font-mono font-medium text-foreground">{name}</span>
                </div>
                <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap">
                  {JSON.stringify(hooks[name], null, 2).slice(0, 150)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
