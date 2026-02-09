import React from 'react';
import { ModuleCard } from './ModuleCard';
import { Settings, Palette, Command, Info, ToggleLeft, ToggleRight, User, Brain, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { mockContext } from '@/lib/api/gemini-mock';

export function AuthManager() {
  return (
    <ModuleCard title="Authentication" description="User & API Keys" icon={User}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
            JD
          </div>
          <div>
            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">John Doe</div>
            <div className="text-xs text-zinc-500">Pro Plan • Active</div>
          </div>
        </div>
        <div className="space-y-2">
           <div className="flex justify-between items-center text-sm">
             <span className="text-zinc-500">API Key</span>
             <span className="font-mono text-xs">sk_...8d9a</span>
           </div>
           <button className="w-full py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
             Rotate Key
           </button>
        </div>
      </div>
    </ModuleCard>
  );
}

export function MemoryManager() {
  return (
    <ModuleCard title="Memory & Storage" description="Vector DB & Cache" icon={Brain}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
             <span>Vector Index</span>
             <span>84%</span>
          </div>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 w-[84%]" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
             <span>Cache Usage</span>
             <span>230MB / 1GB</span>
          </div>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[23%]" />
          </div>
        </div>
        <div className="flex gap-2 mt-2">
           <button className="flex-1 py-1.5 text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded hover:opacity-90">
             Optimize
           </button>
           <button className="flex-1 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
             Purge
           </button>
        </div>
      </div>
    </ModuleCard>
  );
}

export function DirectoryManager() {
  const dirs = mockContext.includedDirectories;
  
  return (
    <ModuleCard title="Included Directories" description="Context sources" icon={FolderOpen}>
      <div className="space-y-2">
        {dirs.map((dir, i) => (
          <div key={i} className="flex items-center justify-between p-2 text-sm border border-zinc-100 dark:border-zinc-800 rounded group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[180px]" title={dir}>
              {dir}
            </span>
            <button className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-2">
          <Plus size={14} /> Add Directory
        </button>
      </div>
    </ModuleCard>
  );
}

export function SettingsManager() {
  return (
    <ModuleCard title="General Settings" description="Global configuration" icon={Settings}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Auto-save sessions</span>
          <ToggleRight className="text-blue-500" size={24} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Stream responses</span>
          <ToggleRight className="text-blue-500" size={24} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notifications</span>
          <ToggleLeft className="text-zinc-300 dark:text-zinc-600" size={24} />
        </div>
      </div>
    </ModuleCard>
  );
}

export function ThemeSelector() {
  const themes = ['System', 'Light', 'Dark', 'Midnight', 'Forest'];
  
  return (
    <ModuleCard title="Theme & Appearance" description="UI customization" icon={Palette}>
      <div className="grid grid-cols-3 gap-2">
        {themes.map(t => (
          <button key={t} className="p-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {t}
          </button>
        ))}
      </div>
    </ModuleCard>
  );
}


export function ShortcutsPanel() {
  const shortcuts = [
    { key: '⌘ + K', desc: 'Command Palette' },
    { key: '⌘ + /', desc: 'Toggle Sidebar' },
    { key: '⌘ + Enter', desc: 'Send Message' },
    { key: 'Esc', desc: 'Cancel / Close' },
  ];

  return (
    <ModuleCard title="Shortcuts" description="Keyboard bindings" icon={Command}>
      <div className="space-y-2">
        {shortcuts.map(s => (
          <div key={s.key} className="flex justify-between items-center text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{s.desc}</span>
            <kbd className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-xs font-mono text-zinc-500 dark:text-zinc-400">{s.key}</kbd>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

export function SystemInfo() {
  return (
    <ModuleCard title="System Info" description="Version and policies" icon={Info}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-zinc-500">CLI Version</div>
          <div className="text-right font-mono">v1.2.0</div>
          <div className="text-zinc-500">UI Version</div>
          <div className="text-right font-mono">v1.0.0</div>
          <div className="text-zinc-500">Environment</div>
          <div className="text-right text-green-600">Production</div>
        </div>
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="font-medium mb-2 text-zinc-900 dark:text-zinc-100">Active Policies</div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs rounded-full">Safe Mode</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded-full">Audit Log</span>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
