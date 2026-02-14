import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Settings,
  Moon,
  Sun,
  FolderOpen,
  Box,
  Search,
  Plug,
  ChevronDown,
  ChevronRight,
  Folder,
  BarChart2,
  LayoutGrid,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  GitBranch,
  TerminalSquare,
  ShieldCheck,
  Zap,
  Play,
  Layers,
  Activity,
  Database,
  Puzzle,
  Network,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { AgentPanel } from './AgentPanel';
import { QuotaPanel } from './QuotaPanel';
import { MemoryPanel } from './MemoryPanel';
import { FileTree } from './FileTree';
import { HooksPanel, type HookEvent } from './HooksPanel';
import { MCPPanel } from './MCPPanel';
import { SkillsManager } from './modules/SkillsManager';
import { UsageStatsDialog } from './UsageStatsDialog';
import { ModulesDialog } from './ModulesDialog';
import { RunAgentDialog } from './RunAgentDialog';
import { Tooltip } from '@/components/ui/Tooltip';

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
  onSelectAgent?: (agent: any) => void;
  selectedAgentName?: string;
  sidePanelType?: 'graph' | 'timeline' | null;
  onToggleSidePanel?: (type: 'graph' | 'timeline' | null) => void;
}

type SidebarView = 'chat' | 'files' | 'skills' | 'hooks' | 'mcp' | 'agents' | 'quota' | 'memory' | 'agent-runs';

const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 256;

/**
 * Hook: 获取各 workspace 的 git branch 信息
 */
function useGitBranches(workspaces: string[]) {
  const [branches, setBranches] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchBranches = async () => {
      const results: Record<string, string | null> = {};
      // Only fetch for absolute paths (real filesystem workspaces)
      const validWorkspaces = workspaces.filter(w => w !== 'Default' && w.startsWith('/'));
      await Promise.all(
        validWorkspaces.map(async (workspace) => {
          try {
            const res = await fetch(`/api/git/branch?path=${encodeURIComponent(workspace)}`);
            if (res.ok) {
              const data = await res.json();
              results[workspace] = data.branch || null;
            }
          } catch {
            results[workspace] = null;
          }
        })
      );
      setBranches(results);
    };

    if (workspaces.length > 0) {
      fetchBranches();
    }
  }, [workspaces.join(',')]);

  return branches;
}

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
  className,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidePanelWidth, setSidePanelWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);

  // Dialog states
  const [showModulesDialog, setShowModulesDialog] = useState(false);
  const [showRunAgentDialog, setShowRunAgentDialog] = useState(false);

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
      if (!existing) {
        byId.set(session.id, session);
        continue;
      }
      if (getSessionUpdatedAt(session) >= getSessionUpdatedAt(existing)) {
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

    const years = Math.floor(days / 365);
    return `${years}y`;
  }, []);

  useEffect(() => {
    if (!pendingDeleteSessionId) return;
    const stillExists = dedupedSessions.some((session) => session.id === pendingDeleteSessionId);
    if (!stillExists) {
      setPendingDeleteSessionId(null);
    }
  }, [pendingDeleteSessionId, dedupedSessions]);

  // Load state from local storage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    if (savedCollapsed) {
      setIsCollapsed(savedCollapsed === 'true');
    }

    const savedWidth = localStorage.getItem('side-panel-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width)) {
        setSidePanelWidth(Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH));
      }
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const toggleWorkspace = (workspace: string) => {
    const newCollapsed = new Set(collapsedWorkspaces);
    if (newCollapsed.has(workspace)) {
      newCollapsed.delete(workspace);
    } else {
      newCollapsed.add(workspace);
    }
    setCollapsedWorkspaces(newCollapsed);
  };

  // Group sessions by workspace
  const groupedSessions = useMemo(() => {
    const groups: Record<string, Session[]> = {};

    dedupedSessions.forEach(session => {
      const workspace = session.workspace || 'Default';
      if (!groups[workspace]) {
        groups[workspace] = [];
      }
      groups[workspace].push(session);
    });

    return groups;
  }, [dedupedSessions]);

  // Git branch awareness
  const workspaceNames = useMemo(() => Object.keys(groupedSessions), [groupedSessions]);
  const branchInfo = useGitBranches(workspaceNames);
  const workspaceBranchSummary = useMemo(() => {
    const summaries: Record<string, { label: string; title: string; mixed: boolean } | null> = {};

    Object.entries(groupedSessions).forEach(([workspace, list]) => {
      const uniqueSessionBranches = Array.from(
        new Set(
          list
            .map((session) => (typeof session.branch === 'string' ? session.branch.trim() : ''))
            .filter(Boolean)
        )
      );

      if (uniqueSessionBranches.length > 1) {
        summaries[workspace] = {
          label: 'mixed',
          title: `Branches: ${uniqueSessionBranches.join(', ')}`,
          mixed: true,
        };
        return;
      }

      if (uniqueSessionBranches.length === 1) {
        summaries[workspace] = {
          label: uniqueSessionBranches[0],
          title: `Branch: ${uniqueSessionBranches[0]}`,
          mixed: false,
        };
        return;
      }

      const currentBranch = branchInfo[workspace];
      if (currentBranch) {
        summaries[workspace] = {
          label: currentBranch,
          title: `Current branch: ${currentBranch}`,
          mixed: false,
        };
        return;
      }

      summaries[workspace] = null;
    });

    return summaries;
  }, [groupedSessions, branchInfo]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedSessions;
    const result: Record<string, Session[]> = {};
    Object.entries(groupedSessions).forEach(([key, list]) => {
      const filtered = list.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));
      if (filtered.length > 0) result[key] = filtered;
    });
    return result;
  }, [groupedSessions, searchTerm]);

  // Handle Resizing
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
      // Calculation: Mouse position (e.clientX) - width of Rail (14 * 4 = 56px roughly, but let's be more precise)
      // The Rail is 3.5rem (w-14) = 56px.
      const newWidth = e.clientX - 56;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidePanelWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      // Disable text selection and transitions while resizing
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

  return (
    <div className="flex h-full border-r bg-muted/10 relative">
      {/* Navigation Rail */}
      <div className="w-14 border-r flex flex-col items-center py-4 gap-4 bg-card z-20 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
          <Box className="w-5 h-5 text-primary" />
        </div>

        <div className="flex flex-col gap-3 w-full px-2 items-center flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden">
          <Tooltip content="New Chat" side="right" sideOffset={18}>
            <button
              onClick={onNewChat}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105 relative group"
              aria-label="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </Tooltip>

          <div className="w-8 h-px bg-border/50 my-1" />

          <NavButton
            active={activeView === 'chat'}
            onClick={() => setActiveView('chat')}
            icon={MessageSquare}
            label="Chats"
          />

          <NavButton
            active={activeView === 'files'}
            onClick={() => setActiveView('files')}
            icon={FolderOpen}
            label="Files"
          />

          <NavButton
            active={activeView === 'skills'}
            onClick={() => setActiveView('skills')}
            icon={Puzzle}
            label="Skills"
          />

          <NavButton
            active={activeView === 'hooks'}
            onClick={() => setActiveView('hooks')}
            icon={Zap}
            label="Hooks"
          />

          <NavButton
            active={activeView === 'mcp'}
            onClick={() => setActiveView('mcp')}
            icon={Plug}
            label="MCP"
          />

          <NavButton
            active={activeView === 'agents'}
            onClick={() => setActiveView('agents')}
            icon={Layers}
            label="Agents"
          />

          <NavButton
            active={activeView === 'quota'}
            onClick={() => setActiveView('quota')}
            icon={Activity}
            label="Quota"
          />

          <NavButton
            active={activeView === 'memory'}
            onClick={() => setActiveView('memory')}
            icon={Database}
            label="Knowledge Base"
          />

          {onToggleSidePanel && (
            <>
              <div className="w-8 h-px bg-border/50 my-1" />

              <NavButton
                active={sidePanelType === 'graph'}
                onClick={() => onToggleSidePanel('graph')}
                icon={Network}
                label="Conversation Graph"
              />

              <NavButton
                active={sidePanelType === 'timeline'}
                onClick={() => onToggleSidePanel('timeline')}
                icon={Clock}
                label="Timeline"
              />
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 w-full px-2 items-center shrink-0">
          <Tooltip content="Deep Monitoring" side="right" sideOffset={18}>
            <button
              onClick={() => setShowModulesDialog(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative group"
              aria-label="Deep Monitoring"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"} side="right" sideOffset={18}>
            <button
              onClick={toggleSidebar}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative group"
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          </Tooltip>
          <Tooltip content={isDark ? "Light Mode" : "Dark Mode"} side="right" sideOffset={18}>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative group"
              aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </Tooltip>

          <Tooltip content="Settings" side="right" sideOffset={18}>
            <button
              onClick={onOpenSettings}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-muted border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative group"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>


        </div>
      </div>

      {/* Side Panel Content */}
      <div
        className={cn(
          "flex flex-col bg-muted/5 z-10 relative shrink-0",
          !isResizing && "transition-all duration-300 ease-in-out",
          isCollapsed && "w-0 opacity-0 overflow-hidden"
        )}
        style={{ width: isCollapsed ? 0 : sidePanelWidth }}
      >
        {activeView === 'chat' ? (
          <>
            <div className="p-4 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="relative group">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full bg-background border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold text-muted-foreground/80">Workspaces</span>
                {onAddWorkspace && (
                  <button
                    onClick={onAddWorkspace}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Add Workspace"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {Object.entries(filteredGroups).map(([workspace, list]) => (
                list.length > 0 && (
                  <div key={workspace} className="mb-1 text-xs sm:text-sm">
                    <div
                      className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted/60 cursor-pointer transition-colors",
                        currentWorkspace === workspace
                          ? "text-foreground bg-primary/5 border border-primary/20"
                          : "text-muted-foreground hover:text-foreground border border-transparent"
                      )}
                      onClick={() => toggleWorkspace(workspace)}
                    >
                      {collapsedWorkspaces.has(workspace) ? (
                        <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
                      )}
                      <Folder className={cn(
                        "w-4 h-4 shrink-0",
                        currentWorkspace === workspace ? "text-primary" : "text-muted-foreground/70"
                      )} />
                      <span
                        className="truncate font-medium flex-1 text-[13px]"
                        title={workspace}
                      >
                        {workspace === 'Default' ? workspace : workspace.split('/').pop()}
                      </span>
                      {workspaceBranchSummary[workspace] && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 shrink-0 max-w-[120px]"
                          title={workspaceBranchSummary[workspace]?.title}
                        >
                          <GitBranch className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{workspaceBranchSummary[workspace]?.label}</span>
                        </span>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 hover:bg-background p-0.5 rounded transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNewChatInWorkspace) {
                            onNewChatInWorkspace(workspace);
                          }
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!collapsedWorkspaces.has(workspace) && (
                      <div className="ml-4 pl-2 border-l border-border/40 flex flex-col gap-0.5 mt-1">
                        {list.map((session) => {
                          const isSessionRunning = runningSessionIds.includes(session.id);
                          const isTerminalRunning = terminalRunningSessionIds.includes(session.id);
                          return (
                            <div
                              key={session.id}
                              className={cn(
                                "group flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer transition-all border border-transparent",
                                currentSessionId === session.id
                                  ? "text-foreground font-medium bg-muted/40"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                              )}
                              onClick={() => onSelectSession(session.id)}
                              onMouseLeave={() => {
                                if (pendingDeleteSessionId === session.id) {
                                  setPendingDeleteSessionId(null);
                                }
                              }}
                            >
                              <div className="relative w-2.5 h-2.5 shrink-0 flex items-center justify-center">
                                {isSessionRunning ? (
                                  <>
                                    <span className="absolute inset-0 rounded-full border border-muted-foreground/40 border-t-transparent animate-spin [animation-duration:1s]" />
                                  </>
                                ) : currentSessionId === session.id ? (
                                  // Current session is always considered read (shows blue dot)
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                ) : unreadSessionIds.includes(session.id) ? (
                                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Unread messages" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-muted-foreground/30" />
                                )}
                              </div>
                              <span className="truncate flex-1 text-[13px]">{session.title}</span>
                              {isTerminalRunning && (
                                <span
                                  className="inline-flex items-center justify-center shrink-0 text-amber-500/90"
                                  title="Terminal is running in this chat session"
                                >
                                  <TerminalSquare className="w-3 h-3" />
                                </span>
                              )}
                              {workspaceBranchSummary[workspace]?.mixed && session.branch && (
                                <span
                                  className="inline-flex items-center justify-center shrink-0 text-muted-foreground/70"
                                  title={`Session branch: ${session.branch}`}
                                >
                                  <GitBranch className="w-3 h-3" />
                                </span>
                              )}
                              <div className="relative shrink-0 w-12 h-5 flex items-center justify-end">
                                {pendingDeleteSessionId === session.id ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingDeleteSessionId(null);
                                      onDeleteSession(session.id);
                                    }}
                                    className="w-full h-5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-[10px] font-semibold leading-none hover:bg-destructive/15 transition-colors"
                                    title="Confirm delete"
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <>
                                    <span className="absolute right-0 text-[10px] text-muted-foreground/80 tabular-nums transition-opacity group-hover:opacity-0">
                                      {formatSessionAge(session)}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDeleteSessionId(session.id);
                                      }}
                                      className="absolute right-0 opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              ))}

              {Object.values(filteredGroups).every(l => l.length === 0) && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                  <Search className="w-8 h-8 mb-2 opacity-20" />
                  <p>No chats found</p>
                </div>
              )}
            </div>

            <div className="p-3 border-t bg-card/50 backdrop-blur-sm space-y-1.5">

              <button
                onClick={onShowStats}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-sm text-muted-foreground transition-colors overflow-hidden whitespace-nowrap"
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Usage Dashboard</span>
              </button>
            </div>
          </>
        ) : activeView === 'files' ? (
          <FileTree className="h-full" initialPath={currentWorkspace || undefined} onFileSelect={onFileSelect} />
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

        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            onMouseDown={startResizing}
            className={cn(
              "absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 transition-colors hover:bg-primary/30 group",
              isResizing && "bg-primary/50"
            )}
          >
            <div className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-8 bg-border/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
              isResizing && "opacity-100 bg-primary/40"
            )} />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ModulesDialog
        open={showModulesDialog}
        onOpenChange={setShowModulesDialog}
      />
      <RunAgentDialog
        open={showRunAgentDialog}
        onOpenChange={setShowRunAgentDialog}
      />
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function NavButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
  return (
    <Tooltip content={label} side="right" sideOffset={18}>
      <div
        onClick={onClick}
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 relative group cursor-pointer border",
          active
            ? "bg-primary text-primary-foreground shadow-md border-primary/20"
            : "bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
    </Tooltip>
  );
}
