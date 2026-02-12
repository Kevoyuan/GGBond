'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Sparkles, Loader2, RefreshCw, Trash2, BookOpen, Search, CheckCircle2, Ban, Plus, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export function SkillsManager({ compact = false, className }: SkillsManagerProps = {}) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [sources, setSources] = useState<SkillSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'project'>('all');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [search, setSearch] = useState('');
    const [installSource, setInstallSource] = useState('');
    const [linkSource, setLinkSource] = useState('');
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionMessageIsError, setActionMessageIsError] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        if (action === 'uninstall' && name && !confirm(`Uninstall skill "${name}"?`)) return;
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

    const scopeFilteredSkills = skills.filter((skill) => {
        return scopeFilter === 'all' ? true : skill.scope === scopeFilter;
    });

    const filteredSkills = scopeFilteredSkills.filter((skill) => {
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
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div className="px-2.5 py-2 rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-900/10">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Enabled</div>
                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{enabledCount}</div>
                </div>
                <div className="px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Disabled</div>
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{disabledCount}</div>
                </div>
            </div>



            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search skills..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                {[
                    { key: 'all', label: 'All' },
                    { key: 'project', label: 'Project' },
                    { key: 'global', label: 'Global' },
                ].map((item) => (
                    <button
                        key={item.key}
                        onClick={() => setScopeFilter(item.key as 'all' | 'project' | 'global')}
                        className={cn(
                            "px-2.5 py-1.5 text-xs rounded-md border transition-colors",
                            scopeFilter === item.key
                                ? "bg-primary text-primary-foreground border-primary/50"
                                : "bg-transparent border-zinc-200 dark:border-zinc-700 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {showAdvanced && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/30 p-4 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <SlidersHorizontal size={14} className="text-muted-foreground" />
                        <h3 className="text-sm font-medium text-foreground">Advanced Management</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                <Plus size={12} className="text-primary" />
                                Install Skill
                            </label>
                            <p className="text-[10px] text-muted-foreground">Install a skill from a URL (GitHub) or local file path.</p>
                            <div className="flex flex-col gap-2">
                                <input
                                    value={installSource}
                                    onChange={(e) => setInstallSource(e.target.value)}
                                    placeholder="https://github.com/user/repo or /path/to/skill"
                                    className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-background focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
                                />
                                <button
                                    onClick={() => handleAction('install')}
                                    disabled={!installSource.trim() || actionLoading === `install:${installSource}`}
                                    className="w-full px-4 py-2 text-xs rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                                >
                                    {actionLoading?.startsWith('install:') ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                    Install
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border/40">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                <BookOpen size={12} className="text-emerald-500" />
                                External Skills Directory
                            </label>
                            <p className="text-[10px] text-muted-foreground">Link a local directory containing multiple skill definitions.</p>
                            <div className="flex flex-col gap-2">
                                <input
                                    value={linkSource}
                                    onChange={(e) => setLinkSource(e.target.value)}
                                    placeholder="e.g.: ~/.agents/skills; ~/.claude/skills"
                                    className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-background focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleAction('link_dir')}
                                        disabled={!linkSource.trim() || actionLoading === `link_dir:${linkSource.trim()}`}
                                        className="px-3 py-2 text-xs rounded-md bg-emerald-600 text-white font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors shadow-sm w-full flex justify-center"
                                        title="Create symlinks"
                                    >
                                        Link
                                    </button>
                                    <button
                                        onClick={() => handleAction('unlink_dir')}
                                        disabled={!linkSource.trim() || actionLoading === `unlink_dir:${linkSource.trim()}`}
                                        className="px-3 py-2 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium disabled:opacity-50 transition-colors shadow-sm w-full flex justify-center"
                                        title="Remove symlinks"
                                    >
                                        Unlink
                                    </button>
                                </div>
                            </div>
                        </div>

                        {displaySources.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/40">
                                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                    <BookOpen size={12} className="text-muted-foreground" />
                                    Active Skills Sources
                                </label>
                                <div className="space-y-1.5">
                                    {displaySources.map((source) => (
                                        <div key={source.key} className="flex items-start gap-1 justify-between">
                                            <div className="font-mono text-[10px] text-muted-foreground break-all leading-tight">
                                                {source.key}
                                            </div>
                                            {!source.exists && (
                                                <span className="text-[10px] text-amber-500 whitespace-nowrap shrink-0">(missing)</span>
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
                                "text-xs rounded-md border px-3 py-2.5 flex items-start gap-2 shadow-sm animate-in fade-in zoom-in-95 duration-200",
                                actionMessageIsError
                                    ? "border-red-500/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
                                    : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                            )}
                        >
                            {actionMessageIsError ? (
                                <Ban size={14} className="mt-0.5 shrink-0" />
                            ) : (
                                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                            )}
                            <span className="flex-1 leading-relaxed">{actionMessage}</span>
                        </div>
                    )}
                </div>
            )}

            <div className={cn("space-y-2", compact ? "h-[calc(100vh-280px)] overflow-y-auto pr-1" : "max-h-[350px] overflow-y-auto")}>
                {filteredSkills.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        {scopeFilteredSkills.length === 0 ? 'No skills in this scope' : 'No matching skills'}
                    </div>
                ) : (
                    filteredSkills.map(skill => (
                        <div key={skill.id} className="relative p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                            <div className="min-w-0 pr-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <BookOpen size={14} className="text-purple-500 shrink-0" />
                                    <span
                                        className={cn(
                                            "inline-block w-2 h-2 rounded-full shrink-0",
                                            skill.status === 'Enabled' ? "bg-emerald-500" : "bg-zinc-500"
                                        )}
                                        title={skill.status}
                                    />
                                    <span className="font-medium text-sm text-foreground truncate">{skill.name}</span>
                                </div>
                                {skill.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 ml-5 mt-1">{skill.description}</p>
                                )}
                            </div>

                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                {skill.status === 'Enabled' ? (
                                    <button
                                        onClick={() => handleAction('disable', skill.id)}
                                        className="p-1 text-zinc-400 hover:text-amber-500 rounded"
                                        title="Disable"
                                        disabled={actionLoading === `disable:${skill.id}`}
                                    >
                                        {actionLoading === `disable:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleAction('enable', skill.id)}
                                        className="p-1 text-zinc-400 hover:text-emerald-500 rounded"
                                        title="Enable"
                                        disabled={actionLoading === `enable:${skill.id}`}
                                    >
                                        {actionLoading === `enable:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleAction('uninstall', skill.id)}
                                    className="p-1 text-zinc-400 hover:text-red-500 rounded"
                                    title="Uninstall"
                                    disabled={actionLoading === `uninstall:${skill.id}`}
                                >
                                    {actionLoading === `uninstall:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (compact) {
        return (
            <div className={cn("flex flex-col h-full bg-card/30", className)}>
                <div className="p-3 border-b flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Skills
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAdvanced((prev) => !prev)}
                            className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors",
                                showAdvanced
                                    ? "bg-primary text-primary-foreground border-primary/60"
                                    : "text-muted-foreground hover:text-foreground border-zinc-300 dark:border-zinc-700 hover:bg-muted/40"
                            )}
                            title="Advanced settings"
                        >
                            <SlidersHorizontal size={12} />
                            Advanced
                        </button>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono">
                            {skills.length}
                        </span>
                        <button onClick={fetchSkills} className="p-1 text-zinc-500 hover:text-foreground transition-colors" title="Refresh">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={18} className="animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        body
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <ModuleCard title="Skills" description="Installed skills" icon={Sparkles}>
                <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
            </ModuleCard>
        );
    }

    return (
        <ModuleCard
            title="Skills"
            description={`${skills.length} installed · ${enabledCount} enabled`}
            icon={Sparkles}
            actions={
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowAdvanced((prev) => !prev)}
                        className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors",
                            showAdvanced
                                ? "bg-primary text-primary-foreground border-primary/60"
                                : "text-muted-foreground hover:text-foreground border-zinc-300 dark:border-zinc-700 hover:bg-muted/40"
                        )}
                        title="Advanced settings"
                    >
                        <SlidersHorizontal size={12} />
                        Advanced
                    </button>
                    <button onClick={fetchSkills} className="p-1 text-zinc-500 hover:text-foreground transition-colors" title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                </div>
            }
        >
            {body}
        </ModuleCard>
    );
}
