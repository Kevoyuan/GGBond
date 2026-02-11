'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Sparkles, Loader2, RefreshCw, Trash2, BookOpen, Search, CheckCircle2, Ban, Plus } from 'lucide-react';

interface Skill {
    id: string;
    name: string;
    status: 'Enabled' | 'Disabled';
    isBuiltIn: boolean;
    description: string;
    location: string;
}

export function SkillsManager() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [installSource, setInstallSource] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchSkills = () => {
        setLoading(true);
        fetch('/api/skills')
            .then(r => r.json())
            .then(data => setSkills(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSkills(); }, []);

    const handleAction = async (action: string, name?: string) => {
        if ((action === 'enable' || action === 'disable' || action === 'uninstall') && !name) return;
        if (action === 'install' && !installSource.trim()) return;
        if (action === 'uninstall' && name && !confirm(`Uninstall skill "${name}"?`)) return;
        try {
            const id = `${action}:${name || installSource}`;
            setActionLoading(id);
            await fetch('/api/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, name, source: installSource.trim() || undefined }),
            });
            if (action === 'install') setInstallSource('');
            fetchSkills();
        } catch (err) { console.error('Skill action failed:', err); }
        finally { setActionLoading(null); }
    };

    const filteredSkills = skills.filter((skill) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            skill.name.toLowerCase().includes(q) ||
            skill.description.toLowerCase().includes(q) ||
            skill.location.toLowerCase().includes(q)
        );
    });

    const enabledCount = skills.filter((s) => s.status === 'Enabled').length;
    const disabledCount = skills.length - enabledCount;

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
                <button onClick={fetchSkills} className="p-1 text-zinc-500 hover:text-foreground transition-colors"><RefreshCw size={14} /></button>
            }
        >
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
                    <input
                        value={installSource}
                        onChange={(e) => setInstallSource(e.target.value)}
                        placeholder="Install skill from local path or URL"
                        className="flex-1 px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md bg-transparent"
                    />
                    <button
                        onClick={() => handleAction('install')}
                        disabled={!installSource.trim() || actionLoading === `install:${installSource}`}
                        className="px-3 py-2 text-xs rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                        {actionLoading?.startsWith('install:') ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Install
                    </button>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {filteredSkills.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        {skills.length === 0 ? 'No skills installed in ~/.gemini/skills' : 'No matching skills'}
                    </div>
                ) : (
                    filteredSkills.map(skill => (
                        <div key={skill.id} className="flex items-start justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <BookOpen size={14} className="text-purple-500 shrink-0" />
                                    <span className="font-medium text-sm text-foreground truncate">{skill.name}</span>
                                </div>
                                {skill.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 ml-5">{skill.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                <span className={`px-1.5 py-0.5 text-[10px] rounded-full border font-medium ${skill.status === 'Enabled'
                                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40'
                                        : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                    }`}>
                                    {skill.status}
                                </span>
                                {skill.status === 'Enabled' ? (
                                    <button
                                        onClick={() => handleAction('disable', skill.id)}
                                        className="p-1 text-zinc-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Disable"
                                        disabled={actionLoading === `disable:${skill.id}`}
                                    >
                                        {actionLoading === `disable:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleAction('enable', skill.id)}
                                        className="p-1 text-zinc-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Enable"
                                        disabled={actionLoading === `enable:${skill.id}`}
                                    >
                                        {actionLoading === `enable:${skill.id}` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleAction('uninstall', skill.id)}
                                    className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
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
        </ModuleCard>
    );
}
