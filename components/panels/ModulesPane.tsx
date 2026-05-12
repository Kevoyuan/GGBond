'use client';

import React, { useState, Suspense, lazy, memo } from 'react';
import {
  LayoutGrid,
  Loader2,
  MessageSquare,
  Settings,
  Shield,
  Globe,
  Palette,
  Layers,
  Cpu,
  GitBranch,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy load heavy components
const ChatManager = lazy(() => import('@/components/modules/ChatModules').then(m => ({ default: m.ChatManager })));
const CheckpointManager = lazy(() => import('@/components/modules/SessionModules').then(m => ({ default: m.CheckpointManager })));
const SessionTimeline = lazy(() => import('@/components/modules/timeline/SessionTimeline').then(m => ({ default: m.SessionTimeline })));
const ToolManager = lazy(() => import('@/components/modules/SystemModules').then(m => ({ default: m.ToolManager })));
const CustomCommandManager = lazy(() => import('@/components/modules/CommandModules').then(m => ({ default: m.CustomCommandManager })));
const ShellManager = lazy(() => import('@/components/modules/ActionModules').then(m => ({ default: m.ShellManager })));
const AuthManager = lazy(() => import('@/components/modules/ActionModules').then(m => ({ default: m.AuthManager })));
const PolicyHealthPanel = lazy(() => import('@/components/modules/governance/PolicyHealthPanel').then(m => ({ default: m.PolicyHealthPanel })));
const ModelSteeringPanel = lazy(() => import('@/components/modules/governance/ModelSteeringPanel').then(m => ({ default: m.ModelSteeringPanel })));
const ExecutionGuardrailsPanel = lazy(() => import('@/components/modules/governance/ExecutionGuardrailsPanel').then(m => ({ default: m.ExecutionGuardrailsPanel })));
const BrowserRuntimePanel = lazy(() => import('@/components/modules/browser/BrowserRuntimePanel').then(m => ({ default: m.BrowserRuntimePanel })));
const BrowserSessionTrace = lazy(() => import('@/components/modules/browser/BrowserSessionTrace').then(m => ({ default: m.BrowserSessionTrace })));
const ContextPersistencePanel = lazy(() => import('@/components/modules/browser/ContextPersistencePanel').then(m => ({ default: m.ContextPersistencePanel })));
const SettingsManager = lazy(() => import('@/components/modules/ConfigModules').then(m => ({ default: m.SettingsManager })));
const ThemeSelector = lazy(() => import('@/components/modules/ConfigModules').then(m => ({ default: m.ThemeSelector })));
const ShortcutsPanel = lazy(() => import('@/components/modules/ConfigModules').then(m => ({ default: m.ShortcutsPanel })));
const SystemInfo = lazy(() => import('@/components/modules/ConfigModules').then(m => ({ default: m.SystemInfo })));
const FileManager = lazy(() => import('@/components/modules/ActionModules').then(m => ({ default: m.FileManager })));

const ModuleLoader = memo(function ModuleLoader() {
  return (
    <div className="flex items-center justify-center py-12 border border-dashed rounded-lg bg-muted/5">
      <Loader2 size={20} className="animate-spin text-primary/40" />
    </div>
  );
});

type TabId = 'sessions' | 'system' | 'governance' | 'browser' | 'config';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const tabs: Tab[] = [
  { id: 'sessions', label: 'Sessions', icon: MessageSquare, description: 'Chat history and checkpoints' },
  { id: 'system', label: 'System', icon: Settings, description: 'MCP, tools and extensions' },
  { id: 'governance', label: 'Governance', icon: Shield, description: 'Policy and model steering' },
  { id: 'browser', label: 'Browser', icon: Globe, description: 'Browser agent status' },
  { id: 'config', label: 'Config', icon: Palette, description: 'Settings and info' },
];

interface ModulesPaneProps {
  workspacePath?: string | null;
  currentSessionId?: string | null;
}

export const ModulesPane = memo(function ModulesPane({ workspacePath, currentSessionId }: ModulesPaneProps) {
  const [activeTab, setActiveTab] = useState<TabId>('sessions');

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/40 shrink-0 bg-gradient-to-b from-muted/[0.03] to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-subtle)]">
            <LayoutGrid className="h-3 w-3 text-[var(--accent)]" />
          </div>
          Workbench Modules
        </div>
        <div className="relative group">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TabId)}
            className="appearance-none bg-background border border-border/50 rounded-md pl-2.5 pr-7 py-1 text-[11px] font-medium cursor-pointer hover:bg-muted/50 transition-colors outline-none focus:ring-1 focus:ring-[var(--accent)] text-muted-foreground"
          >
            {tabs.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/60 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        <Suspense fallback={<ModuleLoader />}>
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <ChatManager />
              <SessionTimeline />
              <CheckpointManager />
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              <ToolManager />
              <CustomCommandManager />
              <ShellManager />
              <AuthManager />
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="space-y-6">
              <PolicyHealthPanel workspacePath={workspacePath || undefined} />
              <ModelSteeringPanel workspacePath={workspacePath || undefined} />
              <ExecutionGuardrailsPanel workspacePath={workspacePath || undefined} />
            </div>
          )}

          {activeTab === 'browser' && (
            <div className="space-y-6">
              <BrowserRuntimePanel />
              <BrowserSessionTrace />
              <ContextPersistencePanel />
            </div>
          )}

          {activeTab === 'config' && (
            <div className="grid gap-6">
              <SettingsManager />
              <ThemeSelector />
              <ShortcutsPanel />
              <SystemInfo />
              <FileManager workspacePath={workspacePath || undefined} />
            </div>
          )}
        </Suspense>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-muted/10 text-[10px] text-muted-foreground italic shrink-0">
        {tabs.find(t => t.id === activeTab)?.description}
      </div>
    </div>
  );
});
