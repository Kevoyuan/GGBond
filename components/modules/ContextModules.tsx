import React from 'react';
import { ModuleCard } from './ModuleCard';
import { Brain, Folder, Anchor, Plus, X, Eye } from 'lucide-react';

export function MemoryManager() {
  const memories = [
    { id: '1', content: 'Project uses Next.js 14 App Router', type: 'knowledge' },
    { id: '2', content: 'User prefers dark mode by default', type: 'preference' },
  ];

  return (
    <ModuleCard title="Memory & Context" description="Long-term memory and context injection" icon={Brain}>
      <div className="space-y-3">
        {memories.map((mem) => (
          <div key={mem.id} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-800/20">
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                mem.type === 'knowledge' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
              }`}>
                {mem.type}
              </span>
              <button className="text-zinc-400 hover:text-red-500"><X size={12} /></button>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{mem.content}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add new memory..." 
            className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
          />
          <button className="px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium">Add</button>
        </div>
      </div>
    </ModuleCard>
  );
}

export function DirectoryManager() {
  const dirs = [
    '/Volumes/SSD/Projects/Code/gem-ui',
    '../gemini-cli-core/lib',
  ];

  return (
    <ModuleCard title="Directory Scope" description="Allowed working directories" icon={Folder}>
      <ul className="space-y-2">
        {dirs.map((dir, i) => (
          <li key={i} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400">
            <Folder size={14} className="text-blue-500" />
            <span className="truncate flex-1">{dir}</span>
            <button className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"><X size={14} /></button>
          </li>
        ))}
      </ul>
      <button className="mt-4 w-full py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20">
        Add Directory
      </button>
    </ModuleCard>
  );
}

export function HooksManager() {
  return (
    <ModuleCard title="Hooks" description="Event hooks and middleware" icon={Anchor}>
      <div className="space-y-2">
        {['on_message_received', 'before_tool_execution', 'after_tool_execution'].map(hook => (
          <div key={hook} className="flex items-center justify-between p-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
            <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">{hook}</span>
            <span className="text-xs text-zinc-400 italic">No active listeners</span>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}
