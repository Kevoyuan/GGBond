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
                    "flex items-center justify-between px-4 shrink-0 transition-colors duration-200 ease-in-out border-r drag-region w-[var(--panel-width)]",
                    // When collapsed: match main content background, hide border
                    isCollapsed
                        ? "bg-[var(--bg-primary)] border-r-transparent"
                        : "bg-[var(--bg-secondary)] border-r-[var(--border-subtle)]"
                )}
            >
                {/* Left Group: Info */}
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Traffic Lights - Always visible */}
                    <div className="flex gap-2 shrink-0 group">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57] border-[0.5px] border-[#00000026] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e] border-[0.5px] border-[#00000026] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840] border-[0.5px] border-[#00000026] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                </div>

                {/* Right Group: Actions - Fixed Position */}
                <div className="flex items-center gap-1 shrink-0 no-drag">
                    <button
                        onClick={onNewChat}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                        title="New chat"
                    >
                        <SquarePen className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onToggleCollapse}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
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
            <div className="flex-1 flex items-center justify-between px-4 min-w-0 bg-[var(--bg-primary)] drag-region">
                {/* Left Side (Empty for now) */}
                <div className="flex items-center gap-2 no-drag">
                </div>

                {/* Right Side Info */}
                <div className="flex items-center gap-4 no-drag">
                    {/* Branch Info - Show first */}
                    {onSelectBranch ? (
                        <GitBranchSwitcher
                            branch={currentBranch ?? null}
                            branches={branches}
                            loading={branchLoading}
                            switchingTo={branchSwitchingTo}
                            onSelectBranch={onSelectBranch}
                            onRefresh={onRefreshBranches}
                        />
                    ) : null}

                    {/* Stats - Token Usage Display with Hover Panel */}
                    {stats && (
                        <div className="hidden md:block">
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
