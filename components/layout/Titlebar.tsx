import React from 'react';
import { SquarePen, PanelLeftClose, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { GitBranchSwitcher } from './GitBranchSwitcher';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { WorkbenchPanelType } from '@/components/session/SidePanel';

interface TitlebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onNewChat: () => void;
    nativeWindowControls?: boolean;
    stats?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        totalCost: number;
    };
    currentBranch?: string | null;
    branches?: string[];
    uncommitted?: {
        added: number;
        removed: number;
        untracked: number;
        hasChanges: boolean;
    } | null;
    branchLoading?: boolean;
    branchSwitchingTo?: string | null;
    onSelectBranch?: (branch: string) => Promise<void> | void;
    onRefreshBranches?: () => Promise<void> | void;
    currentModel?: string;
    className?: string;
    sidePanelType?: WorkbenchPanelType;
    onToggleSidePanel?: () => void;
}

export const Titlebar = React.memo(function Titlebar({
    isCollapsed,
    onToggleCollapse,
    onNewChat,
    nativeWindowControls = false,
    stats,
    currentBranch,
    branches = [],
    uncommitted = null,
    branchLoading = false,
    branchSwitchingTo = null,
    onSelectBranch,
    onRefreshBranches,
    currentModel = 'Gemini 3 Pro',
    className,
    sidePanelType,
    onToggleSidePanel
}: TitlebarProps) {
    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(
            target.closest('button, input, textarea, select, option, a, [role="button"], [data-no-drag], .no-drag')
        );
    };

    const withWindow = async (fn: (win: ReturnType<typeof getCurrentWindow>) => Promise<void> | void) => {
        try {
            const win = getCurrentWindow();
            await fn(win);
        } catch {
            // noop outside Tauri
        }
    };

    const startDrag = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (isInteractiveTarget(e.target)) return;
        void withWindow((win) => win.startDragging());
    };

    // Keep drag behavior in JS to avoid native drag-region swallowing button clicks in release builds.
    return (
        <div 
            onMouseDown={startDrag}
            className={cn(
                "h-[var(--titlebar-h)] flex items-stretch shrink-0 border-b border-[var(--border-subtle)] select-none z-50",
                isCollapsed ? "bg-[var(--bg-primary)]" : "bg-[var(--bg-secondary)]",
                className
            )}
        >
            {/* Titlebar Left — traffic lights + collapse/expand always visible */}
            <div
                onMouseDown={(e) => {
                    // Keep button clicks from bubbling into the titlebar drag handler.
                    if ((e.target as HTMLElement).closest('button')) {
                        e.stopPropagation();
                    }
                }}
                className={cn(
                    "relative flex items-center gap-1.5 shrink-0 transition-colors duration-200 ease-in-out border-r",
                    isCollapsed
                        ? "pl-4 border-r border-r-transparent"
                        : "w-[var(--panel-width)] px-4 border-r border-r-[var(--border-subtle)]"
                )}
            >
                {/* Traffic lights — always visible */}
                <div className="flex items-center min-w-0 gap-2">
                    {nativeWindowControls ? (
                        <div aria-hidden="true" className="h-3 w-[84px] shrink-0" />
                    ) : (
                        <div
                            className="flex shrink-0 gap-2 group no-drag"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={async () => {
                                    try {
                                        await withWindow((win) => win.close());
                                    } catch {
                                        window.close();
                                    }
                                }}
                                className="w-3 h-3 rounded-full bg-[#ff5f57] border-[0.5px] border-[#00000026] flex items-center justify-center relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
                            >
                                <span className="opacity-0 group-hover:opacity-100 text-[#4c0000] text-[8px] font-extrabold leading-none -translate-y-[0.5px]">×</span>
                            </button>
                            <button
                                onClick={() => void withWindow((win) => win.minimize())}
                                className="w-3 h-3 rounded-full bg-[#febc2e] border-[0.5px] border-[#00000026] flex items-center justify-center relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
                            >
                                <span className="opacity-0 group-hover:opacity-100 text-[#995700] text-[8px] font-extrabold leading-none -translate-y-[0.5px]">−</span>
                            </button>
                            <button
                                onClick={() => void withWindow((win) => win.toggleMaximize())}
                                className="w-3 h-3 rounded-full bg-[#28c840] border-[0.5px] border-[#00000026] flex items-center justify-center relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
                            >
                                <span className="opacity-0 group-hover:opacity-100 text-[#006500] text-[8px] font-extrabold leading-none -translate-y-[0.5px]">+</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Collapse/expand — always visible, fixed right after traffic lights */}
                <button
                    onClick={onToggleCollapse}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0 no-drag focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <PanelLeftClose
                        className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            isCollapsed && "rotate-180"
                        )}
                    />
                </button>

                {/* New chat — expanded only */}
                {!isCollapsed && (
                    <button
                        onClick={onNewChat}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0 no-drag focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
                        title="New chat"
                    >
                        <SquarePen className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Titlebar Right — draggable except on interactive controls */}
            <div className="relative z-10 flex-1 flex items-center justify-end px-4 gap-2 min-w-0">
                {/* Branch Info */}
                {onSelectBranch && (
                    <div className="no-drag" onMouseDown={(e) => e.stopPropagation()}>
                        <GitBranchSwitcher
                            branch={currentBranch ?? null}
                            branches={branches}
                            uncommitted={uncommitted}
                            loading={branchLoading}
                            switchingTo={branchSwitchingTo}
                            onSelectBranch={onSelectBranch}
                            onRefresh={onRefreshBranches}
                        />
                    </div>
                )}

                {/* Token Usage */}
                {stats && (
                    <div className="hidden md:block no-drag" onMouseDown={(e) => e.stopPropagation()}>
                        <TokenUsageDisplay
                            stats={{ ...stats, model: currentModel }}
                            compact={true}
                            floating={true}
                            hover={true}
                            label="Session"
                            hideContextPercentage={true}
                            className="relative"
                        />
                    </div>
                )}

                {/* Divider before Workbench */}
                {onToggleSidePanel && (onSelectBranch || stats) && (
                    <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5 shrink-0" />
                )}

                {/* Workbench Toggle */}
                {onToggleSidePanel && (
                    <button
                        onClick={onToggleSidePanel}
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-md transition-colors shrink-0 no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                            sidePanelType
                                ? "text-[var(--accent)] bg-[var(--accent-subtle)]"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                        )}
                        title={sidePanelType ? "Close Workbench" : "Open Workbench"}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
});
