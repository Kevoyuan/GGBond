import React, { useState, useMemo, useCallback } from 'react';
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
import { Tooltip } from './ui/Tooltip';
import { ResizeHandle, useResize } from './ui/ResizeHandle';

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
  // External view control - allows parent to set active view
  sidebarView?: string | null;
  onSetSidebarView?: (view: string | null) => void;
  showExtensionsDialog?: boolean;
  onOpenExtensions?: () => void;
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
const MIN_NAV_HEIGHT = 100;
const MAX_NAV_HEIGHT = 800;
const DEFAULT_NAV_HEIGHT = 240;

export const Sidebar = React.memo(function Sidebar({
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
  formatSessionAge = (session: Session) => {
    const date = new Date(session.created_at);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 1) return 'now';
    if (diffInSeconds < 60) return `${diffInSeconds}s`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w`;

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}mo`;

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y`;
  },
  sidebarView,
  onSetSidebarView,
  showExtensionsDialog,
  onOpenExtensions,
}: SidebarProps) {


  // Use external view if provided, otherwise use internal state
  const [internalView, setInternalView] = useState<SidebarView>('chat');
  const activeView = (sidebarView as SidebarView) || internalView;
  const handleViewClick = useCallback((view: SidebarView) => {
    setInternalView(view);
    // Notify parent if callback provided
    if (onSetSidebarView) {
      onSetSidebarView(view);
    }
  }, [onSetSidebarView]);

  // Stable callbacks for NavListItem to prevent re-renders
  const handleChatClick = useCallback(() => handleViewClick('chat'), [handleViewClick]);
  const handleAgentsClick = useCallback(() => handleViewClick('agents'), [handleViewClick]);
  const handleSkillsClick = useCallback(() => handleViewClick('skills'), [handleViewClick]);
  const handleFilesClick = useCallback(() => handleViewClick('files'), [handleViewClick]);
  const handleHooksClick = useCallback(() => handleViewClick('hooks'), [handleViewClick]);
  const handleMCPClick = useCallback(() => handleViewClick('mcp'), [handleViewClick]);
  const handleQuotaClick = useCallback(() => handleViewClick('quota'), [handleViewClick]);
  const handleMemoryClick = useCallback(() => handleViewClick('memory'), [handleViewClick]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModulesDialog, setShowModulesDialog] = useState(false);

  // Use resize hooks for sidebar width and nav height
  const { size: sidePanelWidth, isResizing, handleProps: sidebarHandleProps } = useResize({
    direction: 'horizontal',
    minSize: MIN_SIDEBAR_WIDTH,
    maxSize: MAX_SIDEBAR_WIDTH,
    initialSize: DEFAULT_SIDEBAR_WIDTH,
  });

  const { size: navHeight, isResizing: isResizingNav, handleProps: navHandleProps } = useResize({
    direction: 'vertical',
    minSize: MIN_NAV_HEIGHT,
    maxSize: MAX_NAV_HEIGHT,
    initialSize: DEFAULT_NAV_HEIGHT,
  });


  // ... (rest of component)

  return (
    <div
      className={cn(
        "bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] relative flex flex-col h-full transition-colors duration-200 ease-in-out shrink-0",
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
          <NavListItem active={activeView === 'chat'} onClick={handleChatClick} icon={MessageSquare} label="Chats" count={unreadSessionIds.length} collapsed={isCollapsed} kbd="⌘1" />
          <NavListItem active={activeView === 'agents'} onClick={handleAgentsClick} icon={AgentIcon} label="Agents" collapsed={isCollapsed} kbd="⌘2" />
          <NavListItem active={activeView === 'skills'} onClick={handleSkillsClick} icon={Puzzle} label="Skills" collapsed={isCollapsed} kbd="⌘3" />
          <NavListItem active={activeView === 'files'} onClick={handleFilesClick} icon={FolderOpen} label="Files" collapsed={isCollapsed} kbd="⌘4" />
          <NavListItem active={activeView === 'hooks'} onClick={handleHooksClick} icon={Zap} label="Hooks" collapsed={isCollapsed} />
          <NavListItem active={activeView === 'mcp'} onClick={handleMCPClick} icon={Plug} label="MCP" collapsed={isCollapsed} />
          <NavListItem active={activeView === 'quota'} onClick={handleQuotaClick} icon={Activity} label="Quota" collapsed={isCollapsed} />
          <NavListItem active={activeView === 'memory'} onClick={handleMemoryClick} icon={Database} label="Memory" collapsed={isCollapsed} />
        </div>
      </div>

      {/* Vertical Resizer Handle */}
      {!isCollapsed && (
        <ResizeHandle
          direction="vertical"
          isResizing={isResizingNav}
          onMouseDown={navHandleProps.onMouseDown}
          indicatorClassName="bg-[var(--border-subtle)]"
        />
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
                className="w-full bg-[var(--bg-tertiary)] border border-transparent rounded-md pl-8 pr-8 py-1.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border)] focus:bg-[var(--bg-primary)] transition-colors shadow-sm"
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
        "px-2 py-2 border-t border-[var(--border-subtle)] shrink-0 flex flex-col gap-2 bg-[var(--bg-secondary)]",
        isCollapsed && "p-2 gap-2Items"
      )}>
        {/* Horizontal Action Bar */}
        <div className={cn(
          "flex items-center gap-1",
          isCollapsed ? "flex-col" : "justify-between"
        )}>
          {/* Group 1: Insights & Modules */}
          <div className={cn("flex items-center gap-1", isCollapsed && "flex-col")}>
            <Tooltip content="Usage" side={isCollapsed ? "right" : "top"}>
              <button
                onClick={onShowStats}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                <BarChart className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip content="Modules" side={isCollapsed ? "right" : "top"}>
              <button
                onClick={() => setShowModulesDialog(true)}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                <Boxes className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip content="Extensions" side={isCollapsed ? "right" : "top"}>
              <button
                onClick={onOpenExtensions}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                <Puzzle className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {!isCollapsed && <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />}

          {/* Group 2: Visualization Panels */}
          <div className={cn("flex items-center gap-1", isCollapsed && "flex-col")}>
            <Tooltip content="Graph" side={isCollapsed ? "right" : "top"}>
              <button
                onClick={() => onToggleSidePanel?.('graph')}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200",
                  sidePanelType === 'graph'
                    ? "text-[var(--accent)] bg-[var(--accent)]/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                <Network className="w-4 h-4" />
              </button>
            </Tooltip>

            <Tooltip content="Timeline" side={isCollapsed ? "right" : "top"}>
              <button
                onClick={() => onToggleSidePanel?.('timeline')}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200",
                  sidePanelType === 'timeline'
                    ? "text-[var(--accent)] bg-[var(--accent)]/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                <Clock className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {!isCollapsed && <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />}

          {/* Group 3: App Controls */}
          <div className={cn("flex items-center gap-1", isCollapsed && "flex-col")}>
            <Tooltip content={isDark ? "Light Mode" : "Dark Mode"} side={isCollapsed ? "right" : "top"}>
              <button
                onClick={toggleTheme}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </Tooltip>

            <Tooltip content="Settings" side={isCollapsed ? "right" : "top"}>
              <button
                onClick={onOpenSettings}
                className={cn(
                  "p-2 rounded-md transition-colors duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                  isCollapsed && "w-9 h-9 flex items-center justify-center"
                )}
              >
                <Settings className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Info Bar */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-1.5 pt-1.5 border-t border-[var(--border-subtle)]/50">
            <span className="text-[10px] text-[var(--text-tertiary)] font-mono opacity-60">v0.4.2</span>
            <div className="flex items-center gap-1.5">
              <span className="px-1 py-0.25 rounded-[3px] text-[9px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-sm lowercase">
                pro
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Resizer (sidebar width) */}
      {!isCollapsed && (
        <ResizeHandle
          direction="horizontal"
          isResizing={isResizing}
          onMouseDown={sidebarHandleProps.onMouseDown}
          className="absolute top-0 right-[-1px] h-full hover:opacity-100 delay-75"
          indicatorClassName="bg-[var(--border-subtle)]"
        />
      )}

      <ModulesDialog open={showModulesDialog} onOpenChange={setShowModulesDialog} />
    </div>
  );
});
