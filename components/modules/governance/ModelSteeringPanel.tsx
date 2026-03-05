'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from '../ModuleCard';
import { Cpu, RefreshCw, Loader2, AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelItem {
  id: string;
  name: string;
}

interface SteeringView {
  workspacePath: string;
  activeModel: string;
  activeProfile: string;
  workspaceOverrides: {
    hasModelOverride: boolean;
    hasProfileOverride: boolean;
    model: string | null;
    profile: string | null;
  };
  knownModels: ModelItem[];
  availableProfiles: string[];
}

const PROFILE_COLORS: Record<string, string> = {
  default: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  autoEdit: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  plan: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  yolo: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
};

interface ModelSteeringPanelProps {
  workspacePath?: string | null;
}

export const ModelSteeringPanel = memo(function ModelSteeringPanel({ workspacePath }: ModelSteeringPanelProps) {
  const [data, setData] = useState<SteeringView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('default');

  const query = workspacePath?.trim()
    ? `?workspacePath=${encodeURIComponent(workspacePath.trim())}`
    : '';

  const fetchData = () => {
    setLoading(true);
    setError(false);
    fetch(`/api/governance/steering${query}`)
      .then((r) => r.json())
      .then((payload: SteeringView) => {
        setData(payload);
        setSelectedModel(payload.workspaceOverrides.model || payload.activeModel);
        setSelectedProfile(payload.workspaceOverrides.profile || payload.activeProfile || 'default');
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [workspacePath]);

  const saveWorkspaceSteering = async () => {
    if (!selectedModel || !selectedProfile) return;
    setSaving(true);
    try {
      await fetch('/api/governance/steering', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath,
          model: selectedModel,
          profile: selectedProfile,
        }),
      });
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const resetWorkspaceSteering = async () => {
    setSaving(true);
    try {
      await fetch('/api/governance/steering', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspacePath,
          reset: true,
        }),
      });
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ModuleCard title="Model Steering" description="Workspace routing" icon={Cpu} className="h-[30rem] flex flex-col">
        <div className="flex items-center justify-center flex-1"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  if (error || !data) {
    return (
      <ModuleCard title="Model Steering" description="Workspace routing" icon={Cpu} className="h-[30rem] flex flex-col">
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <AlertTriangle size={20} className="text-amber-500" />
          <p className="text-xs text-zinc-500">Fetch failed</p>
          <button onClick={fetchData} className="text-[10px] text-blue-600 hover:underline">Retry</button>
        </div>
      </ModuleCard>
    );
  }

  const profileColor = PROFILE_COLORS[data.activeProfile] ?? PROFILE_COLORS.default;
  const hasWorkspaceOverride = data.workspaceOverrides.hasModelOverride || data.workspaceOverrides.hasProfileOverride;

  return (
    <ModuleCard
      title="Model Steering"
      description={`${data.activeModel} · ${data.activeProfile}`}
      icon={Cpu}
      className="h-[30rem] flex flex-col"
      actions={
        <button onClick={fetchData} className="p-1 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={13} />
        </button>
      }
    >
      <div className="flex-1 min-h-[0] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 space-y-4">
        <div className="p-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Profile</span>
            <span className={cn('text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border', profileColor)}>
              {data.activeProfile.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">Workspace scope</span>
            <span className={cn('font-mono', hasWorkspaceOverride ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500')}>
              {hasWorkspaceOverride ? 'workspace override' : 'inherits global'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 truncate font-mono" title={data.workspacePath}>
            {data.workspacePath}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace Model</span>
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="w-full bg-background text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {data.knownModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Workspace Profile</span>
            <select
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value)}
              className="w-full bg-background text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {data.availableProfiles.map((profile) => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={saveWorkspaceSteering}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Workspace Override
          </button>
          <button
            onClick={resetWorkspaceSteering}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>
    </ModuleCard>
  );
});
