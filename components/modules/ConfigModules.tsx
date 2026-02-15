'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Settings, Palette, Command, Info, Loader2, Cpu, Tag, ChevronRight, Check, RefreshCw } from 'lucide-react';

// ─── Module 4: Model Selector ────────────────────────────
interface ModelInfo {
  id: string;
  name: string;
  tier: string;
  contextWindow: string;
}

export function SettingsManager() {
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
              className={`w-full text-left p-3 rounded-lg border transition-all ${isCurrent
                  ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30'
                  : 'bg-card border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className={isCurrent ? 'text-blue-500' : 'text-muted-foreground'} />
                  <span className={`font-medium text-sm ${isCurrent ? 'text-blue-700 dark:text-blue-300' : ''}`}>{model.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full border ${model.tier === 'pro'
                      ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/40'
                      : model.tier === 'flash'
                        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/40'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                    }`}>
                    {model.tier}
                  </span>
                  <span className="text-xs text-muted-foreground">{model.contextWindow}</span>
                  {isCurrent && <Check size={14} className="text-blue-500" />}
                </div>
              </div>
            </button>
          );
        })}

        {Object.keys(customAliases).length > 0 && (
          <div className="pt-3 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Tag size={12} /> Custom Aliases</h4>
            {Object.entries(customAliases).map(([alias, config]) => (
              <div key={alias} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-foreground">{alias}</span>
                <span className="text-xs text-muted-foreground">{typeof config === 'string' ? config : JSON.stringify(config)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}

// ─── Module 10: Custom Commands Editor ───────────────────
export function ThemeSelector() {
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
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <Palette size={14} className="text-purple-500" />
            <span className="text-sm font-medium">Current Theme</span>
          </div>
          <span className="text-lg font-bold text-foreground">{theme}</span>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">General</h4>
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-muted-foreground">Editor</span>
            <span className="font-mono text-foreground">{general.preferredEditor || 'Default'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-muted-foreground">Preview Features</span>
            <span className={general.previewFeatures ? 'text-green-500' : 'text-muted-foreground'}>
              {general.previewFeatures ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-xs font-semibold text-muted-foreground">Footer Display</h4>
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-muted-foreground">Model Info</span>
            <span className={!footer.hideModelInfo ? 'text-green-500' : 'text-muted-foreground'}>
              {!footer.hideModelInfo ? 'Visible' : 'Hidden'}
            </span>
          </div>
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-muted-foreground">Context %</span>
            <span className={!footer.hideContextPercentage ? 'text-green-500' : 'text-muted-foreground'}>
              {!footer.hideContextPercentage ? 'Visible' : 'Hidden'}
            </span>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}

// ─── Module 15: Shortcuts / Keyboard Bindings ────────────
export function ShortcutsPanel() {
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
      <div className="space-y-1.5">
        {shortcuts.map(s => (
          <div key={s.key} className="flex items-center justify-between py-2 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <span className="text-sm text-muted-foreground">{s.desc}</span>
            <kbd className="px-2 py-0.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-foreground">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

// ─── Module 15: System Info ──────────────────────────────
export function SystemInfo() {
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
      <ModuleCard title="System Info" description="Environment" icon={Info}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="System Info" description="Environment & Config" icon={Info}>
      <div className="space-y-2">
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-muted-foreground">Auth Type</span>
          <span className="font-mono text-foreground text-xs">{settings?.selectedAuthType || settings?.security?.auth?.selectedType || 'Unknown'}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-muted-foreground">IDE Integration</span>
          <span className={settings?.ide?.enabled ? 'text-green-500 text-xs' : 'text-muted-foreground text-xs'}>
            {settings?.ide?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-muted-foreground">MCP Servers</span>
          <span className="font-mono text-foreground text-xs">{Object.keys(settings?.mcpServers || {}).length}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-muted-foreground">Disabled Skills</span>
          <span className="font-mono text-foreground text-xs">{settings?.skills?.disabled?.length || 0}</span>
        </div>
      </div>
    </ModuleCard>
  );
}
