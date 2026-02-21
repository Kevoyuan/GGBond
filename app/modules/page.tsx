'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, BarChart3, MessageSquare, Settings, Brain, Palette } from 'lucide-react';
import { AnalyticsDashboard } from '../../components/modules/analytics/AnalyticsDashboard';
import { PerformancePanel } from '../../components/modules/analytics/PerformancePanel';
import { ToolStatsPanel } from '../../components/modules/analytics/ToolStatsPanel';
import { FileHeatmapPanel } from '../../components/modules/analytics/FileHeatmapPanel';
import { SessionTimeline } from '../../components/modules/timeline/SessionTimeline';
import { ChatManager } from '../../components/modules/ChatModules';
import { CheckpointManager } from '../../components/modules/SessionModules';
import { ToolManager, MCPManager, ExtensionManager } from '../../components/modules/SystemModules';
import { MemoryManager, DirectoryManager, HooksManager } from '../../components/modules/ContextModules';
import { SettingsManager, ThemeSelector, ShortcutsPanel, SystemInfo } from '../../components/modules/ConfigModules';
import { ShellManager, AuthManager, FileManager } from '../../components/modules/ActionModules';
import { CustomCommandManager } from '../../components/modules/CommandModules';
import { SkillsManager } from '../../components/modules/SkillsManager';

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

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function ModulesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('analytics');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('modules-active-tab') as TabId;
    if (savedTab && tabs.some(t => t.id === savedTab)) {
      setActiveTab(savedTab);
    }
    setIsLoaded(true);
  }, []);

  // Save tab to localStorage when changed
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    localStorage.setItem('modules-active-tab', tabId);
  };

  // Don't render tabs until we've loaded saved state to prevent flash
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-zinc-900/30 to-black/70 p-3 md:p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-zinc-900/30 to-black/70 p-3 md:p-6">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-7xl flex-col overflow-hidden rounded-2xl border border-zinc-300/30 bg-background shadow-2xl md:h-[calc(100vh-3rem)]">
        {/* Window Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
          <div className="mx-auto px-6 py-3">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
              >
                <ChevronLeft size={12} />
                Back
              </Link>
            </div>
            <div className="mt-3">
              <h1 className="text-2xl font-bold text-foreground">Gemini CLI Modules</h1>
              <p className="text-sm text-muted-foreground mt-1">Click a tab to load modules on demand</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-6">
          <nav className="flex gap-1 -mb-px" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mx-auto w-full flex-1 overflow-y-auto px-6 py-6">
          {/* ─── Tab 1: Monitoring & Analytics ──────────────── */}
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

          {/* ─── Tab 2: Session & Chat ──────────────────────── */}
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

          {/* ─── Tab 3: System Integration ─────────────────── */}
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

          {/* ─── Tab 4: Context & Memory ────────────────────── */}
          {activeTab === 'context' && (
            <section>
              <SectionTitle title="🧠 Context & Memory" description="GEMINI.md, directories, hooks, and project context" />
              <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                <MemoryManager />
                <DirectoryManager />
                <HooksManager />
              </div>
            </section>
          )}

          {/* ─── Tab 5: Configuration ───────────────────────── */}
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
        </div>
      </div>
    </div>
  );
}
