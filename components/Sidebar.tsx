import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  // ... (rest of imports)
  Plus,
  Settings,
  Moon,
  Sun,
  FolderOpen,
  Plug,
  BarChart2,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Layers,
  Activity,
  Database,
  Puzzle,
  Network,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { FileTree } from './FileTree';
import { HooksPanel, type HookEvent } from './HooksPanel';
import { MCPPanel } from './MCPPanel';
import { SkillsManager } from './modules/SkillsManager';
import { MemoryPanel } from './MemoryPanel';
import { AgentPanel } from './AgentPanel';
import { QuotaPanel } from './QuotaPanel';
import { ModulesDialog } from './ModulesDialog';
import { AgentIcon } from './icons/AgentIcon';
import { GeminiIcon } from './icons/GeminiIcon';
import { Tooltip } from '@/components/ui/Tooltip';

// New separated components & hooks
import { NavButton } from './sidebar/NavButton';
import { ChatView } from './sidebar/ChatView';
import { useGitBranches } from '../hooks/useGitBranches';

interface Session {
  id: string;
  title: string;
  created_at: string | number;
  updated_at?: string | number;
  workspace?: string;
  branch?: string | null;
  isCore?: boolean;
  lastUpdated?: string;
}

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  runningSessionIds?: string[];
  terminalRunningSessionIds?: string[];
  unreadSessionIds?: string[];
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onNewChatInWorkspace?: (workspace: string) => void;
  onOpenSettings: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  className?: string; // Although not used here, keep for consistency if needed later
  onShowStats?: () => void;
  currentWorkspace?: string;
  onAddWorkspace?: () => void;
  onFileSelect?: (file: { name: string; path: string }) => void;
  hookEvents?: HookEvent[];
  onClearHooks?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelectAgent?: (agent: any) => void;
  selectedAgentName?: string;
  sidePanelType?: 'graph' | 'timeline' | null;
  onToggleSidePanel?: (type: 'graph' | 'timeline' | null) => void;
}

type SidebarView = 'chat' | 'files' | 'skills' | 'hooks' | 'mcp' | 'agents' | 'quota' | 'memory';

const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 256;

export function Sidebar({
  sessions,
  currentSessionId,
  runningSessionIds = [],
  terminalRunningSessionIds = [],
  unreadSessionIds = [],
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onNewChatInWorkspace,
  onOpenSettings,
  isDark,
  toggleTheme,
  onShowStats,
  currentWorkspace,
  onAddWorkspace,
  onFileSelect,
  hookEvents = [],
  onClearHooks,
  onSelectAgent,
  selectedAgentName,
  sidePanelType,
  onToggleSidePanel
}: SidebarProps) {
  const [activeView, setActiveView] = useState<SidebarView>('chat');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidePanelWidth, setSidePanelWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Dialog states
  const [showModulesDialog, setShowModulesDialog] = useState(false);

  // Session utility
  const getSessionUpdatedAt = useCallback((session: Session) => {
    const raw = session.updated_at ?? session.lastUpdated ?? session.created_at;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, []);

  const dedupedSessions = useMemo(() => {
    const byId = new Map<string, Session>();
    for (const session of sessions) {
      const existing = byId.get(session.id);
      if (!existing || getSessionUpdatedAt(session) >= getSessionUpdatedAt(existing)) {
        byId.set(session.id, session);
      }
    }
    return Array.from(byId.values());
  }, [sessions, getSessionUpdatedAt]);

  const formatSessionAge = useCallback((session: Session): string => {
    const raw = session.updated_at ?? session.created_at;
    if (!raw) return '';
    const ts = typeof raw === 'number' ? raw : new Date(raw).getTime();
    if (!Number.isFinite(ts)) return '';

    const diffMs = Date.now() - ts;
    if (diffMs < 0) return 'now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.floor(days / 365)}y`;
  }, []);

  // Git and grouping
  const workspaceNames = useMemo(() => Array.from(new Set(dedupedSessions.map(s => s.workspace || 'Default'))), [dedupedSessions]);
  const branchInfo = useGitBranches(workspaceNames);

  const workspaceBranchSummary = useMemo(() => {
    const summaries: Record<string, { label: string; title: string; mixed: boolean } | null> = {};
    const groups: Record<string, Session[]> = {};
    dedupedSessions.forEach(s => {
      const w = s.workspace || 'Default';
      if (!groups[w]) groups[w] = [];
      groups[w].push(s);
    });

    Object.entries(groups).forEach(([workspace, list]) => {
      const uniqueBranches = Array.from(new Set(list.map(s => s.branch || '').filter(Boolean)));
      if (uniqueBranches.length > 1) {
        summaries[workspace] = { label: 'mixed', title: `Branches: ${uniqueBranches.join(', ')}`, mixed: true };
      } else if (uniqueBranches.length === 1) {
        summaries[workspace] = { label: uniqueBranches[0], title: `Branch: ${uniqueBranches[0]}`, mixed: false };
      } else if (branchInfo[workspace]) {
        summaries[workspace] = { label: branchInfo[workspace]!, title: `Current: ${branchInfo[workspace]}`, mixed: false };
      } else {
        summaries[workspace] = null;
      }
    });
    return summaries;
  }, [dedupedSessions, branchInfo]);

  // Collapsed / Width state
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    if (savedCollapsed) setIsCollapsed(savedCollapsed === 'true');
    const savedWidth = localStorage.getItem('side-panel-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width)) setSidePanelWidth(Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem('side-panel-width', String(sidePanelWidth));
  }, [sidePanelWidth]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX - 56;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) setSidePanelWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const handleViewClick = (view: SidebarView) => {
    if (activeView === view) {
      setIsCollapsed(!isCollapsed);
    } else {
      setActiveView(view);
      setIsCollapsed(false);
    }
  };

  const handleSidePanelClick = (type: 'graph' | 'timeline') => {
    if (sidePanelType === type) {
      onToggleSidePanel?.(null);
    } else {
      onToggleSidePanel?.(type);
    }
  };

  const isAnyOpen = !isCollapsed || (sidePanelType !== null && sidePanelType !== undefined);

  const handleToggleAll = () => {
    if (isAnyOpen) {
      setIsCollapsed(true);
      onToggleSidePanel?.(null);
    } else {
      setIsCollapsed(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r">
      {/* Global Title Bar - Safe Area for Traffic Lights */}
      <div className="h-[54px] w-full shrink-0 drag-region" />

      <div className="flex flex-1 min-h-0 relative">


        {/* Navigation Rail */}
        {/* Navigation Rail */}
        {/* Navigation Rail */}
        <div className="w-14 border-r relative flex flex-col items-center pt-4 pb-4 gap-4 bg-card z-20 shrink-0 drag-region">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2 no-drag">
            <GeminiIcon className="w-6 h-6" />
          </div>

          <div className="flex flex-col gap-3 w-full px-2 items-center flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden no-drag">
            <Tooltip content="New Chat" side="right" sideOffset={18}>
              <button
                onClick={onNewChat}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105 relative group"
              >
                <Plus className="w-5 h-5" />
              </button>
            </Tooltip>
            <div className="w-8 h-px bg-border/50 my-1" />

            <NavButton active={!isCollapsed && activeView === 'chat'} onClick={() => handleViewClick('chat')} icon={MessageSquare} label="Chats" />
            <NavButton active={!isCollapsed && activeView === 'files'} onClick={() => handleViewClick('files')} icon={FolderOpen} label="Files" />
            <NavButton active={!isCollapsed && activeView === 'skills'} onClick={() => handleViewClick('skills')} icon={Puzzle} label="Skills" />
            <NavButton active={!isCollapsed && activeView === 'hooks'} onClick={() => handleViewClick('hooks')} icon={Zap} label="Hooks" />
            <NavButton active={!isCollapsed && activeView === 'mcp'} onClick={() => handleViewClick('mcp')} icon={Plug} label="MCP" />
            <NavButton active={!isCollapsed && activeView === 'agents'} onClick={() => handleViewClick('agents')} icon={AgentIcon} label="Agents" />
            <NavButton active={!isCollapsed && activeView === 'quota'} onClick={() => handleViewClick('quota')} icon={Activity} label="Quota" />
            <NavButton active={!isCollapsed && activeView === 'memory'} onClick={() => handleViewClick('memory')} icon={Database} label="Knowledge Base" />

            {onToggleSidePanel && (
              <>
                <div className="w-8 h-px bg-border/50 my-1" />
                <NavButton active={sidePanelType === 'graph'} onClick={() => handleSidePanelClick('graph')} icon={Network} label="Conversation Graph" />
                <NavButton active={sidePanelType === 'timeline'} onClick={() => handleSidePanelClick('timeline')} icon={Clock} label="Timeline" />
              </>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-3 w-full px-2 items-center shrink-0">
            <Tooltip content="Deep Monitoring" side="right" sideOffset={18}>
              <button onClick={() => setShowModulesDialog(true)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <LayoutGrid className="w-5 h-5" />
              </button>
            </Tooltip>
            <Tooltip content={isAnyOpen ? "Collapse All" : "Expand Sidebar"} side="right" sideOffset={18}>
              <button onClick={handleToggleAll} className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                {!isAnyOpen ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
            </Tooltip>
            <Tooltip content={isDark ? "Light" : "Dark"} side="right" sideOffset={18}>
              <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </Tooltip>
            <Tooltip content="Settings" side="right" sideOffset={18}>
              <button onClick={onOpenSettings} className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div
          className={cn("flex flex-col bg-card z-10 relative shrink-0", !isResizing && "transition-all duration-200 ease-in-out", isCollapsed && "w-0 opacity-0 overflow-hidden")}
          style={{ width: isCollapsed ? 0 : sidePanelWidth }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              transition={{ duration: 0.1 }}
              className="flex-1 overflow-hidden flex flex-col"
            >
              {/* Content area */}

              {activeView === 'chat' ? (
                <ChatView
                  sessions={dedupedSessions}
                  currentSessionId={currentSessionId}
                  runningSessionIds={runningSessionIds}
                  terminalRunningSessionIds={terminalRunningSessionIds}
                  unreadSessionIds={unreadSessionIds}
                  onSelectSession={onSelectSession}
                  onDeleteSession={onDeleteSession}
                  onNewChatInWorkspace={onNewChatInWorkspace}
                  onAddWorkspace={onAddWorkspace}
                  onShowStats={onShowStats}
                  currentWorkspace={currentWorkspace}
                  workspaceBranchSummary={workspaceBranchSummary}
                  formatSessionAge={formatSessionAge}
                />
              ) : activeView === 'files' ? (
                <FileTree className="h-full" initialPath={currentWorkspace} onFileSelect={onFileSelect} />
              ) : activeView === 'skills' ? (
                <SkillsManager compact className="h-full" />
              ) : activeView === 'hooks' ? (
                <HooksPanel className="h-full" events={hookEvents} onClear={onClearHooks} />
              ) : activeView === 'agents' ? (
                <AgentPanel className="h-full" onSelectAgent={onSelectAgent!} selectedAgentName={selectedAgentName} />
              ) : activeView === 'quota' ? (
                <QuotaPanel className="h-full" />
              ) : activeView === 'memory' ? (
                <MemoryPanel className="h-full" onFileSelect={onFileSelect} workspacePath={currentWorkspace} />
              ) : (
                <MCPPanel className="h-full" />
              )}
            </motion.div>
          </AnimatePresence>

          {!isCollapsed && (
            <div onMouseDown={startResizing} className={cn("absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 transition-colors hover:bg-primary/30 group", isResizing && "bg-primary/50")}>
              <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-8 bg-border/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity", isResizing && "opacity-100 bg-primary/40")} />
            </div>
          )}
        </div>

        <ModulesDialog open={showModulesDialog} onOpenChange={setShowModulesDialog} />
      </div>
    </div>
  );
}
