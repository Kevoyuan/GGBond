'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModuleCard } from './ModuleCard';
import { Sparkles, Loader2, RefreshCw, Trash2, BookOpen, Search, CheckCircle2, Ban, Plus, SlidersHorizontal, Puzzle, ExternalLink, Edit, PlusCircle, Layers, Globe, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PanelHeader } from '../sidebar/PanelHeader';
import { SkillPreviewDialog } from '../SkillPreviewDialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

interface Skill {
    id: string;
    name: string;
    status: 'Enabled' | 'Disabled';
    isBuiltIn: boolean;
    description: string;
    location: string;
    scope: 'global' | 'project';
}

interface SkillSource {
    configuredPath: string;
    resolvedPath: string | null;
    exists: boolean;
}

interface SkillsManagerProps {
    compact?: boolean;
    className?: string;
    search?: string;
}

const SkillItem = memo(function SkillItem({
    skill,
    selected,
    onSelect,
    onUse,
    onAction,
    actionLoading,
    isPending,
    onConfirmDelete,
    onStartDelete,
    onMouseLeave
}: {
    skill: Skill;
    selected: boolean;
    onSelect: (skill: Skill) => void;
    onUse: (e: React.MouseEvent, id: string) => void;
    onAction: (action: string, id: string) => void;
    actionLoading: string | null;
    isPending: (id: string) => boolean;
    onConfirmDelete: (id: string, cb: (id: string) => void) => void;
    onStartDelete: (id: string) => void;
    onMouseLeave: (id: string) => void;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -2 }}
            className={cn(
                "group relative p-3 rounded-xl transition-all duration-300 cursor-pointer border",
                selected
                    ? "bg-blue-50/80 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/50 shadow-md ring-1 ring-blue-500/10"
                    : "bg-white/60 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
            )}
            onClick={() => onSelect(skill)}
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            skill.status === 'Enabled'
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "bg-zinc-300 dark:bg-zinc-700"
                        )} />
                        <h3 className="font-bold text-[12px] text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {skill.name}
                        </h3>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {skill.status === 'Enabled' && (
                            <button
                                onClick={(e) => onUse(e, skill.id)}
                                className="p-1 text-zinc-400 hover:text-blue-600 rounded-md"
                                title="Add to chat"
                            >
                                <PlusCircle size={14} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onAction(skill.status === 'Enabled' ? 'disable' : 'enable', skill.id); }}
                            className={cn(
                                "p-1 rounded-md transition-colors",
                                skill.status === 'Enabled' ? "text-zinc-400 hover:text-amber-600" : "text-zinc-400 hover:text-emerald-600"
                            )}
                            disabled={actionLoading?.includes(skill.id)}
                        >
                            {actionLoading?.includes(skill.id) ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                skill.status === 'Enabled' ? <Ban size={12} /> : <CheckCircle2 size={12} />
                            )}
                        </button>
                        {!skill.isBuiltIn && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onStartDelete(skill.id); }}
                                className="p-1 text-zinc-400 hover:text-red-600 rounded-md"
                                title="Uninstall"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed h-[30px]">
                    {skill.description || 'No description provided'}
                </p>

                {isPending(skill.id) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-red-500/90 dark:bg-red-600/90 rounded-xl flex items-center justify-center gap-2 z-10"
                    >
                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">Confirm Delete?</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onConfirmDelete(skill.id, (id) => onAction('uninstall', id)); }}
                            className="px-2 py-0.5 bg-white text-red-600 rounded text-[9px] font-bold"
                        >
                            YES
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMouseLeave(skill.id); }}
                            className="px-2 py-0.5 bg-red-800 text-white rounded text-[9px] font-bold"
                        >
                            NO
                        </button>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
});

export const SkillsManager = memo(function SkillsManager({ compact = false, className, search: externalSearch }: SkillsManagerProps = {}) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [sources, setSources] = useState<SkillSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'project'>('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [internalSearch, setInternalSearch] = useState('');
    const [installSource, setInstallSource] = useState('');

    const search = externalSearch !== undefined ? externalSearch : internalSearch;
    const [linkSource, setLinkSource] = useState('');
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionMessageIsError, setActionMessageIsError] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const { pendingId, startDelete, confirmDelete, handleMouseLeave, isPending } = useConfirmDelete<string>();
    const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [displayLimit, setDisplayLimit] = useState(40);

    const fetchSkills = () => {
        setLoading(true);
        fetch('/api/skills?meta=1')
            .then(r => r.json())
            .then(data => {
                const normalizeSkills = (items: unknown[]): Skill[] => {
                    return items
                        .filter((item): item is Partial<Skill> & { id: string; name: string } => {
                            if (!item || typeof item !== 'object') return false;
                            const record = item as Record<string, unknown>;
                            return typeof record.id === 'string' && typeof record.name === 'string';
                        })
                        .map((item) => ({
                            id: item.id,
                            name: item.name,
                            status: item.status === 'Disabled' ? 'Disabled' : 'Enabled',
                            isBuiltIn: Boolean(item.isBuiltIn),
                            description: typeof item.description === 'string' ? item.description : '',
                            location: typeof item.location === 'string' ? item.location : '',
                            scope: item.scope === 'project' ? 'project' : 'global',
                        }));
                };

                if (Array.isArray(data)) {
                    setSkills(normalizeSkills(data));
                    setSources([]);
                    return;
                }
                setSkills(normalizeSkills(Array.isArray(data?.skills) ? data.skills : []));
                setSources(Array.isArray(data?.sources) ? data.sources : []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSkills(); }, []);

    const handleAction = useCallback(async (action: string, name?: string) => {
        if ((action === 'enable' || action === 'disable' || action === 'uninstall') && !name) return;
        if (action === 'install' && !installSource.trim()) return;
        if ((action === 'link_dir' || action === 'unlink_dir') && !linkSource.trim()) return;
        try {
            setActionMessage(null);
            setActionMessageIsError(false);
            const sourceValue = action === 'install' ? installSource.trim()
                : (action === 'link_dir' || action === 'unlink_dir') ? linkSource.trim()
                    : undefined;
            const id = `${action}:${name || sourceValue || ''}`;
            setActionLoading(id);
            const res = await fetch('/api/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, name, source: sourceValue || undefined }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setActionMessage(typeof data?.error === 'string' ? data.error : 'Skill action failed');
                setActionMessageIsError(true);
                return;
            }
            if (typeof data?.message === 'string' && data.message.trim()) {
                setActionMessage(data.message);
            }
            if (action === 'install') setInstallSource('');
            if (action === 'link_dir' || action === 'unlink_dir') setLinkSource('');
            fetchSkills();
        } catch (err) {
            setActionMessage(err instanceof Error ? err.message : 'Network error, please retry');
            setActionMessageIsError(true);
        }
        finally { setActionLoading(null); }
    }, [installSource, linkSource]);

    const handleUseSkill = useCallback((e: React.MouseEvent, skillId: string) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('insert-skill-token', { detail: { skillId } }));
    }, []);

    const scopeFilteredSkills = useMemo(() =>
        skills.filter((skill) => scopeFilter === 'all' ? true : skill.scope === scopeFilter),
        [skills, scopeFilter]
    );

    const filteredSkills = useMemo(() =>
        scopeFilteredSkills.filter((skill) => {
            if (statusFilter === 'enabled' && skill.status !== 'Enabled') return false;
            if (statusFilter === 'disabled' && skill.status !== 'Disabled') return false;
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (
                skill.name.toLowerCase().includes(q) ||
                skill.description.toLowerCase().includes(q) ||
                skill.location.toLowerCase().includes(q)
            );
        }),
        [scopeFilteredSkills, statusFilter, search]
    );

    const enabledCount = useMemo(() =>
        scopeFilteredSkills.filter((s) => s.status === 'Enabled').length,
        [scopeFilteredSkills]
    );
    const disabledCount = scopeFilteredSkills.length - enabledCount;
    const displaySources = useMemo(() => {
        const seen = new Set<string>();
        return sources
            .map((source) => ({
                key: source.resolvedPath || source.configuredPath,
                exists: source.exists,
            }))
            .filter((item) => {
                if (seen.has(item.key)) return false;
                seen.add(item.key);
                return true;
            });
    }, [sources]);

    const body = (
        <div className={cn("space-y-4 flex flex-col min-h-0 overflow-hidden", compact ? "flex-1" : "h-full")}>
            <div className="space-y-3 pb-1">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setStatusFilter(prev => prev === 'enabled' ? 'all' : 'enabled')}
                        className={cn(
                            "px-3 py-2.5 rounded-xl border transition-all duration-200 text-left group relative overflow-hidden",
                            statusFilter === 'enabled'
                                ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                : "border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/40 hover:border-emerald-500/30 hover:bg-emerald-500/5"
                        )}
                    >
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center justify-between mb-0.5">
                            Active
                            {statusFilter === 'enabled' && <CheckCircle2 size={12} className="text-emerald-500 animate-in fade-in zoom-in-50" />}
                        </div>
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">{enabledCount}</div>
                    </button>
                    <button
                        onClick={() => setStatusFilter(prev => prev === 'disabled' ? 'all' : 'disabled')}
                        className={cn(
                            "px-3 py-2.5 rounded-xl border transition-all duration-200 text-left group relative overflow-hidden",
                            statusFilter === 'disabled'
                                ? "border-zinc-400/50 bg-zinc-400/10 shadow-[0_0_15px_rgba(161,161,170,0.1)]"
                                : "border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-900/40 hover:border-zinc-400/30 hover:bg-zinc-400/5"
                        )}
                    >
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center justify-between mb-0.5">
                            Disabled
                            {statusFilter === 'disabled' && <Ban size={12} className="text-zinc-500 animate-in fade-in zoom-in-50" />}
                        </div>
                        <div className="text-xl font-bold text-zinc-600 dark:text-zinc-400 font-mono tracking-tight">{disabledCount}</div>
                    </button>
                </div>

                <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg relative overflow-hidden">
                    {[
                        { key: 'all', label: 'All', count: skills.length, icon: Layers },
                        { key: 'project', label: 'Project', count: skills.filter(s => s.scope === 'project').length, icon: FolderOpen },
                        { key: 'global', label: 'Global', count: skills.filter(s => s.scope === 'global').length, icon: Globe },
                    ].map((item) => (
                        <Tooltip key={item.key} content={item.label} delay={0} triggerClassName="flex-1 w-full" side="top">
                            <button
                                onClick={() => setScopeFilter(item.key as 'all' | 'project' | 'global')}
                                className={cn(
                                    "relative px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 z-10 transition-colors w-full",
                                    scopeFilter === item.key ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                {scopeFilter === item.key && (
                                    <motion.div
                                        layoutId="skillScopeTab"
                                        className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-md shadow-sm"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                                    />
                                )}
                                <item.icon size={14} className="relative z-10" />
                                {!compact && <span className="relative z-10">{item.label}</span>}
                                <span className={cn(
                                    "relative z-10 px-1 py-0.5 rounded text-[9px] min-w-[16px] text-center font-mono leading-none transition-colors",
                                    scopeFilter === item.key ? "bg-zinc-200/50 dark:bg-zinc-900/30" : "bg-zinc-200 dark:bg-zinc-800"
                                )}>
                                    {item.count}
                                </span>
                            </button>
                        </Tooltip>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 space-y-4 pr-1">
                <AnimatePresence mode="wait">
                    {showAdvanced && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden"
                        >
                            <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 space-y-4 mb-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                                    <SlidersHorizontal size={14} className="text-zinc-500" />
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Advanced Console</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                            <Plus size={12} className="text-blue-500" /> Install Skill
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={installSource}
                                                onChange={(e) => setInstallSource(e.target.value)}
                                                placeholder="GitHub URL or local path"
                                                className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono"
                                            />
                                            <button
                                                onClick={() => handleAction('install')}
                                                disabled={!installSource.trim() || actionLoading === `install:${installSource}`}
                                                className="w-full px-4 py-2 text-[10px] rounded-lg bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                {actionLoading?.startsWith('install:') ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                Install
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                            <Puzzle size={12} className="text-amber-500" /> External Directory
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={linkSource}
                                                onChange={(e) => setLinkSource(e.target.value)}
                                                placeholder="~/.claude/skills"
                                                className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleAction('link_dir')}
                                                    disabled={!linkSource.trim() || actionLoading === `link_dir:${linkSource.trim()}`}
                                                    className="px-3 py-2 text-[10px] rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors border border-zinc-200 dark:border-zinc-700"
                                                >
                                                    Link
                                                </button>
                                                <button
                                                    onClick={() => handleAction('unlink_dir')}
                                                    disabled={!linkSource.trim() || actionLoading === `unlink_dir:${linkSource.trim()}`}
                                                    className="px-3 py-2 text-[10px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
                                                >
                                                    Unlink
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {actionMessage && (
                                    <div className={cn(
                                        "text-[10px] font-bold uppercase tracking-tight rounded-lg border px-3 py-2 flex items-start gap-2 animate-in zoom-in-95 duration-200",
                                        actionMessageIsError ? "border-red-500/30 text-red-600 bg-red-500/5 dark:text-red-400" : "border-emerald-500/30 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400"
                                    )}>
                                        {actionMessageIsError ? <Ban size={12} className="mt-0.5" /> : <CheckCircle2 size={12} className="mt-0.5" />}
                                        <span className="flex-1 leading-normal">{actionMessage}</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={cn("relative min-h-0", compact ? "flex-1" : "")}>
                    <div className={cn("grid grid-cols-1 gap-3 px-1 py-1 custom-scrollbar", compact ? "h-full overflow-y-auto" : "max-h-[450px] overflow-y-auto")}>
                        <AnimatePresence mode="popLayout">
                            {filteredSkills.length === 0 ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="col-span-full text-center py-10 opacity-30 grayscale flex flex-col items-center"
                                >
                                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3">
                                        <Puzzle size={24} className="text-zinc-500" />
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No matching skills</p>
                                </motion.div>
                            ) : (
                                filteredSkills.slice(0, displayLimit).map((skill) => (
                                    <SkillItem
                                        key={skill.id}
                                        skill={skill}
                                        selected={selectedSkill?.id === skill.id}
                                        onSelect={setSelectedSkill}
                                        onUse={handleUseSkill}
                                        onAction={handleAction}
                                        actionLoading={actionLoading}
                                        isPending={isPending}
                                        onConfirmDelete={confirmDelete}
                                        onStartDelete={startDelete}
                                        onMouseLeave={handleMouseLeave}
                                    />
                                ))
                            )}
                            {displayLimit < filteredSkills.length && (
                                <motion.div key="load-more" layout className="col-span-full py-4 text-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 40)}
                                        className="px-6 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
                                    >
                                        Load More ({filteredSkills.length - displayLimit} remaining)
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );

    const headerActions = (
        <div className="flex items-center gap-1">
            <button
                onClick={() => setShowAdvanced((prev) => !prev)}
                className={cn(
                    "p-1.5 rounded-lg transition-colors border",
                    showAdvanced ? "bg-blue-600 text-white border-blue-600 shadow-inner" : "text-zinc-500 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900"
                )}
                title="Advanced Console"
            >
                <SlidersHorizontal size={14} />
            </button>
            <button
                onClick={fetchSkills}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-600 transition-colors"
                title="Sync Registry"
            >
                <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
        </div>
    );

    if (compact) {
        return (
            <div className={cn("flex flex-col h-full bg-card/30", className)}>
                <PanelHeader title="Skills Registry" icon={Puzzle} badge={skills.length} actions={headerActions} />
                <div className="flex-1 min-h-0 p-4">
                    {loading && skills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <Loader2 size={24} className="animate-spin mb-3 text-blue-500" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-center text-zinc-500">Syncing Registry...</p>
                        </div>
                    ) : (
                        body
                    )}
                </div>
                <SkillPreviewDialog open={!!selectedSkill} onOpenChange={(open) => !open && setSelectedSkill(null)} skill={selectedSkill} />
            </div>
        );
    }

    return (
        <ModuleCard title="Skills Registry" description={loading ? "Syncing..." : `${skills.length} modules · ${enabledCount} active`} icon={Puzzle} actions={headerActions}>
            {loading && skills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Loader2 size={24} className="animate-spin mb-3 text-blue-500" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Syncing Modules...</p>
                </div>
            ) : (
                body
            )}
            <SkillPreviewDialog open={!!selectedSkill} onOpenChange={(open) => !open && setSelectedSkill(null)} skill={selectedSkill} />
        </ModuleCard>
    );
});
