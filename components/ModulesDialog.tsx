'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, BarChart3, MessageSquare, Settings, Brain, Palette, Loader2, LayoutGrid, TrendingUp, GitBranch, Cpu, Database, Sparkles, Terminal, Shield, Folder, Command, Activity, Clock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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
  description: string;
}

const tabs: Tab[] = [
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} />, description: 'Usage metrics and performance' },
  { id: 'sessions', label: 'Sessions', icon: <MessageSquare size={16} />, description: 'Chat history and checkpoints' },
  { id: 'system', label: 'System', icon: <Settings size={16} />, description: 'MCP, tools and extensions' },
  { id: 'context', label: 'Context', icon: <Brain size={16} />, description: 'Memory and project context' },
  { id: 'config', label: 'Config', icon: <Palette size={16} />, description: 'Settings and preferences' },
];

interface ModulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SectionTitle({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// Tab button component with improved accessibility
const TabButton = React.memo(function TabButton({
  tab,
  isActive,
  onClick
}: {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-selected={isActive}
      role="tab"
      className={cn(
        "flex items-center gap-2.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 relative group",
        isActive
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300 dark:hover:border-zinc-600"
      )}
    >
      <span className={cn(
        "transition-transform duration-200",
        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )}>
        {tab.icon}
      </span>
      <span>{tab.label}</span>
      {!isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary rounded-full transition-colors duration-300 group-hover:w-full opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
});

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
  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    localStorage.setItem('modules-active-tab', tabId);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;
  if (!portalReady) return null;

  const activeTabInfo = tabs.find(t => t.id === activeTab);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modules-dialog-title"
    >
      {/* Backdrop with blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-7xl max-h-[92vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden relative z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-muted/50 to-transparent shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <LayoutGrid className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 id="modules-dialog-title" className="font-semibold text-xl text-foreground">Gemini CLI Modules</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Deep monitoring and configuration panel</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-200 hover:rotate-90"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b bg-muted/20 px-4 shrink-0">
          <nav className="flex gap-1 -mb-px" aria-label="Module categories">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => handleTabChange(tab.id)}
              />
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-muted/5">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading modules...</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {/* Tab 1: Monitoring & Analytics */}
                {activeTab === 'analytics' && (
                  <section>
                    <SectionTitle
                      title="Monitoring & Analytics"
                      description="Token usage, cost tracking, and performance telemetry"
                      icon={<TrendingUp size={20} />}
                    />
                    <div className="grid lg:grid-cols-2 gap-6">
                      <AnalyticsDashboard />
                      <PerformancePanel />
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6 mt-6">
                      <ToolStatsPanel />
                      <FileHeatmapPanel />
                    </div>
                  </section>
                )}

                {/* Tab 2: Session & Chat */}
                {activeTab === 'sessions' && (
                  <section>
                    <SectionTitle
                      title="Sessions & Chat"
                      description="Session history and checkpointing"
                      icon={<GitBranch size={20} />}
                    />
                    <div className="grid lg:grid-cols-2 gap-6">
                      <ChatManager />
                      <SessionTimeline />
                    </div>
                    <div className="mt-6">
                      <CheckpointManager />
                    </div>
                  </section>
                )}

                {/* Tab 3: System Integration */}
                {activeTab === 'system' && (
                  <section>
                    <SectionTitle
                      title="System Integration"
                      description="MCP servers, tools, extensions, and skills"
                      icon={<Cpu size={20} />}
                    />
                    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    <SectionTitle
                      title="Context & Memory"
                      description="GEMINI.md, directories, hooks, and project context"
                      icon={<Database size={20} />}
                    />
                    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    <SectionTitle
                      title="Configuration"
                      description="Model selection, theme, shortcuts, and system info"
                      icon={<Layers size={20} />}
                    />
                    <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      <SettingsManager />
                      <ThemeSelector />
                      <ShortcutsPanel />
                      <SystemInfo />
                      <FileManager />
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/20 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity size={12} className="text-primary" />
            <span>{activeTabInfo?.description}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd> to close
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
