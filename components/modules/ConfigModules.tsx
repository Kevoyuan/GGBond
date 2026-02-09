import React, { useState, useEffect } from 'react';
import { ModuleCard } from './ModuleCard';
import { Settings, Palette, Command, Info, ToggleLeft, ToggleRight, User } from 'lucide-react';
import { fetchSettings, updateSettings } from '@/lib/api/gemini';

export function AuthManager() {
  // Static for now as auth is not fully exposed in CLI API
  return (
    <ModuleCard title="Authentication" description="User & API Keys" icon={User}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
            G
          </div>
          <div>
            <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Gemini User</div>
            <div className="text-xs text-zinc-500">Local Environment</div>
          </div>
        </div>
        <div className="space-y-2">
           <div className="flex justify-between items-center text-sm">
             <span className="text-zinc-500">API Key</span>
             <span className="font-mono text-xs">Set in Environment</span>
           </div>
           <button className="w-full py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
             Manage Keys
           </button>
        </div>
      </div>
    </ModuleCard>
  );
}

export function SettingsManager() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSetting = async (path: string[], value: boolean) => {
    if (!settings) return;
    
    // Deep clone to avoid mutation
    const newSettings = JSON.parse(JSON.stringify(settings));
    
    // Navigate and set value
    let current = newSettings;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;

    setSettings(newSettings);
    try {
      await updateSettings(newSettings);
    } catch (err) {
      console.error('Failed to update settings', err);
      // Revert on error? For now just log.
    }
  };

  if (loading) return <ModuleCard title="General Settings" description="Loading..." icon={Settings}><div className="h-20" /></ModuleCard>;

  const showMemoryUsage = settings?.ui?.showMemoryUsage ?? true;
  const hideModelInfo = settings?.ui?.footer?.hideModelInfo ?? false;
  const hideContextPercentage = settings?.ui?.footer?.hideContextPercentage ?? false;

  return (
    <ModuleCard title="General Settings" description="Global configuration" icon={Settings}>
      <div className="space-y-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSetting(['ui', 'showMemoryUsage'], !showMemoryUsage)}>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Show Memory Usage</span>
          {showMemoryUsage ? <ToggleRight className="text-blue-500" size={24} /> : <ToggleLeft className="text-zinc-300 dark:text-zinc-600" size={24} />}
        </div>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSetting(['ui', 'footer', 'hideModelInfo'], !hideModelInfo)}>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Hide Model Info</span>
          {hideModelInfo ? <ToggleRight className="text-blue-500" size={24} /> : <ToggleLeft className="text-zinc-300 dark:text-zinc-600" size={24} />}
        </div>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSetting(['ui', 'footer', 'hideContextPercentage'], !hideContextPercentage)}>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Hide Context %</span>
          {hideContextPercentage ? <ToggleRight className="text-blue-500" size={24} /> : <ToggleLeft className="text-zinc-300 dark:text-zinc-600" size={24} />}
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
