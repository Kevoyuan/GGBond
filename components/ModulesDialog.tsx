'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, BarChart3, MessageSquare, Settings, Brain, Palette, Loader2, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyticsDashboard } from './modules/analytics/AnalyticsDashboard';
import { PerformancePanel } from './modules/analytics/PerformancePanel';
import { ToolStatsPanel } from './modules/analytics/ToolStatsPanel';
import { FileHeatmapPanel } from './modules/analytics/FileHeatmapPanel';
import { SessionTimeline } from './modules/timeline/SessionTimeline';
import { ProjectContext } from './modules/project/ProjectContext';
import { ChatManager } from './modules/ChatModules';
import { CheckpointManager } from './modules/SessionModules';
import { ToolManager, MCPManager, ExtensionManager } from './modules/SystemModules';
import { MemoryManager, DirectoryManager, HooksManager } from './modules/ContextModules';
import { SettingsManager, ThemeSelector, ShortcutsPanel, SystemInfo } from './modules/ConfigModules';
import { ShellManager, AuthManager, FileManager } from './modules/ActionModules';
import { CustomCommandManager } from './modules/CommandModules';
import { SkillsManager } from './modules/SkillsManager';

type TabId = 'analytics' | 'sessions' | 'system' | 'context' | 'config';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
  { id: 'sessions', label: 'Sessions', icon: <MessageSquare size={16} /> },
  { id: 'system', label: 'System', icon: <Settings size={16} /> },
  { id: 'context', label: 'Context', icon: <Brain size={16} /> },
  { id: 'config', label: 'Config', icon: <Palette size={16} /> },
];

interface ModulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ModulesDialog({ open, onOpenChange }: ModulesDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('analytics');
  const [isLoaded, setIsLoaded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Load saved tab from localStorage on mount
  useEffect(() => {
    if (!open) return;
    const savedTab = localStorage.getItem('modules-active-tab') as TabId;
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTab(savedTab);
    }
    setIsLoaded(true);
  }, [open]);

  // Save tab to localStorage when changed
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    localStorage.setItem('modules-active-tab', tabId);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  if (!open) return null;
  if (!portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="w-full max-w-6xl max-h-[90vh] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <LayoutGrid className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-semibold text-xl">Gemini CLI Modules</h2>
              <p className="text-xs text-muted-foreground">Click a tab to load modules on demand</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b bg-white/50 dark:bg-zinc-900/50 px-4 shrink-0">
          <nav className="flex gap-1 -mb-px" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Tab 1: Monitoring & Analytics */}
              {activeTab === 'analytics' && (
                <section>
                  <SectionTitle title="📊 Monitoring & Analytics" description="Token usage, cost tracking, and performance telemetry" />
                  <div className="grid lg:grid-cols-2 gap-4">
                    <AnalyticsDashboard />
                    <PerformancePanel />
                  </div>
                  <div className="grid lg:grid-cols-2 gap-4 mt-4">
                    <ToolStatsPanel />
                    <FileHeatmapPanel />
                  </div>
                </section>
              )}

              {/* Tab 2: Session & Chat */}
              {activeTab === 'sessions' && (
                <section>
                  <SectionTitle title="💬 Sessions & Chat" description="Session history and checkpointing" />
                  <div className="grid lg:grid-cols-2 gap-4">
                    <ChatManager />
                    <SessionTimeline />
                    <CheckpointManager />
                  </div>
                </section>
              )}

              {/* Tab 3: System Integration */}
              {activeTab === 'system' && (
                <section>
                  <SectionTitle title="⚙️ System Integration" description="MCP servers, tools, extensions, and skills" />
                  <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    <MCPManager />
                    <ToolManager />
                    <ExtensionManager />
                    <CustomCommandManager />
                    <SkillsManager />
                    <ShellManager />
                    <AuthManager />
                  </div>
                </section>
              )}

              {/* Tab 4: Context & Memory */}
              {activeTab === 'context' && (
                <section>
                  <SectionTitle title="🧠 Context & Memory" description="GEMINI.md, directories, hooks, and project context" />
                  <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    <MemoryManager />
                    <DirectoryManager />
                    <HooksManager />
                    <ProjectContext />
                  </div>
                </section>
              )}

              {/* Tab 5: Configuration */}
              {activeTab === 'config' && (
                <section>
                  <SectionTitle title="🎨 Configuration" description="Model selection, theme, shortcuts, and system info" />
                  <div className="grid lg:grid-cols-2 xl:grid-cols-5 gap-4">
                    <SettingsManager />
                    <ThemeSelector />
                    <ShortcutsPanel />
                    <SystemInfo />
                    <FileManager />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
