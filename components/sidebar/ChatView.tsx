import React, { useMemo, useState, useCallback } from 'react';
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
import { Tooltip } from '@/components/ui/Tooltip';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

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

export const ChatView = React.memo(function ChatView({
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
    formatSessionAge,
    searchTerm = ''
}: ChatViewProps & { searchTerm?: string }) {
    // Internal state for workspace collapse
    const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set());
    const { pendingId, startDelete, confirmDelete, handleMouseLeave, isPending } = useConfirmDelete<string>();

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

    const hasResults = Object.keys(filteredGroups).length > 0;

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

            <div className="flex-1 overflow-y-auto px-1.5 scrollbar-thin">
                {!hasResults && (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <MessageSquare className="w-8 h-8 text-[var(--text-tertiary)] mb-3 opacity-50" />
                        <p className="text-xs text-[var(--text-tertiary)]">No chats found.</p>
                    </div>
                )}

                {Object.entries(filteredGroups).map(([workspace, list]) => (
                    <div key={workspace} className="mb-2">
                        {/* Workspace Header */}
                        <div
                            className={cn(
                                "group flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md cursor-pointer transition-colors select-none",
                                "hover:bg-[var(--bg-hover)]",
                                currentWorkspace === workspace ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                            )}
                            onClick={() => toggleWorkspace(workspace)}
                        >
                            <span className="text-[var(--text-tertiary)]">
                                {collapsedWorkspaces.has(workspace) ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </span>
                            <Folder className={cn(
                                "w-3.5 h-3.5",
                                currentWorkspace === workspace ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"
                            )} />
                            <span className="text-[12px] font-medium truncate flex-1">
                                {workspace === 'Default' ? 'Default' : workspace.split('/').pop()}
                            </span>

                            {/* Branch Info Badge */}
                            {workspaceBranchSummary[workspace] && (
                                <span className={cn(
                                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border max-w-[100px] truncate",
                                    "bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-tertiary)]"
                                )}>
                                    <GitBranch className="w-2.5 h-2.5" />
                                    <span className="truncate">{workspaceBranchSummary[workspace]?.label}</span>
                                </span>
                            )}

                            <button
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)] transition-all"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNewChatInWorkspace?.(workspace);
                                }}
                                title="New Chat in Workspace"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Session List */}
                        {!collapsedWorkspaces.has(workspace) && (
                            <div className="ml-2 pl-2 border-l border-[var(--border-subtle)] flex flex-col gap-0.5 mt-0.5">
                                {list.map((session) => {
                                    const isSessionRunning = runningSessionIds.includes(session.id);
                                    const isActive = currentSessionId === session.id;
                                    const isUnread = unreadSessionIds.includes(session.id);

                                    return (
                                        <div
                                            key={session.id}
                                            className={cn(
                                                "group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-all border border-transparent select-none",
                                                isActive
                                                    ? "bg-[var(--bg-active)]"
                                                    : "hover:bg-[var(--bg-hover)]"
                                            )}
                                            onClick={() => onSelectSession(session.id)}
                                            onMouseLeave={() => handleMouseLeave(session.id)}
                                        >
                                            {/* Status Dot */}
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

                                            {/* Item Info */}
                                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                                <div className={cn(
                                                    "text-[13px] font-medium truncate leading-none",
                                                    isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                                                )}>
                                                    {session.title}
                                                </div>

                                                <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 opacity-70 group-hover:opacity-0 transition-opacity">
                                                    {formatSessionAge(session)}
                                                </span>
                                            </div>


                                            {/* Delete Action - Absolute Position Overlay to prevent jitter and space compression */}
                                            <div className={cn(
                                                "absolute right-1 top-0 bottom-0 w-14 flex items-center justify-end pr-1 opacity-0 group-hover:opacity-100 transition-all z-10 pointer-events-none",
                                                isPending(session.id) && "opacity-100",
                                                isActive ? "bg-gradient-to-l from-[var(--bg-active)] via-[var(--bg-active)] to-transparent" : "bg-gradient-to-l from-[var(--bg-hover)] via-[var(--bg-hover)] to-transparent"
                                            )}>
                                                {isPending(session.id) ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            confirmDelete(session.id, onDeleteSession);
                                                        }}
                                                        className="pointer-events-auto flex items-center justify-center w-full h-6 rounded bg-[var(--red)] text-white text-[10px] font-medium hover:bg-red-600 transition-colors shadow-sm animate-in fade-in zoom-in-95 duration-200"
                                                    >
                                                        Confirm
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startDelete(session.id);
                                                        }}
                                                        className="pointer-events-auto p-1.5 hover:bg-[var(--bg-tertiary)] hover:text-[var(--red)] rounded transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>


                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

