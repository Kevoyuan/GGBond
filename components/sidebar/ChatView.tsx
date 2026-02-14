import React, { useMemo, useState } from 'react';
import {
    Search,
    FolderPlus,
    ChevronDown,
    ChevronRight,
    Folder,
    Plus,
    GitBranch,
    Trash2,
    TerminalSquare,
    BarChart2,
    MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PanelHeader } from './PanelHeader';

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

interface ChatViewProps {
    sessions: Session[];
    currentSessionId: string | null;
    runningSessionIds?: string[];
    terminalRunningSessionIds?: string[];
    unreadSessionIds?: string[];
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onNewChatInWorkspace?: (workspace: string) => void;
    onAddWorkspace?: () => void;
    onShowStats?: () => void;
    currentWorkspace?: string;
    workspaceBranchSummary: Record<string, { label: string; title: string; mixed: boolean } | null>;
    formatSessionAge: (session: Session) => string;
}

export function ChatView({
    sessions,
    currentSessionId,
    runningSessionIds = [],
    terminalRunningSessionIds = [],
    unreadSessionIds = [],
    onSelectSession,
    onDeleteSession,
    onNewChatInWorkspace,
    onAddWorkspace,
    onShowStats,
    currentWorkspace,
    workspaceBranchSummary,
    formatSessionAge
}: ChatViewProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());
    const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);

    const toggleWorkspace = (workspace: string) => {
        const newCollapsed = new Set(collapsedWorkspaces);
        if (newCollapsed.has(workspace)) {
            newCollapsed.delete(workspace);
        } else {
            newCollapsed.add(workspace);
        }
        setCollapsedWorkspaces(newCollapsed);
    };

    const groupedSessions = useMemo(() => {
        const groups: Record<string, Session[]> = {};
        sessions.forEach(session => {
            const workspace = session.workspace || 'Default';
            if (!groups[workspace]) groups[workspace] = [];
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
        <div className="flex flex-col h-full overflow-hidden">
            <PanelHeader
                title="Chats"
                icon={MessageSquare}
                actions={
                    onAddWorkspace && (
                        <button
                            onClick={onAddWorkspace}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                            title="Add Workspace"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    )
                }
            />

            <div className="px-4 py-3 border-b bg-card/30 backdrop-blur-sm">
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
                <div className="px-3 mb-2 mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Workspaces</span>
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
                                <span className="truncate font-medium flex-1 text-[13px]" title={workspace}>
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
                                        onNewChatInWorkspace?.(workspace);
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
                                                    if (pendingDeleteSessionId === session.id) setPendingDeleteSessionId(null);
                                                }}
                                            >
                                                <div className="relative w-2.5 h-2.5 shrink-0 flex items-center justify-center">
                                                    {isSessionRunning ? (
                                                        <span className="absolute inset-0 rounded-full border border-muted-foreground/40 border-t-transparent animate-spin [animation-duration:1s]" />
                                                    ) : currentSessionId === session.id ? (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                    ) : unreadSessionIds.includes(session.id) ? (
                                                        <span className="w-2 h-2 rounded-full bg-amber-500" title="Unread messages" />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-muted-foreground/30" />
                                                    )}
                                                </div>
                                                <span className="truncate flex-1 text-[13px]">{session.title}</span>
                                                {isTerminalRunning && (
                                                    <span className="inline-flex items-center justify-center shrink-0 text-amber-500/90" title="Terminal running">
                                                        <TerminalSquare className="w-3 h-3" />
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
        </div>
    );
}

