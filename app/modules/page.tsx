'use client';

import React from 'react';
import { ChatManager } from '@/components/modules/ChatModules';
import { ToolManager, MCPManager, ExtensionManager } from '@/components/modules/SystemModules';
import { MemoryManager, DirectoryManager, HooksManager } from '@/components/modules/ContextModules';
import { SettingsManager, ThemeSelector, ShortcutsPanel, SystemInfo } from '@/components/modules/ConfigModules';
import { ShellManager, AuthManager, FileManager } from '@/components/modules/ActionModules';

// New Opcode-inspired modules
import { SessionTimeline } from '@/components/modules/timeline/SessionTimeline';
import { ProjectContext } from '@/components/modules/project/ProjectContext';
import { AnalyticsDashboard } from '@/components/modules/analytics/AnalyticsDashboard';

export default function ModulesPage() {
  return (
    <div className="p-6 h-full overflow-y-auto bg-background">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <header className="flex items-center justify-between pb-6 border-b">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Control Center</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage your Gemini CLI environment, sessions, and integrations
            </p>
          </div>
          <div className="flex gap-3">
             {/* Global Actions could go here */}
          </div>
        </header>

        {/* Dashboard Grid - Layout inspired by Opcode */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* Left Column: Timeline & Context (Width: 3/12) */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
             <SessionTimeline />
             <ProjectContext />
             <DirectoryManager />
          </div>

          {/* Middle Column: Core Management (Width: 6/12) */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <AnalyticsDashboard />
              <ChatManager />
            </div>
            
            <ShellManager />
            
            <div className="grid grid-cols-2 gap-6">
              <ToolManager />
              <MCPManager />
            </div>
            
            <ExtensionManager />
          </div>

          {/* Right Column: Configuration & Meta (Width: 3/12) */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <AuthManager />
            <SettingsManager />
            <MemoryManager />
            <div className="grid grid-cols-1 gap-6">
              <ThemeSelector />
              <ShortcutsPanel />
            </div>
            <SystemInfo />
          </div>

        </div>
      </div>
    </div>
  );
}
