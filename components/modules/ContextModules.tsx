import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Brain, Folder, Anchor, Plus, X, Eye, Loader2, RefreshCw } from 'lucide-react';
import { 
  fetchContext, 
  addDirectory, 
  removeDirectory, 
  fetchHooks, 
  toggleHook,
  fetchMemory,
  addMemory
} from '@/lib/api/gemini';
import { Hook, ProjectContext } from '@/lib/types/gemini';

export function MemoryManager() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadMemory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMemory();
      setContent(data.content || 'No memory content found.');
    } catch (err) {
      console.error('Failed to load memory:', err);
      setError('Failed to load memory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemory();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim() || processing) return;

    setProcessing(true);
    try {
      await addMemory(newMemory.trim());
      setNewMemory('');
      await loadMemory();
    } catch (err) {
      console.error('Failed to add memory:', err);
      alert('Failed to add memory');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ModuleCard title="Memory & Context" description="Global context (GEMINI.md)" icon={Brain}>
      {loading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-zinc-400" size={20} />
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 p-2 text-center">{error}</div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-800/20 max-h-[200px] overflow-y-auto">
            <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono">
              {content}
            </pre>
          </div>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input 
              type="text" 
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="Add to memory..." 
              className="flex-1 px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-zinc-400"
              disabled={processing}
            />
            <button 
              type="submit" 
              disabled={processing || !newMemory.trim()}
              className="px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-xs font-medium disabled:opacity-50"
            >
              {processing ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
            </button>
          </form>
        </div>
      )}
    </ModuleCard>
  );
}

export function DirectoryManager() {
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDir, setNewDir] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadContext = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchContext();
      setContext(data);
    } catch (err) {
      console.error('Failed to load context:', err);
      setError('Failed to load directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDir.trim() || processing) return;

    setProcessing(true);
    try {
      await addDirectory(newDir.trim());
      setNewDir('');
      await loadContext();
    } catch (err) {
      console.error('Failed to add directory:', err);
      alert('Failed to add directory');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = async (path: string) => {
    if (processing || !confirm(`Remove directory "${path}"?`)) return;

    setProcessing(true);
    try {
      await removeDirectory(path);
      await loadContext();
    } catch (err) {
      console.error('Failed to remove directory:', err);
      alert('Failed to remove directory');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ModuleCard title="Directory Scope" description="Allowed working directories" icon={Folder}>
      {loading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-zinc-400" size={20} />
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 p-2 text-center">{error}</div>
      ) : (
        <>
          <div className="mb-3 text-xs text-zinc-500">
            Working Directory: <span className="font-mono text-zinc-700 dark:text-zinc-300">{context?.workingDirectory || 'Unknown'}</span>
          </div>
          <ul className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
            {context?.includedDirectories.length === 0 ? (
              <li className="text-sm text-zinc-400 italic text-center py-2">No additional directories included</li>
            ) : (
              context?.includedDirectories.map((dir, i) => (
                <li key={i} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400 group">
                  <Folder size={14} className="text-blue-500 shrink-0" />
                  <span className="truncate flex-1" title={dir}>{dir}</span>
                  <button 
                    onClick={() => handleRemove(dir)}
                    disabled={processing}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))
            )}
          </ul>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input 
              type="text" 
              value={newDir}
              onChange={(e) => setNewDir(e.target.value)}
              placeholder="/path/to/directory"
              className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent focus:outline-none focus:ring-1 focus:ring-zinc-400"
              disabled={processing}
            />
            <button 
              type="submit" 
              disabled={processing || !newDir.trim()}
              className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-xs font-medium disabled:opacity-50"
            >
              {processing ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
            </button>
          </form>
        </>
      )}
    </ModuleCard>
  );
}

export function HooksManager() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadHooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHooks();
      setHooks(data.hooks || []);
    } catch (err) {
      console.error('Failed to load hooks:', err);
      setError('Failed to load hooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHooks();
  }, []);

  const handleToggle = async (name: string, enabled: boolean) => {
    if (toggling) return;
    setToggling(name);
    try {
      await toggleHook(name, !enabled);
      setHooks(prev => prev.map(h => h.name === name ? { ...h, enabled: !enabled } : h));
    } catch (error) {
      console.error('Failed to toggle hook:', error);
      alert('Failed to toggle hook');
    } finally {
      setToggling(null);
    }
  };

  return (
    <ModuleCard title="Hooks" description="Event hooks and middleware" icon={Anchor}>
       <div className="flex justify-end mb-2">
        <button 
          onClick={loadHooks} 
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          title="Refresh Hooks"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-zinc-400" size={20} />
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 p-2 text-center">{error}</div>
      ) : hooks.length === 0 ? (
        <div className="text-sm text-zinc-400 italic text-center py-4">No hooks registered</div>
      ) : (
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {hooks.map(hook => (
            <div key={hook.name} className="flex items-center justify-between p-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded transition-colors">
              <div className="flex flex-col min-w-0 flex-1 mr-2">
                <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400 truncate" title={hook.name}>{hook.name}</span>
                <span className="text-[10px] text-zinc-400 truncate">{hook.configs.length} actions</span>
              </div>
              <div 
                onClick={() => handleToggle(hook.name, hook.enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 ${
                  hook.enabled ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'
                } ${toggling === hook.name ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    hook.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ModuleCard>
  );
}
