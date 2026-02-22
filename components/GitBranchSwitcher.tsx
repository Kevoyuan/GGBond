import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, GitBranch, Loader2, RefreshCw, Search, Plus } from 'lucide-react';
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
    const [searchQuery, setSearchQuery] = useState('');
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
        let list = branches;
        if (branch && !list.includes(branch)) {
            list = [branch, ...list];
        }
        if (!searchQuery) return list;
        return list.filter(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [branch, branches, searchQuery]);

    if (!branch) return null;

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    'group flex items-center gap-1.5 px-2 py-1 text-[12px] h-7 transition-all duration-200 overflow-hidden relative rounded-md',
                    'hover:bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
                title="Switch branch"
            >
                <GitBranch className="w-3.5 h-3.5 shrink-0 transition-colors" />
                <span className="max-w-[140px] truncate font-semibold tracking-tight">{branch}</span>
                <ChevronDown className={cn('w-3 h-3 shrink-0 opacity-40 transition-transform duration-300', open && 'rotate-180')} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 z-[100] w-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/98 dark:bg-black/98 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Search Area */}
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800/80">
                        <div className="relative group/search">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 group-focus-within/search:text-zinc-600 dark:group-focus-within/search:text-zinc-200 transition-colors" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search branches..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-100/50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 border border-zinc-200 dark:border-zinc-800/50 focus:border-zinc-300 dark:focus:border-zinc-600/80 rounded-lg py-1.5 pl-8 pr-3 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/50 dark:bg-zinc-900/40">
                        <span>Branches</span>
                        <button
                            onClick={() => void onRefresh?.()}
                            className="p-1 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60 text-zinc-400 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
                        >
                            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
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
                                            'w-full flex items-center justify-between px-3 py-3 text-left transition-all duration-200 relative group/item',
                                            'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 disabled:opacity-50',
                                            isActive ? 'bg-zinc-100/80 dark:bg-zinc-800/40' : ''
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <GitBranch className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500 group-hover/item:text-zinc-600 dark:group-hover/item:text-zinc-300")} />
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn("truncate tracking-tight transition-colors font-medium text-[14px]", isActive ? "text-zinc-900 dark:text-white font-bold" : "text-zinc-600 dark:text-zinc-300 group-hover/item:text-zinc-900 dark:group-hover/item:text-white")}>
                                                    {item}
                                                </span>
                                                {/* Mocked uncommitted info if it's the current branch for visual flair */}
                                                {isActive && (
                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                        Uncommited: <span className="text-emerald-600 dark:text-emerald-400">+14</span> <span className="text-rose-600 dark:text-rose-400">-2</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isSwitching ? (
                                            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-zinc-400" />
                                        ) : isActive ? (
                                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700/50 shadow-sm border border-zinc-300 dark:border-white/10">
                                                <Check className="w-3 h-3 shrink-0 text-zinc-900 dark:text-white" />
                                            </div>
                                        ) : null}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Bottom Action */}
                    <div className="p-1.5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/60">
                        <button className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/80 rounded-lg transition-all group/new">
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                            <span>Create and checkout new branch...</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
