import React, { useState, useMemo } from 'react';
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
  PanelLeftOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

import { FileExplorer } from './FileExplorer';
import { UsageStatsDialog } from './UsageStatsDialog';

interface Session {
  id: string;
  title: string;
  created_at: string;
  workspace?: string;
}

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onNewChatInWorkspace?: (workspace: string) => void;
  onOpenSkills: () => void;
  onOpenSettings: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  className?: string;
  onShowStats?: () => void;
  currentWorkspace?: string;
  onAddWorkspace?: () => void;
}

type SidebarView = 'chat' | 'files';

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onNewChatInWorkspace,
  onOpenSkills,
  onOpenSettings,
  isDark,
  toggleTheme,
  className,
  onShowStats,
  currentWorkspace,
  onAddWorkspace
}: SidebarProps) {
  const [activeView, setActiveView] = useState<SidebarView>('chat');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from local storage
  React.useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      setIsCollapsed(savedState === 'true');
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

    sessions.forEach(session => {
      const workspace = session.workspace || 'Default';
      if (!groups[workspace]) {
        groups[workspace] = [];
      }
      groups[workspace].push(session);
    });

    return groups;
  }, [sessions]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedSessions;
    const result: Record<string, Session[]> = {};
    Object.entries(groupedSessions).forEach(([key, list]) => {
      const filtered = list.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));
      if (filtered.length > 0) result[key] = filtered;
    });
    return result;
  }, [groupedSessions, searchTerm]);

  return (
    <div className="flex h-full border-r bg-muted/10">
      {/* Navigation Rail */}
      <div className="w-14 border-r flex flex-col items-center py-4 gap-4 bg-card z-10 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
          <Box className="w-5 h-5 text-primary" />
        </div>

        <div className="flex flex-col gap-3 w-full px-2 items-center">
          <button
            onClick={onNewChat}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>

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

          <Link href="/modules" className="block">
            <NavButton
              active={false}
              onClick={() => { }}
              icon={LayoutGrid}
              label="Modules"
            />
          </Link>

          <NavButton
            active={false}
            onClick={onOpenSkills}
            icon={Plug}
            label="Skills"
          />
        </div>

        <div className="mt-auto flex flex-col gap-3 w-full px-2 items-center">
          <button
            onClick={toggleSidebar}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground border border-border">
            U
          </div>
        </div>
      </div>

      {/* Side Panel Content */}
      <div className={cn("w-64 flex flex-col bg-muted/5 transition-all duration-300 ease-in-out", isCollapsed && "w-0 opacity-0 overflow-hidden")}>
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
                    title="添加 Workspace"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {Object.entries(filteredGroups).map(([workspace, list]) => (
                list.length > 0 && (
                  <div key={workspace} className="mb-1">
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
                        className="truncate font-medium flex-1"
                        title={workspace}
                      >
                        {workspace === 'Default' ? workspace : workspace.split('/').pop()}
                      </span>
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
                        {list.map((session) => (
                          <div
                            key={session.id}
                            className={cn(
                              "group flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer transition-all border border-transparent",
                              currentSessionId === session.id
                                ? "text-foreground font-medium bg-muted/40"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            )}
                            onClick={() => onSelectSession(session.id)}
                          >
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              currentSessionId === session.id ? "bg-blue-500" : "bg-transparent group-hover:bg-muted-foreground/30"
                            )} />
                            <span className="truncate flex-1 text-[13px]">{session.title}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
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

            <div className="p-3 border-t bg-card/50 backdrop-blur-sm">
              <button
                onClick={onShowStats}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-sm text-muted-foreground transition-colors"
              >
                <BarChart2 className="w-4 h-4" />
                <span>Usage Dashboard</span>
              </button>
            </div>
          </>
        ) : (
          <FileExplorer className="h-full" initialPath={currentWorkspace || undefined} />
        )}
      </div>
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
    <div
      onClick={onClick}
      className={cn(
        "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 relative group cursor-pointer",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />

      {/* Tooltip */}
      <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-border">
        {label}
      </div>
    </div>
  );
}
