import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Settings,
  FolderOpen,
  Plug,
  BarChart2,
  Zap,
  Activity,
  Database,
  Puzzle,
  Search,
  Command,
  Moon,
  Sun,
  Boxes,
  Network,
  Clock,
  BarChart
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
import { NavListItem } from './sidebar/NavListItem';
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
  className?: string;
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  workspaceBranchSummary?: Record<string, { label: string; title: string; mixed: boolean } | null>;
  formatSessionAge?: (session: Session) => string;
}

type SidebarView = 'chat' | 'files' | 'skills' | 'hooks' | 'mcp' | 'agents' | 'quota' | 'memory';

const getSearchPlaceholder = (view: SidebarView): string => {
  const placeholders: Record<SidebarView, string> = {
    chat: 'Search chats...',
    files: 'Search files...',
    skills: 'Search skills...',
    hooks: 'Search hooks...',
    mcp: 'Search MCP servers...',
    agents: 'Search agents...',
    quota: 'Search quotas...',
    memory: 'Search memory...',
  };
  return placeholders[view];
};

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 280;

export function Sidebar({
  sessions,
  currentSessionId,
  runningSessionIds = [],
  terminalRunningSessionIds = [],
  unreadSessionIds = [],
  onSelectSession,
  onDeleteSession,
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
  onToggleSidePanel,
  isCollapsed = false,
  onToggleCollapse,
  workspaceBranchSummary = {},
  formatSessionAge = (session: Session) => new Date(session.created_at).toLocaleDateString()
}: SidebarProps) {
  const [activeView, setActiveView] = useState<SidebarView>('chat');
  const handleViewClick = useCallback((view: SidebarView) => {
    setActiveView(view);
  }, []);
  const [sidePanelWidth, setSidePanelWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModulesDialog, setShowModulesDialog] = useState(false);

  // Vertical resize states
  const [navHeight, setNavHeight] = useState(240);
  const [isResizingNav, setIsResizingNav] = useState(false);
  const navResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // ... (existing width resize logic matches)

  const startResizingNav = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingNav(true);
    navResizeRef.current = { startY: e.clientY, startHeight: navHeight };
  }, [navHeight]);

  const resizeNav = useCallback((e: MouseEvent) => {
    if (isResizingNav && navResizeRef.current) {
      const delta = e.clientY - navResizeRef.current.startY;
      const newHeight = Math.max(100, Math.min(800, navResizeRef.current.startHeight + delta));
      setNavHeight(newHeight);
    }
  }, [isResizingNav]);

  const stopResizingNav = useCallback(() => {
    setIsResizingNav(false);
    navResizeRef.current = null;
  }, []);

  useEffect(() => {
    if (isResizingNav) {
      window.addEventListener('mousemove', resizeNav);
      window.addEventListener('mouseup', stopResizingNav);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resizeNav);
      window.removeEventListener('mouseup', stopResizingNav);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', resizeNav);
      window.removeEventListener('mouseup', stopResizingNav);
    };
  }, [isResizingNav, resizeNav, stopResizingNav]);


  // ... (rest of component)

  return (
    <div
      className={cn(
        "bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] relative flex flex-col h-full transition-all duration-200 ease-in-out shrink-0",
        isCollapsed ? "w-[56px]" : ""
      )}
      style={{ width: isCollapsed ? undefined : sidePanelWidth }}
    >
      {/* Navigation Section - Vertical Resizable */}
      <div
        className={cn("flex flex-col shrink-0 overflow-y-auto min-h-[100px]", isCollapsed && "h-auto overflow-visible")}
        style={{ height: isCollapsed ? 'auto' : navHeight }}
      >
        <div className="flex flex-col gap-0.5 px-2 py-2">
          <NavListItem active={activeView === 'chat'} onClick={() => handleViewClick('chat')} icon={MessageSquare} label="Chats" count={unreadSessionIds.length} collapsed={isCollapsed} kbd="⌘1" />
          <NavListItem active={activeView === 'agents'} onClick={() => handleViewClick('agents')} icon={AgentIcon} label="Agents" collapsed={isCollapsed} kbd="⌘2" />
          <NavListItem active={activeView === 'skills'} onClick={() => handleViewClick('skills')} icon={Puzzle} label="Skills" collapsed={isCollapsed} kbd="⌘3" />
          <NavListItem active={activeView === 'files'} onClick={() => handleViewClick('files')} icon={FolderOpen} label="Files" collapsed={isCollapsed} kbd="⌘4" />
          <NavListItem active={activeView === 'hooks'} onClick={() => handleViewClick('hooks')} icon={Zap} label="Hooks" collapsed={isCollapsed} />
          <NavListItem active={activeView === 'mcp'} onClick={() => handleViewClick('mcp')} icon={Plug} label="MCP" collapsed={isCollapsed} />
          <NavListItem active={activeView === 'quota'} onClick={() => handleViewClick('quota')} icon={Activity} label="Quota" collapsed={isCollapsed} />
          <NavListItem active={activeView === 'memory'} onClick={() => handleViewClick('memory')} icon={Database} label="Memory" collapsed={isCollapsed} />
        </div>
      </div>

      {/* Vertical Resizer Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizingNav}
          className={cn(
            "h-[5px] cursor-row-resize flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors shrink-0 -mt-1 z-10",
            isResizingNav && "bg-[var(--accent)]"
          )}
        >
          <div className={cn("w-8 h-1 rounded-full bg-[var(--border-subtle)] transition-colors", isResizingNav && "bg-[var(--accent)]")} />
        </div>
      )}

      {/* Divider & Search - hidden when collapsed or on views without search */}
      {!isCollapsed && !['quota', 'memory'].includes(activeView) && (
        <>
          <div className="mx-4 h-px bg-[var(--border-subtle)] mb-1 shrink-0" />

          <div className="px-3 py-2 shrink-0">
            <div className="relative group">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={getSearchPlaceholder(activeView)}
                className="w-full bg-[var(--bg-tertiary)] border border-transparent rounded-md pl-8 pr-8 py-1.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border)] focus:bg-[var(--bg-primary)] transition-all shadow-sm"
              />
              <div className="absolute right-2 top-2 text-[var(--text-tertiary)] flex items-center gap-0.5 pointer-events-none">
                <Command className="w-3 h-3 opacity-50" />
                <span className="text-[10px] font-medium opacity-50">K</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Content View */}
      <div className={cn("flex-1 min-h-0 overflow-hidden flex flex-col relative", isCollapsed && "hidden")}>
        {/* ... content remains same ... */}
        {activeView === 'chat' ? (
          <ChatView
            sessions={sessions}
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
            searchTerm={searchTerm}
          />
        ) : activeView === 'files' ? (
          <FileTree className="h-full" initialPath={currentWorkspace} onFileSelect={onFileSelect} searchTerm={searchTerm} />
        ) : activeView === 'skills' ? (
          <SkillsManager compact className="h-full" search={searchTerm} />
        ) : activeView === 'hooks' ? (
          <HooksPanel className="h-full" events={hookEvents} onClear={onClearHooks} searchTerm={searchTerm} />
        ) : activeView === 'agents' ? (
          <AgentPanel className="h-full" onSelectAgent={onSelectAgent!} selectedAgentName={selectedAgentName} search={searchTerm} />
        ) : activeView === 'quota' ? (
          <QuotaPanel className="h-full" />
        ) : activeView === 'memory' ? (
          <MemoryPanel className="h-full" onFileSelect={onFileSelect} workspacePath={currentWorkspace} />
        ) : activeView === 'mcp' ? (
          <MCPPanel className="h-full" />
        ) : null}
      </div>

      {/* Footer Toolbar */}
      <div className={cn(
        "p-2 border-t border-[var(--border-subtle)] shrink-0 flex flex-col gap-1",
        isCollapsed && "p-1 items-center"
      )}>
        {/* Feature Toolbar */}
        <div className={cn(
          "flex gap-1",
          isCollapsed ? "flex-col" : "flex-wrap"
        )}>
          {/* My Usage */}
          <button
            onClick={onShowStats}
            title="My Usage"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors",
              isCollapsed && "justify-center p-1.5"
            )}
          >
            <BarChart className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-[12px] font-medium">Usage</span>}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors",
              isCollapsed && "justify-center p-1.5"
            )}
          >
            {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!isCollapsed && <span className="text-[12px] font-medium">{isDark ? 'Light' : 'Dark'}</span>}
          </button>

          {/* Modules */}
          <button
            onClick={() => setShowModulesDialog(true)}
            title="Modules"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors",
              isCollapsed && "justify-center p-1.5"
            )}
          >
            <Boxes className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-[12px] font-medium">Modules</span>}
          </button>

          {/* Conversation Graph */}
          <button
            onClick={() => onToggleSidePanel?.('graph')}
            title="Conversation Graph"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
              sidePanelType === 'graph'
                ? "text-[var(--accent)] bg-[var(--accent)]/10"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
              isCollapsed && "justify-center p-1.5"
            )}
          >
            <Network className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-[12px] font-medium">Graph</span>}
          </button>

          {/* Timeline */}
          <button
            onClick={() => onToggleSidePanel?.('timeline')}
            title="Timeline"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
              sidePanelType === 'timeline'
                ? "text-[var(--accent)] bg-[var(--accent)]/10"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
              isCollapsed && "justify-center p-1.5"
            )}
          >
            <Clock className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-[12px] font-medium">Timeline</span>}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Settings"
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors",
              isCollapsed && "justify-center p-1.5"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="text-[12px] font-medium">Settings</span>}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 py-1 text-[10px] text-[var(--text-tertiary)]">
            <span>v0.4.2</span>
            <span>Pro</span>
          </div>
        )}
      </div>

      {/* Resizer */}
      {!isCollapsed && (
        <div
          onMouseDown={startResizingNav}
          className={cn(
            "absolute top-0 right-[-1px] w-1 h-full cursor-col-resize z-50 transition-colors hover:bg-[var(--accent)] delay-75 opacity-0 hover:opacity-100",
            isResizing && "bg-[var(--accent)] opacity-100"
          )}
        />
      )}

      <ModulesDialog open={showModulesDialog} onOpenChange={setShowModulesDialog} />
    </div>
  );
}
