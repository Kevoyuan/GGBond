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
        const modelVal = data.current;
        setCurrentModel(typeof modelVal === 'object' && modelVal !== null ? (modelVal as any).name : (modelVal || ''));
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
    <ModuleCard title="Model Selector" description={currentModel || 'Default'} icon={Cpu} className="h-[30rem] flex flex-col">
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {models.map(model => {
          const isCurrent = currentModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => handleSwitch(model.id)}
              disabled={saving}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all duration-300 group relative overflow-hidden",
                isCurrent
                  ? "bg-blue-500/5 border-blue-500/30 dark:bg-blue-500/10 dark:border-blue-500/40 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "bg-white/50 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border transition-colors",
                    isCurrent
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                  )}>
                    <Cpu size={16} />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className={cn(
                      "font-bold text-sm truncate max-w-[180px]",
                      isCurrent ? "text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300"
                    )}>
                      {model.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-tight">{model.contextWindow} context</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest rounded-sm border",
                    model.tier === 'pro'
                      ? "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400"
                      : model.tier === 'flash'
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                  )}>
                    {model.tier}
                  </span>
                  {isCurrent && <CheckCircle size={14} className="text-blue-500 animate-in zoom-in duration-300" />}
                </div>
              </div>
            </button>
          );
        })}

        {Object.keys(customAliases).length > 0 && (
          <div className="pt-4 mt-2 space-y-3">
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500 px-1 flex items-center gap-1.5">
              <Tag size={10} strokeWidth={2.5} /> Custom Aliases
            </h4>
            <div className="space-y-1.5">
              {Object.entries(customAliases).map(([alias, config]) => (
                <div key={alias} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/30 dark:border-zinc-800/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <span className="font-mono text-xs font-bold text-blue-600/80 dark:text-blue-400/80">{alias}</span>
                  <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[140px] opacity-70">
                    {typeof config === 'string' ? config : 'complex_cfg'}
                  </span>
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
    <ModuleCard title="Theme & UI" description={`Theme: ${theme}`} icon={Palette} className="h-[30rem] flex flex-col">
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-5 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        <div className="p-4 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent dark:from-purple-500/20 dark:to-zinc-900/10 rounded-xl border border-purple-500/20 dark:border-purple-500/30 flex items-center justify-between shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Palette size={20} />
            </div>
            <div>
              <div className="text-[10px] text-purple-600/70 dark:text-purple-400/70 font-bold uppercase tracking-wider">Active Workspace Identity</div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{theme}</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-purple-300 dark:text-purple-700" />
        </div>

        <div className="space-y-2.5">
          <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 pl-1">Operational Logic</h4>
          <div className="p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-medium tracking-tight">Preferred Binary</span>
              <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/20 shadow-sm">{general.preferredEditor || 'cli-default'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-medium tracking-tight">Preview Features</span>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", general.previewFeatures ? "text-emerald-500" : "text-zinc-400/60")}>
                  {general.previewFeatures ? 'Active' : 'Locked'}
                </span>
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", general.previewFeatures ? "bg-emerald-500 shadow-emerald-500/50" : "bg-zinc-300 dark:bg-zinc-700")} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 pl-1">Instrumental Hud</h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500 font-bold tracking-tight uppercase">Base Meta</span>
                <span className="text-[9px] text-zinc-400/60 font-medium">Model Info</span>
              </div>
              <div className={cn("w-2 h-2 rounded-full", !footer.hideModelInfo ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-300 dark:bg-zinc-800")} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500 font-bold tracking-tight uppercase">Pressure</span>
                <span className="text-[9px] text-zinc-400/60 font-medium">Context %</span>
              </div>
              <div className={cn("w-2 h-2 rounded-full", !footer.hideContextPercentage ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-zinc-300 dark:bg-zinc-800")} />
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
    <ModuleCard title="Shortcuts" description="System Bindings" icon={Command} className="h-[30rem] flex flex-col">
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {shortcuts.map(s => (
          <div key={s.key} className="flex items-center justify-between py-1.5 px-3 rounded-xl hover:bg-zinc-500/5 transition-all duration-300 group border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors tracking-tight">
              {s.desc}
            </span>
            <kbd className="px-2.5 py-1 text-[10px] font-bold font-mono bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 border-b-2 border-b-zinc-300 dark:border-b-zinc-700 rounded-lg text-blue-600 dark:text-blue-400 min-w-[32px] text-center shadow-sm">
              {s.key}
            </kbd>
          </div>
        ))}

        <div className="mt-3 p-3 rounded-xl border border-blue-500/10 bg-blue-500/5 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest px-0.5">
            <Info size={12} /> Pro Tip
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
            Use <kbd className="text-[9px] px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border-b border-zinc-300 dark:border-zinc-600">Option + Space</kbd> to toggle the Modules Control Panel from anywhere.
          </p>
        </div>
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
    <ModuleCard title="System Info" description="Environment & Paths" icon={Info} className="h-[30rem] flex flex-col">
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((item, i) => (
            <div key={item.label} className="p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="text-[9px] text-zinc-500 dark:text-zinc-500 uppercase font-bold tracking-widest mb-1.5 px-0.5">{item.label}</div>
              <div className={cn(
                "text-xs font-bold truncate",
                item.mono && "font-mono",
                item.status === true ? "text-emerald-500" :
                  item.status === false ? "text-zinc-400" :
                    "text-zinc-800 dark:text-zinc-200"
              )}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 px-1">Internal Registry Debug</h4>

          {[
            { label: 'DB Cluster', value: storageDebug?.db?.dbPath, type: 'primary' },
            { label: 'Runtime Hub', value: storageDebug?.runtimeHome, type: 'secondary' },
            { label: 'Gemini Home', value: storageDebug?.env?.GEMINI_CLI_HOME, type: 'secondary' }
          ].map(path => (
            <div key={path.label} className="group relative p-2 rounded-xl border border-blue-500/5 dark:border-zinc-800/50 bg-blue-500/[0.03] dark:bg-zinc-950/30 shadow-inner">
              <div className="text-[8px] text-zinc-500/70 dark:text-zinc-500 uppercase font-bold tracking-widest mb-0.5">{path.label}</div>
              <div className="text-[10px] font-mono break-all text-blue-600/60 dark:text-blue-400/70 leading-relaxed transition-opacity group-hover:opacity-100">
                {path.value || 'NOT_DEFINED'}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2 pt-0.5">
            <div className="p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Total</div>
              <div className="text-sm font-mono font-bold text-zinc-900 dark:text-white">{storageDebug?.db?.totalSessions ?? '--'}</div>
            </div>
            <div className="p-2 rounded-xl border border-emerald-500/10 dark:border-emerald-500/20 bg-emerald-500/5 text-center">
              <div className="text-[8px] text-emerald-600 dark:text-emerald-500 uppercase font-bold tracking-widest mb-0.5">Active</div>
              <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{storageDebug?.db?.activeSessions ?? '--'}</div>
            </div>
            <div className="p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/30 text-center opacity-50">
              <div className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Archived</div>
              <div className="text-sm font-mono font-bold text-zinc-500">{storageDebug?.db?.archivedSessions ?? '--'}</div>
            </div>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
});
