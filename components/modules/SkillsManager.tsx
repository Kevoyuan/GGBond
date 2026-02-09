'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Sparkles, Loader2, RefreshCw, Trash2, Eye, Star, BookOpen } from 'lucide-react';

interface Skill {
    name: string;
    status: 'Enabled' | 'Disabled';
    isBuiltIn: boolean;
    description: string;
    location: string;
}

export function SkillsManager() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSkills = () => {
        setLoading(true);
        fetch('/api/skills')
            .then(r => r.json())
            .then(data => setSkills(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSkills(); }, []);

    const handleAction = async (action: string, name: string) => {
        try {
            await fetch('/api/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, name }),
            });
            fetchSkills();
        } catch (err) { console.error('Skill action failed:', err); }
    };

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
            description={`${skills.length} installed`}
            icon={Sparkles}
            actions={
                <button onClick={fetchSkills} className="p-1 text-zinc-500 hover:text-foreground transition-colors"><RefreshCw size={14} /></button>
            }
        >
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {skills.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                        No skills installed in ~/.gemini/skills
                    </div>
                ) : (
                    skills.map(skill => (
                        <div key={skill.name} className="flex items-start justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <BookOpen size={14} className="text-purple-500 shrink-0" />
                                    <span className="font-medium text-sm text-foreground truncate">{skill.name}</span>
                                </div>
                                {skill.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 ml-5">{skill.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className={`px-1.5 py-0.5 text-[10px] rounded-full border font-medium ${skill.status === 'Enabled'
                                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40'
                                        : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                    }`}>
                                    {skill.status}
                                </span>
                                <button
                                    onClick={() => handleAction('uninstall', skill.name)}
                                    className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Uninstall"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ModuleCard>
    );
}
