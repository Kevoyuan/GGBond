import React from 'react';
import { SquarePen, PanelLeftClose, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { GitBranchSwitcher } from './GitBranchSwitcher';

interface TitlebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onNewChat: () => void;
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
}

export const Titlebar = React.memo(function Titlebar({
    isCollapsed,
    onToggleCollapse,
    onNewChat,
    stats,
    currentBranch,
    branches = [],
    uncommitted = null,
    branchLoading = false,
    branchSwitchingTo = null,
    onSelectBranch,
    onRefreshBranches,
    currentModel = 'Gemini 3 Pro',
    className
}: TitlebarProps) {
    return (
        <div className={cn(
            "h-[var(--titlebar-h)] flex items-stretch shrink-0 border-b border-[var(--border-subtle)] select-none bg-[var(--bg-secondary)] z-50",
            className
        )}>
            {/* Titlebar Left - Fixed at Panel Width */}
            <div
                className={cn(
                    "relative z-20 flex items-center justify-between px-4 shrink-0 transition-colors duration-200 ease-in-out border-r w-[var(--panel-width)]",
                    // When collapsed: match main content background, hide border
                    isCollapsed
                        ? "bg-[var(--bg-primary)] border-r-transparent"
                        : "bg-[var(--bg-secondary)] border-r-[var(--border-subtle)]"
                )}
            >
                {/* Drag Region Background */}
                <div data-tauri-drag-region className="absolute inset-0 z-0" />

                {/* Left Group: Info */}
                <div className="flex items-center gap-3 overflow-hidden pl-2 relative z-10 pointer-events-none">
                    {/* Traffic Lights - Custom implementation for Frameless mode */}
                    <div className="flex gap-2 shrink-0 group no-drag pointer-events-auto">
                        <button
                            onClick={async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); getCurrentWindow().close(); }}
                            className="w-3 h-3 rounded-full bg-[#ff5f57] border-[0.5px] border-[#00000026] flex items-center justify-center relative focus:outline-none"
                        >
                            <span className="opacity-0 group-hover:opacity-100 text-[#4c0000] text-[8px] font-extrabold leading-none -translate-y-[0.5px]">×</span>
                        </button>
                        <button
                            onClick={async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); getCurrentWindow().minimize(); }}
                            className="w-3 h-3 rounded-full bg-[#febc2e] border-[0.5px] border-[#00000026] flex items-center justify-center relative focus:outline-none"
                        >
                            <span className="opacity-0 group-hover:opacity-100 text-[#995700] text-[8px] font-extrabold leading-none -translate-y-[0.5px]">−</span>
                        </button>
                        <button
                            onClick={async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); getCurrentWindow().toggleMaximize(); }}
                            className="w-3 h-3 rounded-full bg-[#28c840] border-[0.5px] border-[#00000026] flex items-center justify-center relative focus:outline-none"
                        >
                            <span className="opacity-0 group-hover:opacity-100 text-[#006500] text-[8px] font-extrabold leading-none -translate-y-[0.5px]">+</span>
                        </button>
                    </div>
                </div>

                {/* Right Group: Actions - Fixed Position */}
                <div className="flex items-center gap-1 shrink-0 no-drag relative z-30 pointer-events-none">
                    <button
                        onClick={onNewChat}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors pointer-events-auto"
                        title="New chat"
                    >
                        <SquarePen className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onToggleCollapse}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors pointer-events-auto"
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <PanelLeftClose
                            className={cn(
                                "w-4 h-4 transition-transform duration-200",
                                isCollapsed && "rotate-180"
                            )}
                        />
                    </button>
                </div>
            </div>

            {/* Titlebar Right */}
            <div className="relative z-10 flex-1 flex items-center justify-between px-4 min-w-0 bg-[var(--bg-primary)]">
                {/* Drag Region Background */}
                <div data-tauri-drag-region className="absolute inset-0 z-0" />

                {/* Left Side (Empty for now) */}
                <div className="flex items-center gap-2 no-drag relative z-10 pointer-events-none">
                </div>

                {/* Right Side Info */}
                <div className="flex items-center gap-4 no-drag relative z-10 pointer-events-none">
                    {/* Branch Info - Show first */}
                    {onSelectBranch ? (
                        <div className="pointer-events-auto">
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
                    ) : null}

                    {/* Stats - Token Usage Display with Hover Panel */}
                    {stats && (
                        <div className="hidden md:block pointer-events-auto">
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
                </div>
            </div>
        </div>
    );
});
