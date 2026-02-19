'use client';

import React, { useEffect, useState, memo } from 'react';
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

// ─── Module 8: Custom Commands (Slash Commands) ──────────
interface CommandFile {
  id: string;
  name: string;
  path: string;
  scope: 'project' | 'global' | 'extension';
  editable: boolean;
  updatedAt: number;
  content: string;
}

export const CustomCommandManager = memo(function CustomCommandManager() {
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
      className="min-h-[500px]"
      actions={
        <button onClick={fetchCommands} className="p-1.5 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-full min-h-[400px]">
        {/* Command List */}
        <div className="flex flex-col gap-2 h-full">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2.5 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={14} /> New Command
          </button>

          <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 p-1 bg-zinc-50/30 dark:bg-black/20">
            {commands.length === 0 ? (
              <div className="text-center py-8 text-xs font-medium text-zinc-400">No commands found</div>
            ) : (
              <div className="space-y-0.5">
                {commands.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`w-full text-left p-2.5 rounded-md transition-all border ${item.id === selectedId
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm'
                        : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`font-mono text-xs font-bold truncate ${item.id === selectedId ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'}`}>/{item.name}</span>
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${item.scope === 'project'
                          ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20'
                          : item.scope === 'global'
                            ? 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20'
                            : 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20'
                        }`}>
                        {item.scope}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate opacity-70 pl-0.5">{item.path}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col h-full overflow-hidden shadow-sm">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                <TerminalSquare size={24} className="opacity-50" />
              </div>
              <div className="text-sm font-medium">Select a command to view or edit</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span className="font-mono">/{selected.name}</span>
                      {!selected.editable && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Read-only</span>}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate font-mono max-w-[300px]">{selected.path}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => copySlash(selected.name)} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors" title="Copy command">
                    <Copy size={14} />
                  </button>
                  {selected.editable && (
                    <>
                      <button onClick={handleDelete} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                      <button onClick={handleSave} disabled={saving} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors" title="Save">
                        {saving ? <Loader2 size={14} className="animate-spin text-emerald-600" /> : <Save size={14} />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 relative">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  readOnly={!selected.editable}
                  className="w-full h-full p-4 text-xs font-mono bg-white dark:bg-zinc-950 resize-none outline-none text-zinc-800 dark:text-zinc-300 leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/30"
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><Pencil size={14} className="text-blue-500" /> Create New Command</h4>
              <button onClick={() => setShowCreate(false)} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Command Name</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-zinc-400 font-mono text-sm">/</span>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. explain-code"
                      className="w-full code-input pl-6"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Description</label>
                  <input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What does it do?"
                    className="w-full code-input"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Prompt Template (TOML)</label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="[[steps]]&#10;name = 'step-1'&#10;..."
                  className="w-full h-48 code-input font-mono text-xs leading-relaxed resize-none p-3"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Create Command</button>
            </div>
          </div>
        </div>
      )}
    </ModuleCard>
  );
});
