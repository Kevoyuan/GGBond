'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from '../ModuleCard';
import { FolderGit2, FileCode, RefreshCw, Eye, Edit3, Loader2, Save } from 'lucide-react';

interface GeminiMdFile {
  path: string;
  scope: 'global' | 'project';
  content: string;
  size: number;
}

export function ProjectContext() {
  const [files, setFiles] = useState<GeminiMdFile[]>([]);
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
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ModuleCard title="Project Context" description="GEMINI.md files" icon={FolderGit2}>
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="Project Context"
      description={`${files.length} GEMINI.md file${files.length !== 1 ? 's' : ''}`}
      icon={FolderGit2}
      actions={
        <button onClick={fetchFiles} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-500">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-4">
        {files.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">No GEMINI.md files found</div>
        ) : (
          files.map((file, i) => (
            <div key={file.path} className={`p-3 rounded-lg border ${file.scope === 'global'
                ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30'
                : 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30'
              }`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <FileCode size={14} className={file.scope === 'global' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'} />
                  <span className="font-medium text-sm">{file.path.split('/').pop()}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-full border ${file.scope === 'global'
                      ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50'
                      : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50'
                    }`}>
                    {file.scope}
                  </span>
                </div>
                <div className="flex gap-1">
                  {editingIdx === i ? (
                    <button onClick={handleSave} disabled={saving} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600">
                      <Save size={14} />
                    </button>
                  ) : (
                    <button onClick={() => startEdit(i)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-muted-foreground">
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {editingIdx === i ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-32 px-2 py-1.5 text-xs font-mono bg-background border border-zinc-200 dark:border-zinc-700 rounded resize-y"
                />
              ) : (
                <p className="text-xs text-muted-foreground line-clamp-3 font-mono whitespace-pre-wrap">
                  {file.content.slice(0, 200)}{file.content.length > 200 ? '...' : ''}
                </p>
              )}

              <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">{file.path}</div>
            </div>
          ))
        )}
      </div>
    </ModuleCard>
  );
}
