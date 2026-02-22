import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GitBranchSwitcherProps {
    branch: string | null;
    branches: string[];
    loading?: boolean;
    switchingTo?: string | null;
    onSelectBranch: (branch: string) => Promise<void> | void;
    onRefresh?: () => Promise<void> | void;
    className?: string;
}

export function GitBranchSwitcher({
    branch,
    branches,
    loading = false,
    switchingTo = null,
    onSelectBranch,
    onRefresh,
    className
}: GitBranchSwitcherProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const branchList = useMemo(() => {
        if (!branch) return branches;
        return branches.includes(branch) ? branches : [branch, ...branches];
    }, [branch, branches]);

    if (!branch) return null;

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] h-6 transition-colors',
                    'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                )}
                title="Switch branch"
            >
                <GitBranch className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[140px] truncate font-medium">{branch}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="absolute right-0 mt-1 z-[80] w-64 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] shadow-xl">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border-subtle)]">
                        <span className="text-[11px] font-medium text-[var(--text-secondary)]">Branches</span>
                        <button
                            onClick={() => void onRefresh?.()}
                            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                            title="Refresh branches"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                        </button>
                    </div>

                    <div className="max-h-64 overflow-auto py-1">
                        {branchList.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-[var(--text-tertiary)]">No branches</div>
                        ) : (
                            branchList.map((item) => {
                                const isActive = item === branch;
                                const isSwitching = switchingTo === item;
                                return (
                                    <button
                                        key={item}
                                        onClick={async () => {
                                            await onSelectBranch(item);
                                            setOpen(false);
                                        }}
                                        disabled={isSwitching}
                                        className={cn(
                                            'w-full flex items-center justify-between px-2 py-1.5 text-left text-xs transition-colors',
                                            'hover:bg-[var(--bg-hover)] disabled:opacity-70',
                                            isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                                        )}
                                    >
                                        <span className="truncate">{item}</span>
                                        {isSwitching ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                        ) : isActive ? (
                                            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                        ) : null}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
