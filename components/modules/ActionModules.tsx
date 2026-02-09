import React from 'react';
import { ModuleCard } from './ModuleCard';
import { Terminal, Lock, FileText, ShieldCheck, Key, LogOut, UploadCloud, FileCode } from 'lucide-react';

export function ShellManager() {
  const history = [
    { cmd: 'npm run build', status: 'success', time: '2m ago' },
    { cmd: 'ls -la', status: 'success', time: '5m ago' },
    { cmd: 'git status', status: 'success', time: '1h ago' },
  ];

  return (
    <ModuleCard title="Shell Integration" description="Terminal command execution" icon={Terminal}>
      <div className="space-y-3">
        <div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-300">
          <div className="flex gap-2 mb-2 border-b border-zinc-800 pb-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-green-500">➜</span>
                <span className="flex-1">{h.cmd}</span>
                <span className="text-zinc-500">{h.time}</span>
              </div>
            ))}
            <div className="flex gap-2 animate-pulse">
              <span className="text-green-500">➜</span>
              <span className="w-2 h-4 bg-zinc-500 block" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button className="flex-1 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
             New Terminal
           </button>
           <button className="flex-1 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
             Clear History
           </button>
        </div>
      </div>
    </ModuleCard>
  );
}

export function AuthManager() {
  return (
    <ModuleCard title="Authentication" description="Identity and access" icon={Lock}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
            JD
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">John Doe</div>
            <div className="text-xs text-zinc-500">Pro Plan • john@example.com</div>
          </div>
          <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            <LogOut size={16} />
          </button>
        </div>
        
        <div className="space-y-2">
           <div className="flex items-center justify-between text-sm">
             <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
               <ShieldCheck size={14} /> Two-Factor Auth
             </div>
             <span className="text-green-600 text-xs font-medium">Enabled</span>
           </div>
           <div className="flex items-center justify-between text-sm">
             <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
               <Key size={14} /> API Keys
             </div>
             <span className="text-zinc-500 text-xs">3 Active</span>
           </div>
        </div>
      </div>
    </ModuleCard>
  );
}

export function FileManager() {
  const files = [
    { name: 'api-spec.json', size: '24KB', type: 'json' },
    { name: 'architecture.png', size: '1.2MB', type: 'image' },
    { name: 'README.md', size: '4KB', type: 'markdown' },
  ];

  return (
    <ModuleCard title="File Operations" description="File system & references" icon={FileText}>
      <div className="space-y-3">
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4 flex flex-col items-center justify-center text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
          <UploadCloud size={24} className="mb-2" />
          <span className="text-xs">Drop files here or click to upload</span>
        </div>
        
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded group">
              <div className="flex items-center gap-2">
                <FileCode size={14} className="text-zinc-400" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{f.name}</span>
              </div>
              <span className="text-xs text-zinc-400 group-hover:hidden">{f.size}</span>
              <button className="hidden group-hover:block text-xs text-blue-600 hover:underline">View</button>
            </div>
          ))}
        </div>
      </div>
    </ModuleCard>
  );
}
