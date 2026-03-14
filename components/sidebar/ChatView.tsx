import React, { useMemo, useState, useCallback } from 'react';
import {
    FolderPlus,
    ChevronDown,
    ChevronRight,
    Folder,
    Plus,
    GitBranch,
    Archive,
    Trash2,
    RotateCcw,
    MessageSquare,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Virtuoso } from 'react-virtuoso';
import { PanelHeader } from './PanelHeader';
import { Tooltip } from '@/components/ui/Tooltip';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

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
    message_count?: number;
}

interface ChatViewProps {
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
    onAddWorkspace?: () => void;
    onShowStats?: () => void;
    currentWorkspace?: string;
    workspaceBranchSummary: Record<string, { label: string; title: string; mixed: boolean } | null>;
    formatSessionAge: (session: Session) => string;
}

export const ChatView = React.memo(function ChatView({
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
    onAddWorkspace,
    onShowStats,
    currentWorkspace,
    workspaceBranchSummary,
    formatSessionAge,
    searchTerm = ''
}: ChatViewProps & { searchTerm?: string }) {
    const UNASSIGNED_WORKSPACE_KEY = '__NO_WORKSPACE__';
    // Internal state for workspace collapse
    const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
    const [showArchived, setShowArchived] = useState(false);

    const VISIBLE_SESSION_LIMIT = 10;

    const toggleExpanded = useCallback((workspace: string) => {
        setExpandedWorkspaces(prev => {
            const next = new Set(prev);
            if (next.has(workspace)) next.delete(workspace);
            else next.add(workspace);
            return next;
        });
    }, []);
    const { pendingId, startDelete, confirmDelete, handleMouseLeave, isPending } = useConfirmDelete<string>();

    const toggleWorkspace = useCallback((workspace: string) => {
        const newCollapsed = new Set(collapsedWorkspaces);
        if (newCollapsed.has(workspace)) {
            newCollapsed.delete(workspace);
        } else {
            newCollapsed.add(workspace);
        }
        setCollapsedWorkspaces(newCollapsed);
    }, [collapsedWorkspaces]);

    // Stable callback for workspace toggle
    const handleToggleWorkspace = useCallback((workspace: string) => {
        toggleWorkspace(workspace);
    }, [toggleWorkspace]);

    // Stable callback for new chat in workspace
    const handleNewChatInWorkspace = useCallback((workspace: string) => {
        onNewChatInWorkspace?.(workspace);
    }, [onNewChatInWorkspace]);

    // Stable callback for session selection
    const handleSelectSession = useCallback((sessionId: string) => {
        onSelectSession(sessionId);
    }, [onSelectSession]);

    // Stable callbacks for delete actions
    const handleStartDelete = useCallback((sessionId: string) => {
        startDelete(sessionId);
    }, [startDelete]);

    const handleConfirmDelete = useCallback((e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        confirmDelete(sessionId, onDeleteSession);
    }, [confirmDelete, onDeleteSession]);

    const activeSessions = useMemo(
        () => sessions.filter((s) => !(s.archived === true || s.archived === 1)),
        [sessions]
    );

    const archivedSessions = useMemo(
        () => sessions.filter((s) => s.archived === true || s.archived === 1),
        [sessions]
    );

    const groupedSessions = useMemo(() => {
        const groups: Record<string, Session[]> = {};
        activeSessions.forEach(session => {
            const workspace = session.workspace || UNASSIGNED_WORKSPACE_KEY;
            if (!groups[workspace]) groups[workspace] = [];
            groups[workspace].push(session);
        });
        return groups;
    }, [activeSessions]);

    const filteredGroups = useMemo(() => {
        if (!searchTerm) return groupedSessions;
        const result: Record<string, Session[]> = {};
        Object.entries(groupedSessions).forEach(([key, list]) => {
            const filtered = list.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));
            if (filtered.length > 0) result[key] = filtered;
        });
        return result;
    }, [groupedSessions, searchTerm]);

    const filteredArchivedSessions = useMemo(() => {
        if (!searchTerm) return archivedSessions;
        const q = searchTerm.toLowerCase();
        return archivedSessions.filter((s) => s.title.toLowerCase().includes(q));
    }, [archivedSessions, searchTerm]);

    const hasResults = Object.keys(filteredGroups).length > 0 || filteredArchivedSessions.length > 0;

    const listItems = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = [];

        Object.entries(filteredGroups).forEach(([workspace, list]) => {
            items.push({ type: 'workspace', workspace, sessionCount: list.length });

            if (!collapsedWorkspaces.has(workspace)) {
                const isExpanded = expandedWorkspaces.has(workspace) || !!searchTerm;
                const visibleList = isExpanded ? list : list.slice(0, VISIBLE_SESSION_LIMIT);
                const hiddenCount = list.length - VISIBLE_SESSION_LIMIT;
                const showExpandButton = !searchTerm && hiddenCount > 0;

                visibleList.forEach((session, index) => {
                    const isFirst = index === 0;
                    const isLast = index === visibleList.length - 1 && !showExpandButton;
                    items.push({ type: 'session', session, workspace, isFirst, isLast });
                });

                if (showExpandButton) {
                    items.push({ type: 'expandBtn', workspace, hiddenCount, isExpanded, isLast: true });
                }
            }
        });

        if (filteredArchivedSessions.length > 0) {
            items.push({ type: 'archivedHeader', count: filteredArchivedSessions.length });
            if (showArchived) {
                filteredArchivedSessions.forEach((session, index) => {
                    items.push({ type: 'archivedSession', session, isFirst: index === 0, isLast: index === filteredArchivedSessions.length - 1 });
                });
            }
        }

        return items;
    }, [
        filteredGroups,
        collapsedWorkspaces,
        expandedWorkspaces,
        searchTerm,
        filteredArchivedSessions,
        showArchived
    ]);

    const renderItem = useCallback((index: number, item: any) => {
        if (item.type === 'workspace') {
            const { workspace } = item;
            return (
                <div
                    className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 mt-2 mb-0.5 rounded-md cursor-pointer transition-colors select-none",
                        "hover:bg-[var(--bg-hover)]",
                        currentWorkspace === workspace ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                    )}
                    onClick={() => handleToggleWorkspace(workspace)}
                >
                    <span className="text-[var(--text-tertiary)] shrink-0">
                        {collapsedWorkspaces.has(workspace) ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                    <Folder className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        currentWorkspace === workspace ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"
                    )} />
                    <span className="text-[12px] font-medium truncate flex-1">
                        {workspace === UNASSIGNED_WORKSPACE_KEY ? 'Unassigned' : workspace.split('/').pop()}
                    </span>

                    {workspaceBranchSummary[workspace] && (
                        <span className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border max-w-[100px] truncate shrink-0",
                            "bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-tertiary)]"
                        )}>
                            <GitBranch className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{workspaceBranchSummary[workspace]?.label}</span>
                        </span>
                    )}

                    {workspace !== UNASSIGNED_WORKSPACE_KEY && (
                        <button
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] transition-colors shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleNewChatInWorkspace(workspace);
                            }}
                            title="New Chat in Workspace"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {workspace !== UNASSIGNED_WORKSPACE_KEY && onArchiveWorkspace && (
                        <button
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--red)] rounded text-[var(--text-secondary)] transition-colors shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onArchiveWorkspace(workspace);
                            }}
                            title="Archive Workspace Chats"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            );
        }

        if (item.type === 'session') {
            const { session, isFirst, isLast } = item;
            const isSessionRunning = runningSessionIds.includes(session.id);
            const isActive = currentSessionId === session.id;
            const isUnread = unreadSessionIds.includes(session.id);

            return (
                <div className={cn("ml-2 pl-2 border-l border-[var(--border-subtle)]", isFirst && "pt-0.5", isLast && "pb-0.5")}>
                    <div
                        className={cn(
                            "group relative flex items-center gap-2.5 px-2 py-1.5 mb-0.5 rounded-md cursor-pointer transition-colors border border-transparent select-none",
                            isActive ? "bg-[var(--bg-active)]" : "hover:bg-[var(--bg-hover)]"
                        )}
                        onClick={() => handleSelectSession(session.id)}
                        onMouseLeave={() => handleMouseLeave(session.id)}
                    >
                        <div className="shrink-0">
                            {isSessionRunning ? (
                                <div className="w-2 h-2 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                            ) : isUnread ? (
                                <div className="w-2 h-2 rounded-full bg-[var(--orange)] shadow-[0_0_4px_rgba(251,146,60,0.4)]" />
                            ) : isActive ? (
                                <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_4px_rgba(124,92,252,0.4)]" />
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-[var(--border)] group-hover:bg-[var(--text-tertiary)] transition-colors" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <div className={cn(
                                "text-[13px] font-medium truncate leading-none",
                                isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                            )}>
                                {session.title}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 opacity-70 group-hover:opacity-0 transition-opacity">
                                {typeof session.message_count === 'number' && (
                                    <span className="text-[10px] text-[var(--text-tertiary)] min-w-[1.2rem] text-right">
                                        {session.message_count}
                                    </span>
                                )}
                                <span className="text-[10px] text-[var(--text-tertiary)]">
                                    {formatSessionAge(session)}
                                </span>
                            </div>
                        </div>
                        <div className={cn(
                            "absolute right-1 top-0 bottom-0 w-14 flex items-center justify-end pr-1 opacity-0 group-hover:opacity-100 transition-colors z-10 pointer-events-none",
                            isPending(session.id) && "opacity-100",
                            isActive ? "bg-gradient-to-l from-[var(--bg-active)] via-[var(--bg-active)] to-transparent" : "bg-gradient-to-l from-[var(--bg-hover)] via-[var(--bg-hover)] to-transparent"
                        )}>
                            {isPending(session.id) ? (
                                <button
                                    onClick={(e) => handleConfirmDelete(e, session.id)}
                                    className="pointer-events-auto flex items-center justify-center w-full h-6 rounded bg-[var(--red)] text-white text-[10px] font-medium hover:bg-red-600 transition-colors shadow-sm animate-in fade-in zoom-in-95 duration-200"
                                >
                                    Archive
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartDelete(session.id);
                                    }}
                                    className="pointer-events-auto p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--orange)] rounded transition-colors"
                                    title="Archive Chat"
                                >
                                    <Archive className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (item.type === 'expandBtn') {
            const { workspace, hiddenCount, isExpanded, isLast } = item;
            return (
                <div className={cn("ml-2 pl-2 border-l border-[var(--border-subtle)]", isLast && "pb-0.5")}>
                    <button
                        onClick={() => toggleExpanded(workspace)}
                        className="flex w-full items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors text-[12px] select-none"
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        {isExpanded ? '收起' : `展开显示 (${hiddenCount})`}
                    </button>
                </div>
            );
        }

        if (item.type === 'archivedHeader') {
            return (
                <div className="mt-4 mb-1">
                    <button
                        onClick={() => setShowArchived((prev) => !prev)}
                        className="w-full group flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md transition-colors hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                    >
                        <span className="text-[var(--text-tertiary)]">
                            {showArchived ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </span>
                        <Archive className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider flex-1 text-left">
                            Archived
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">{item.count}</span>
                    </button>
                </div>
            );
        }

        if (item.type === 'archivedSession') {
            const { session, isFirst, isLast } = item;
            return (
                <div className={cn("ml-2 pl-2 border-l border-[var(--border-subtle)]", isFirst && "pt-0.5", isLast && "pb-0.5")}>
                    <div className="group relative flex items-center gap-2.5 px-2 py-1.5 mb-0.5 rounded-md border border-transparent hover:bg-[var(--bg-hover)]">
                        <div className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]/40 shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <div className="text-[13px] font-medium truncate leading-none text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                                {session.title}
                            </div>
                            <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 opacity-70">
                                {formatSessionAge(session)}
                            </span>
                        </div>
                        {onRestoreSession && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRestoreSession(session.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)]"
                                title="Restore Chat"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    }, [
        currentWorkspace, collapsedWorkspaces, workspaceBranchSummary,
        runningSessionIds, currentSessionId, unreadSessionIds, isPending,
        handleSelectSession, handleMouseLeave, handleConfirmDelete,
        handleStartDelete, formatSessionAge, toggleExpanded,
        showArchived, onRestoreSession, onArchiveWorkspace, handleNewChatInWorkspace,
        handleToggleWorkspace
    ]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-2 shrink-0 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Recent Chats
                </h3>
                {onAddWorkspace && (
                    <button
                        onClick={onAddWorkspace}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                        title="Add Workspace"
                    >
                        <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden px-1.5">
                {!hasResults && (
                    <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                        <MessageSquare className="w-8 h-8 text-[var(--text-tertiary)] mb-3 opacity-50" />
                        <p className="text-xs text-[var(--text-tertiary)]">No chats found.</p>
                    </div>
                )}
                {hasResults && (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={listItems}
                        itemContent={renderItem}
                        className="scrollbar-thin"
                    />
                )}
            </div>
        </div>
    );
});
