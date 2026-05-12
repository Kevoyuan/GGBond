import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MessageSquare,
  Settings,
  Plug,
  Zap,
  Activity,
  Database,
  Puzzle,
  Search,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import type { HookEvent } from '@/components/panels/HooksPanel';
import { AgentIcon } from '@/components/icons/AgentIcon';
import { NavListItem } from '@/components/sidebar/NavListItem';
import { ChatView } from '@/components/sidebar/ChatView';
import { Tooltip } from '@/components/ui/Tooltip';
import { ResizeHandle, useResize } from '@/components/ui/ResizeHandle';
import packageJson from '../../package.json';


const HooksPanel = dynamic(() => import('@/components/panels/HooksPanel').then((mod) => mod.HooksPanel), { ssr: false });
const MCPPanel = dynamic(() => import('@/components/panels/MCPPanel').then((mod) => mod.MCPPanel), { ssr: false });
const SkillsManager = dynamic(() => import('@/components/modules/SkillsManager').then((mod) => mod.SkillsManager), { ssr: false });
const MemoryPanel = dynamic(() => import('@/components/panels/MemoryPanel').then((mod) => mod.MemoryPanel), { ssr: false });
const AgentPanel = dynamic(() => import('@/components/agent/AgentPanel').then((mod) => mod.AgentPanel), { ssr: false });
const QuotaPanel = dynamic(() => import('@/components/panels/QuotaPanel').then((mod) => mod.QuotaPanel), { ssr: false });

interface Session {
  id: string;
  title: string;
  created_at: string | number;
  updated_at?: string | number;
  workspace?: string;
  branch?: string | null;
  archived?: number | boolean;
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
  onRestoreSession?: (id: string) => void;
  onArchiveWorkspace?: (workspace: string) => void;
  onNewChatInWorkspace?: (workspace: string) => void;
  onOpenSettings: () => void;
  className?: string;
  currentWorkspace?: string;
  onAddWorkspace?: () => void;
  onFileSelect?: (file: { name: string; path: string }) => void;
  hookEvents?: HookEvent[];
  onClearHooks?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelectAgent?: (agent: any) => void;
  selectedAgentName?: string;
  sidePanelType?: 'graph' | 'timeline' | 'artifact' | 'tasks' | 'plan' | 'terminal' | 'files' | 'modules' | 'usage' | null;
  onToggleSidePanel?: (type: 'graph' | 'timeline' | 'artifact' | 'tasks' | 'plan' | 'terminal' | 'files' | 'modules' | 'usage' | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  workspaceBranchSummary?: Record<string, { label: string; title: string; mixed: boolean } | null>;
  formatSessionAge?: (session: Session) => string;
  // External view control - allows parent to set active view
  sidebarView?: string | null;
  onSetSidebarView?: (view: string | null) => void;
}

type SidebarView = 'chat' | 'skills' | 'hooks' | 'mcp' | 'agents' | 'quota' | 'memory';

const getSearchPlaceholder = (view: SidebarView): string => {
  const placeholders: Record<SidebarView, string> = {
    chat: 'Search chats...',


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
const GEMINI_CLI_CORE_VERSION = String(
  packageJson.dependencies?.['@google/gemini-cli-core'] || ''
).replace(/^[^\d]*/, '') || 'unknown';

export const Sidebar = React.memo(function Sidebar({
  sessions,
  currentSessionId,
  runningSessionIds = [],
  terminalRunningSessionIds = [],
  unreadSessionIds = [],
  onSelectSession,
  onDeleteSession,
  onRestoreSession,
  onArchiveWorkspace,
  onNewChatInWorkspace,
  onOpenSettings,
  currentWorkspace,
  onAddWorkspace,
  onFileSelect,
  hookEvents = [],
  onClearHooks,
  onSelectAgent,
  selectedAgentName,
  isCollapsed = false,
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

  const handleHooksClick = useCallback(() => handleViewClick('hooks'), [handleViewClick]);
  const handleMCPClick = useCallback(() => handleViewClick('mcp'), [handleViewClick]);
  const handleQuotaClick = useCallback(() => handleViewClick('quota'), [handleViewClick]);
  const handleMemoryClick = useCallback(() => handleViewClick('memory'), [handleViewClick]);
  const [searchTerm, setSearchTerm] = useState('');

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
        <div className="flex flex-col gap-1 px-2 pt-2.5 pb-2">
          <Tooltip content={isCollapsed ? "Chats (⌘1)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'chat'} onClick={handleChatClick} icon={MessageSquare} label="Chats" count={unreadSessionIds.length} collapsed={isCollapsed} kbd="⌘1" />
          </Tooltip>
          <Tooltip content={isCollapsed ? "Agents (⌘2)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'agents'} onClick={handleAgentsClick} icon={AgentIcon} label="Agents" collapsed={isCollapsed} kbd="⌘2" />
          </Tooltip>
          <Tooltip content={isCollapsed ? "Skills (⌘3)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'skills'} onClick={handleSkillsClick} icon={Puzzle} label="Skills" collapsed={isCollapsed} kbd="⌘3" />
          </Tooltip>
          <div className="mx-2 my-1">
            <div className="h-px bg-[var(--border-subtle)]" />
          </div>
          <Tooltip content={isCollapsed ? "Hooks (⌘4)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'hooks'} onClick={handleHooksClick} icon={Zap} label="Hooks" collapsed={isCollapsed} kbd="⌘4" />
          </Tooltip>
          <Tooltip content={isCollapsed ? "MCP (⌘5)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'mcp'} onClick={handleMCPClick} icon={Plug} label="MCP" collapsed={isCollapsed} kbd="⌘5" />
          </Tooltip>
          <Tooltip content={isCollapsed ? "Quota (⌘6)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'quota'} onClick={handleQuotaClick} icon={Activity} label="Quota" collapsed={isCollapsed} kbd="⌘6" />
          </Tooltip>
          <Tooltip content={isCollapsed ? "Memory (⌘7)" : undefined} side="right" triggerClassName="w-full">
            <NavListItem active={activeView === 'memory'} onClick={handleMemoryClick} icon={Database} label="Memory" collapsed={isCollapsed} kbd="⌘7" />
          </Tooltip>
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
            <div className="relative group/search">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--text-tertiary)] transition-all duration-200 group-focus-within/search:text-[var(--accent)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={getSearchPlaceholder(activeView)}
                aria-label={getSearchPlaceholder(activeView)}
                className="w-full bg-[var(--bg-tertiary)] border border-transparent rounded-md pl-8 pr-8 py-1.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]/50 focus:outline-none focus:border-[var(--border)] focus:bg-[var(--bg-primary)] focus:shadow-sm transition-all duration-200"
              />
              <div className="absolute right-2 top-2 text-[var(--text-tertiary)] flex items-center gap-0.5 pointer-events-none opacity-40 group-hover/search:opacity-70 transition-opacity">
                <Command className="w-3 h-3" />
                <span className="text-[10px] font-medium">K</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Content View */}
      <div key={activeView} className={cn("flex-1 min-h-0 overflow-hidden flex flex-col relative animate-fade-in", isCollapsed && "hidden")}>
        {activeView === 'chat' ? (
          <ChatView
            sessions={sessions}
            currentSessionId={currentSessionId}
            runningSessionIds={runningSessionIds}
            terminalRunningSessionIds={terminalRunningSessionIds}
            unreadSessionIds={unreadSessionIds}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            onRestoreSession={onRestoreSession}
            onArchiveWorkspace={onArchiveWorkspace}
            onNewChatInWorkspace={onNewChatInWorkspace}
            onAddWorkspace={onAddWorkspace}
            currentWorkspace={currentWorkspace}
            workspaceBranchSummary={workspaceBranchSummary}
            formatSessionAge={formatSessionAge}
            searchTerm={searchTerm}
          />
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
        "px-2 py-1.5 border-t border-[var(--border-subtle)] shrink-0 bg-gradient-to-b from-transparent to-muted/[0.02]",
        isCollapsed ? "flex justify-center" : ""
      )}>
        {isCollapsed ? (
          <Tooltip content="Settings" side="right">
            <button
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="w-9 h-9 flex items-center justify-center rounded-md transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between pl-1.5 pr-2 h-8">
            <button
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="text-[12px] font-semibold tracking-tight">Settings</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-px h-3.5 bg-[var(--border-subtle)]" />
              <span
                className="font-mono text-[9px] font-medium text-[var(--text-tertiary)] select-none opacity-50 hover:opacity-100 transition-opacity cursor-default"
                title={`Gemini CLI v${GEMINI_CLI_CORE_VERSION}`}
              >
                v{GEMINI_CLI_CORE_VERSION}
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
    </div>
  );
});
