'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Settings, Palette, Command, Info, Loader2, Cpu, Tag, ChevronRight, Check, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Module 4: Model Selector ────────────────────────────
// ─── Module 4: Model Selector ────────────────────────────
interface ModelInfo {
  id: string;
  name: string;
  tier: string;
  contextWindow: string;
}

export const SettingsManager = memo(function SettingsManager() {
  const [currentModel, setCurrentModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [customAliases, setCustomAliases] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then(data => {
        setCurrentModel(data.current || '');
        setModels(data.known || []);
        setCustomAliases(data.customAliases || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSwitch = async (modelId: string) => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: { name: modelId } }),
      });
      setCurrentModel(modelId);
    } catch (err) { console.error('Failed to switch model:', err); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <ModuleCard title="Model Selector" description="Switch Gemini models" icon={Cpu}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="Model Selector" description={currentModel || 'Default'} icon={Cpu}>
      <div className="space-y-2">
        {models.map(model => {
          const isCurrent = currentModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => handleSwitch(model.id)}
              disabled={saving}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all duration-200 group relative overflow-hidden",
                isCurrent
                  ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 shadow-sm"
                  : "bg-white dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              )}
            >
              {isCurrent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border",
                    isCurrent
                      ? "bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-900/40 dark:border-blue-700/50 dark:text-blue-400"
                      : "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                  )}>
                    <Cpu size={16} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className={cn("font-bold text-sm", isCurrent ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300")}>{model.name}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{model.contextWindow} context</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border",
                    model.tier === 'pro'
                      ? "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/40"
                      : model.tier === 'flash'
                        ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/40"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                  )}>
                    {model.tier}
                  </span>
                  {isCurrent && <CheckCircle size={16} className="text-blue-500" />}
                </div>
              </div>
            </button>
          );
        })}

        {Object.keys(customAliases).length > 0 && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 mt-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5"><Tag size={10} /> Custom Aliases</h4>
            <div className="space-y-1">
              {Object.entries(customAliases).map(([alias, config]) => (
                <div key={alias} className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/50">
                  <span className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{alias}</span>
                  <span className="text-[10px] text-zinc-400 truncate max-w-[150px]">{typeof config === 'string' ? config : JSON.stringify(config)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModuleCard>
  );
});

// ─── Module 10: Custom Commands Editor ───────────────────
// ─── Module 10: Custom Commands Editor ───────────────────
export const ThemeSelector = memo(function ThemeSelector() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Theme & UI" description="Appearance settings" icon={Palette}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  const theme = settings?.ui?.theme || 'Default';
  const footer = settings?.ui?.footer || {};
  const general = settings?.general || {};

  return (
    <ModuleCard title="Theme & UI" description={`Theme: ${theme}`} icon={Palette}>
      <div className="space-y-3">
        <div className="p-3 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-zinc-900/10 rounded-lg border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Palette size={16} />
            </div>
            <div>
              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Current Theme</div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{theme}</div>
            </div>
          </div>
          <ChevronRight size={14} className="text-purple-300 dark:text-purple-700" />
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">General</h4>
          <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">Editor Preference</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-200 bg-white dark:bg-black/40 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">{general.preferredEditor || 'Default'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-600 dark:text-zinc-400">Preview Features</span>
              <span className={cn("font-medium", general.previewFeatures ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400")}>
                {general.previewFeatures ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 pl-1">Footer Elements</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Model Info</span>
              <div className={cn("w-2 h-2 rounded-full", !footer.hideModelInfo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700")} />
            </div>
            <div className="flex items-center justify-between p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">Context %</span>
              <div className={cn("w-2 h-2 rounded-full", !footer.hideContextPercentage ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700")} />
            </div>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
});

// ─── Module 15: Shortcuts / Keyboard Bindings ────────────
// ─── Module 15: Shortcuts / Keyboard Bindings ────────────
export const ShortcutsPanel = memo(function ShortcutsPanel() {
  const shortcuts = [
    { key: '/', desc: 'Slash commands' },
    { key: '@', desc: 'Reference files' },
    { key: '!', desc: 'Shell commands' },
    { key: 'Enter', desc: 'Send message (non-interactive)' },
    { key: 'Ctrl+C', desc: 'Cancel' },
    { key: 'Ctrl+D', desc: 'Exit' },
  ];

  return (
    <ModuleCard title="Shortcuts" description="Keyboard bindings" icon={Command}>
      <div className="grid grid-cols-1 gap-1">
        {shortcuts.map(s => (
          <div key={s.key} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">{s.desc}</span>
            <kbd className="px-2 py-1 text-[10px] font-bold font-mono bg-zinc-100 dark:bg-zinc-800 border-b-2 border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-300 min-w-[24px] text-center shadow-sm">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
});

// ─── Module 15: System Info ──────────────────────────────
// ─── Module 15: System Info ──────────────────────────────
export const SystemInfo = memo(function SystemInfo() {
  const [settings, setSettings] = useState<any>(null);
  const [storageDebug, setStorageDebug] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/debug/storage').then((r) => r.json()),
    ])
      .then(([settingsData, storageData]) => {
        setSettings(settingsData);
        setStorageDebug(storageData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="System Info" description="Environment" icon={Info}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  const items = [
    { label: 'Auth Type', value: settings?.selectedAuthType || settings?.security?.auth?.selectedType || 'Unknown', mono: true },
    { label: 'IDE Integration', value: settings?.ide?.enabled ? 'Enabled' : 'Disabled', status: settings?.ide?.enabled },
    { label: 'MCP Servers', value: Object.keys(settings?.mcpServers || {}).length, mono: true },
    { label: 'Disabled Skills', value: settings?.skills?.disabled?.length || 0, mono: true },
  ];

  return (
    <ModuleCard title="System Info" description="Environment & Config" icon={Info}>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.label} className="flex justify-between items-center p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</span>
            <span className={cn(
              "text-xs",
              item.mono && "font-mono",
              item.status === true ? "text-emerald-600 dark:text-emerald-400 font-medium" :
                item.status === false ? "text-zinc-400" :
                  "text-zinc-800 dark:text-zinc-200"
            )}>
              {item.value}
            </span>
          </div>
        ))}

        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-1">
            Storage Debug
          </div>

          <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="text-[10px] text-zinc-500 mb-1">DB Path</div>
            <div className="text-[11px] font-mono break-all text-zinc-800 dark:text-zinc-200">
              {storageDebug?.db?.dbPath || 'N/A'}
            </div>
          </div>

          <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="text-[10px] text-zinc-500 mb-1">Runtime Home</div>
            <div className="text-[11px] font-mono break-all text-zinc-800 dark:text-zinc-200">
              {storageDebug?.runtimeHome || 'N/A'}
            </div>
          </div>

          <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="text-[10px] text-zinc-500 mb-1">GEMINI_CLI_HOME</div>
            <div className="text-[11px] font-mono break-all text-zinc-800 dark:text-zinc-200">
              {storageDebug?.env?.GEMINI_CLI_HOME || 'N/A'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 text-center">
              <div className="text-[10px] text-zinc-500">Total</div>
              <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200">{storageDebug?.db?.totalSessions ?? '-'}</div>
            </div>
            <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 text-center">
              <div className="text-[10px] text-zinc-500">Active</div>
              <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200">{storageDebug?.db?.activeSessions ?? '-'}</div>
            </div>
            <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 text-center">
              <div className="text-[10px] text-zinc-500">Archived</div>
              <div className="text-xs font-mono text-zinc-800 dark:text-zinc-200">{storageDebug?.db?.archivedSessions ?? '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
});
