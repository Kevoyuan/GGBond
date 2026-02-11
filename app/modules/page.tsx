'use client';

import React from 'react';
import { AnalyticsDashboard } from '@/components/modules/analytics/AnalyticsDashboard';
import { PerformancePanel } from '@/components/modules/analytics/PerformancePanel';
import { SessionTimeline } from '@/components/modules/timeline/SessionTimeline';
import { ProjectContext } from '@/components/modules/project/ProjectContext';
import { ChatManager } from '@/components/modules/ChatModules';
import { CheckpointManager } from '@/components/modules/SessionModules';
import { ToolManager, MCPManager, ExtensionManager } from '@/components/modules/SystemModules';
import { MemoryManager, DirectoryManager, HooksManager } from '@/components/modules/ContextModules';
import { SettingsManager, ThemeSelector, ShortcutsPanel, SystemInfo } from '@/components/modules/ConfigModules';
import { ShellManager, AuthManager, FileManager } from '@/components/modules/ActionModules';
import { CustomCommandManager } from '@/components/modules/CommandModules';
import { SkillsManager } from '@/components/modules/SkillsManager';

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function ModulesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Gemini CLI Modules</h1>
          <p className="text-sm text-muted-foreground mt-1">15 core modules — all connected to real Gemini CLI data</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-10">
        {/* ─── Section 1: Monitoring & Analytics ──────────────── */}
        <section>
          <SectionTitle title="📊 Monitoring & Analytics" description="Token usage, cost tracking, and performance telemetry" />
          <div className="grid lg:grid-cols-2 gap-4">
            <AnalyticsDashboard />
            <PerformancePanel />
          </div>
        </section>

        {/* ─── Section 2: Session & Chat ──────────────────────── */}
        <section>
          <SectionTitle title="💬 Sessions & Chat" description="Session history and checkpointing" />
          <div className="grid lg:grid-cols-2 gap-4">
            <ChatManager />
            <SessionTimeline />
            <CheckpointManager />
          </div>
        </section>

        {/* ─── Section 3: System Integration ─────────────────── */}
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

        {/* ─── Section 4: Context & Memory ────────────────────── */}
        <section>
          <SectionTitle title="🧠 Context & Memory" description="GEMINI.md, directories, hooks, and project context" />
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <MemoryManager />
            <DirectoryManager />
            <HooksManager />
            <ProjectContext />
          </div>
        </section>

        {/* ─── Section 5: Configuration ───────────────────────── */}
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
      </div>
    </div>
  );
}
