'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import {
  Loader2,
  Plus,
  Save,
  TerminalSquare,
  RefreshCw,
  Trash2,
  Copy,
  Sparkles,
  Pencil,
  X,
} from 'lucide-react';

interface CommandFile {
  id: string;
  name: string;
  path: string;
  scope: 'project' | 'global' | 'extension';
  editable: boolean;
  updatedAt: number;
  content: string;
}

export function CustomCommandManager() {
  const [commands, setCommands] = useState<CommandFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const fetchCommands = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/commands');
      const data = await res.json();
      setCommands(Array.isArray(data.commands) ? data.commands : []);
    } catch (err) {
      console.error('Failed to load commands:', err);
      setCommands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, []);

  const selected = commands.find((item) => item.id === selectedId) || null;

  const onSelect = (item: CommandFile) => {
    setSelectedId(item.id);
    setEditingContent(item.content);
  };

  const handleSave = async () => {
    if (!selected || !selected.editable) return;
    setSaving(true);
    try {
      await fetch('/api/commands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selected.path, content: editingContent }),
      });
      await fetchCommands();
    } catch (err) {
      console.error('Failed to save command:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          prompt: newPrompt,
        }),
      });
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      setNewPrompt('');
      await fetchCommands();
    } catch (err) {
      console.error('Failed to create command:', err);
    }
  };

  const handleDelete = async () => {
    if (!selected || !selected.editable) return;
    if (!confirm(`Delete command "${selected.name}"?`)) return;

    try {
      await fetch(`/api/commands?path=${encodeURIComponent(selected.path)}`, {
        method: 'DELETE',
      });
      setSelectedId(null);
      setEditingContent('');
      await fetchCommands();
    } catch (err) {
      console.error('Failed to delete command:', err);
    }
  };

  const copySlash = async (name: string) => {
    await navigator.clipboard.writeText(`/${name}`);
  };

  if (loading) {
    return (
      <ModuleCard title="Custom Commands" description="Slash command editor" icon={TerminalSquare}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="Custom Commands"
      description={`${commands.length} TOML commands`}
      icon={TerminalSquare}
      actions={
        <button onClick={fetchCommands} className="p-1.5 text-zinc-500 hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="grid xl:grid-cols-[240px_1fr] gap-3 h-full">
        <div className="space-y-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 max-h-[360px] overflow-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2 px-2 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-muted-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-1.5"
          >
            <Plus size={12} /> New Command
          </button>

          {commands.length === 0 ? (
            <div className="text-center py-5 text-xs text-muted-foreground">No command files found</div>
          ) : (
            commands.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                  item.id === selectedId
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-foreground truncate">/{item.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    item.scope === 'project'
                      ? 'text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                      : item.scope === 'global'
                        ? 'text-blue-600 bg-blue-100 border-blue-200 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-900/30'
                        : 'text-amber-600 bg-amber-100 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-900/30'
                  }`}>
                    {item.scope}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">{item.path}</div>
              </button>
            ))
          )}
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 flex flex-col min-h-[360px]">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a command to view/edit
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-500" />
                    <span className="font-mono truncate">/{selected.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{selected.path}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copySlash(selected.name)}
                    className="p-1.5 text-zinc-500 hover:text-foreground"
                    title="Copy slash command"
                  >
                    <Copy size={13} />
                  </button>
                  {selected.editable && (
                    <>
                      <button
                        onClick={handleDelete}
                        className="p-1.5 text-zinc-500 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="p-1.5 text-zinc-500 hover:text-emerald-500"
                        title="Save"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                readOnly={!selected.editable}
                className="flex-1 min-h-[280px] w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg resize-none"
              />
              {!selected.editable && (
                <div className="text-[10px] text-muted-foreground mt-2">Extension commands are read-only.</div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-background shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Pencil size={14} />Create Command</h4>
              <button onClick={() => setShowCreate(false)} className="p-1.5 text-zinc-500 hover:text-foreground"><X size={14} /></button>
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="command-name"
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short description"
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
            />
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Prompt body"
              className="w-full h-44 px-3 py-2 text-xs font-mono border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={handleCreate} className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90">Create</button>
            </div>
          </div>
        </div>
      )}
    </ModuleCard>
  );
}
