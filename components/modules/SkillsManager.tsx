'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

export function SkillsManager({ compact = false, className, search: externalSearch }: SkillsManagerProps = {}) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [sources, setSources] = useState<SkillSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'project'>('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [internalSearch, setInternalSearch] = useState('');
    const [installSource, setInstallSource] = useState('');

    // Use external search if provided, otherwise use internal state
    const search = externalSearch !== undefined ? externalSearch : internalSearch;
    const [linkSource, setLinkSource] = useState('');
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionMessageIsError, setActionMessageIsError] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const { pendingId, startDelete, confirmDelete, handleMouseLeave, isPending } = useConfirmDelete<string>();
    const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

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

    const handleAction = async (action: string, name?: string) => {
        if ((action === 'enable' || action === 'disable' || action === 'uninstall') && !name) return;
        if (action === 'install' && !installSource.trim()) return;
        if ((action === 'link_dir' || action === 'unlink_dir') && !linkSource.trim()) return;
        // if (action === 'uninstall' && name && !confirm(`Uninstall skill "${name}"?`)) return; // Logic handled by UI confirm now
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
    };

    const handleUseSkill = (e: React.MouseEvent, skillId: string) => {
        e.stopPropagation();
        const event = new CustomEvent('insert-skill-token', {
            detail: { skillId }
        });
        window.dispatchEvent(event);
    };

    const handleEditSkill = async (e: React.MouseEvent, location: string) => {
        e.stopPropagation();
        if (!location) return;
        try {
            await fetch('/api/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: location })
            });
        } catch (error) {
            console.error("Failed to open file", error);
        }
    };

    const scopeFilteredSkills = skills.filter((skill) => {
        return scopeFilter === 'all' ? true : skill.scope === scopeFilter;
    });

    const filteredSkills = scopeFilteredSkills.filter((skill) => {
        if (statusFilter === 'enabled' && skill.status !== 'Enabled') return false;
        if (statusFilter === 'disabled' && skill.status !== 'Disabled') return false;

        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            skill.name.toLowerCase().includes(q) ||
            skill.description.toLowerCase().includes(q) ||
            skill.location.toLowerCase().includes(q)
        );
    });

    const enabledCount = scopeFilteredSkills.filter((s) => s.status === 'Enabled').length;
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
        <div className="space-y-4 flex flex-col h-full overflow-hidden">
            {/* Fixed Header Section for Stability */}
            <div className="space-y-4 pb-1">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setStatusFilter(prev => prev === 'enabled' ? 'all' : 'enabled')}
                        className={cn(
                            "px-3 py-2.5 rounded-xl border transition-all text-left group",
                            statusFilter === 'enabled'
                                ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                : "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 hover:border-emerald-500/40"
                        )}
                    >
                        <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 font-bold uppercase tracking-widest flex items-center justify-between">
                            Enabled
                            {statusFilter === 'enabled' && <CheckCircle2 size={10} className="text-emerald-500 animate-in fade-in zoom-in-50" />}
                        </div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter">{enabledCount}</div>
                    </button>
                    <button
                        onClick={() => setStatusFilter(prev => prev === 'disabled' ? 'all' : 'disabled')}
                        className={cn(
                            "px-3 py-2.5 rounded-xl border transition-all text-left group",
                            statusFilter === 'disabled'
                                ? "border-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.1)]"
                                : "border-border/50 bg-card/40 hover:border-primary/40"
                        )}
                    >
                        <div className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest flex items-center justify-between">
                            Disabled
                            {statusFilter === 'disabled' && <Ban size={10} className="text-primary animate-in fade-in zoom-in-50" />}
                        </div>
                        <div className="text-lg font-bold text-muted-foreground font-mono tracking-tighter">{disabledCount}</div>
                    </button>
                </div>

                <div className="flex p-1 bg-muted/30 rounded-lg relative overflow-hidden">
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
                                    scopeFilter === item.key
                                        ? "text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {scopeFilter === item.key && (
                                    <motion.div
                                        layoutId="skillScopeTab"
                                        className="absolute inset-0 bg-primary rounded-md shadow-sm"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                                    />
                                )}
                                <item.icon size={16} className="relative z-10" />
                                {!compact && <span className="relative z-10">{item.label}</span>}
                                <span className={cn(
                                    "relative z-10 px-1 py-0.5 rounded text-[9px] min-w-[16px] text-center font-mono leading-none transition-colors",
                                    scopeFilter === item.key
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                    {item.count}
                                </span>
                            </button>
                        </Tooltip>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 scrollbar-thin">
                <AnimatePresence mode="wait">
                    {showAdvanced && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden"
                        >
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4 mb-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                    <SlidersHorizontal size={14} className="text-primary/60" />
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Advanced Console</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                                            <Plus size={12} className="text-primary" />
                                            Install Skill
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={installSource}
                                                onChange={(e) => setInstallSource(e.target.value)}
                                                placeholder="GitHub URL or local path"
                                                className="w-full px-3 py-2 text-xs border border-border/50 rounded-lg bg-background/50 focus:ring-1 focus:ring-primary/30 outline-none transition-all font-mono"
                                            />
                                            <button
                                                onClick={() => handleAction('install')}
                                                disabled={!installSource.trim() || actionLoading === `install:${installSource}`}
                                                className="w-full px-4 py-2 text-[10px] rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                                            >
                                                {actionLoading?.startsWith('install:') ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                                Install
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-border/20">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                                            <Puzzle size={12} className="text-amber-500" />
                                            External Directory
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                value={linkSource}
                                                onChange={(e) => setLinkSource(e.target.value)}
                                                placeholder="~/.claude/skills"
                                                className="w-full px-3 py-2 text-xs border border-border/50 rounded-lg bg-background/50 focus:ring-1 focus:ring-primary/30 outline-none transition-all font-mono"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleAction('link_dir')}
                                                    disabled={!linkSource.trim() || actionLoading === `link_dir:${linkSource.trim()}`}
                                                    className="px-3 py-2 text-[10px] rounded-lg bg-secondary/80 text-secondary-foreground font-bold uppercase tracking-widest hover:bg-secondary disabled:opacity-50 transition-all border border-border/50"
                                                >
                                                    Link
                                                </button>
                                                <button
                                                    onClick={() => handleAction('unlink_dir')}
                                                    disabled={!linkSource.trim() || actionLoading === `unlink_dir:${linkSource.trim()}`}
                                                    className="px-3 py-2 text-[10px] rounded-lg border border-border/50 bg-background/50 hover:bg-muted font-bold uppercase tracking-widest disabled:opacity-50 transition-all"
                                                >
                                                    Unlink
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {displaySources.length > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-border/20">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-2">
                                                <Puzzle size={12} />
                                                Active Sources
                                            </label>
                                            <div className="space-y-1.5 px-1">
                                                {displaySources.map((source) => (
                                                    <div key={source.key} className="flex items-start gap-1 justify-between">
                                                        <div className="font-mono text-[9px] text-muted-foreground/60 break-all leading-tight">
                                                            {source.key}
                                                        </div>
                                                        {!source.exists && (
                                                            <span className="text-[9px] text-red-500 font-bold uppercase tracking-tighter shrink-0">(missing)</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {actionMessage && (
                                    <div
                                        className={cn(
                                            "text-[10px] font-bold uppercase tracking-tight rounded-lg border px-3 py-2 flex items-start gap-2 animate-in zoom-in-95 duration-200",
                                            actionMessageIsError
                                                ? "border-red-500/30 text-red-500 bg-red-500/5"
                                                : "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                        )}
                                    >
                                        {actionMessageIsError ? <Ban size={12} className="mt-0.5" /> : <CheckCircle2 size={12} className="mt-0.5" />}
                                        <span className="flex-1 leading-normal">{actionMessage}</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={cn("space-y-2.5")}>
                    {filteredSkills.length === 0 ? (
                        <div className="text-center py-10 opacity-20 grayscale">
                            <Puzzle size={32} className="mx-auto mb-3" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">No matching skills</p>
                        </div>
                    ) : (
                        filteredSkills.map((skill) => (
                            <div
                                key={skill.id}
                                className={cn(
                                    "relative p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-muted/40 dark:hover:bg-muted/40 transition-all cursor-pointer group",
                                    selectedSkill?.id === skill.id && "bg-primary/5 border-primary ring-1 ring-primary/20 text-primary"
                                )}
                                onClick={() => setSelectedSkill(skill)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span
                                                className={cn(
                                                    "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                                                    skill.status === 'Enabled' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-zinc-500"
                                                )}
                                            />
                                            <span className="font-semibold text-[13px] text-foreground truncate">
                                                {skill.name}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                                            {skill.description || 'No description provided'}
                                        </p>
                                    </div>
                                    {skill.status === 'Enabled' && (
                                        <button
                                            onClick={(e) => handleUseSkill(e, skill.id)}
                                            className="p-1 px-[5px] text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all shrink-0"
                                            title="Add to chat"
                                        >
                                            <PlusCircle size={14} className="stroke-[2.5]" />
                                        </button>
                                    )}
                                </div>

                                <div
                                    className="absolute top-2 right-8 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                                    onMouseLeave={() => handleMouseLeave(skill.id)}
                                >
                                    <div className="w-[1px] h-4 bg-border/50 mx-1" />
                                    {skill.status === 'Enabled' ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction('disable', skill.id); }}
                                            className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-md transition-all"
                                            title="Disable"
                                            disabled={actionLoading === `disable:${skill.id}`}
                                        >
                                            {actionLoading === `disable:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleAction('enable', skill.id); }}
                                            className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-all"
                                            title="Enable"
                                            disabled={actionLoading === `enable:${skill.id}`}
                                        >
                                            {actionLoading === `enable:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                        </button>
                                    )}
                                    {!skill.isBuiltIn && (
                                        isPending(skill.id) ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    confirmDelete(skill.id, (id) => handleAction('uninstall', id));
                                                }}
                                                className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded hover:bg-red-600 transition-colors animate-in fade-in slide-in-from-right-2 duration-200"
                                            >
                                                Confirm
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startDelete(skill.id);
                                                }}
                                                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                                title="Uninstall"
                                                disabled={actionLoading === `uninstall:${skill.id}`}
                                            >
                                                {actionLoading === `uninstall:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );

    const headerActions = (
        <div className="flex items-center gap-1">
            <button
                onClick={() => setShowAdvanced((prev) => !prev)}
                className={cn(
                    "p-1.5 rounded-lg transition-all border",
                    showAdvanced
                        ? "bg-primary text-primary-foreground border-primary shadow-inner"
                        : "text-muted-foreground border-transparent hover:bg-primary/10 hover:text-primary"
                )}
                title="Advanced Console"
            >
                <SlidersHorizontal size={14} />
            </button>
            <button
                onClick={fetchSkills}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                title="Sync Registry"
            >
                <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            </button>
        </div>
    );

    if (compact) {
        return (
            <div className={cn("flex flex-col h-full bg-card/30", className)}>
                <PanelHeader
                    title="Skills Registry"
                    icon={Puzzle}
                    badge={skills.length}
                    actions={headerActions}
                />
                <div className="flex-1 min-h-0 p-4">
                    {loading && skills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20">
                            <Loader2 size={24} className="animate-spin mb-3" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-center">Syncing Registry...</p>
                        </div>
                    ) : (
                        body
                    )}
                </div>
                <SkillPreviewDialog
                    open={!!selectedSkill}
                    onOpenChange={(open) => !open && setSelectedSkill(null)}
                    skill={selectedSkill}
                />
            </div>
        );
    }

    return (
        <ModuleCard
            title="Skills Registry"
            description={loading ? "Syncing..." : `${skills.length} modules · ${enabledCount} active`}
            icon={Puzzle}
            actions={headerActions}
        >
            {loading && skills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                    <Loader2 size={24} className="animate-spin mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Syncing Modules...</p>
                </div>
            ) : (
                body
            )}
            <SkillPreviewDialog
                open={!!selectedSkill}
                onOpenChange={(open) => !open && setSelectedSkill(null)}
                skill={selectedSkill}
            />
        </ModuleCard>
    );
}
