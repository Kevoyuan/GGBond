'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Puzzle, ExternalLink, FileCode, Edit, Loader2, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface Skill {
    id: string;
    name: string;
    description: string;
    location: string;
    status: 'Enabled' | 'Disabled';
    content?: string;
}

interface SkillPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    skill: Skill | null;
}

export function SkillPreviewDialog({ open, onOpenChange, skill }: SkillPreviewDialogProps) {
    const [portalReady, setPortalReady] = useState(false);
    const [fullSkill, setFullSkill] = useState<Skill | null>(null);
    const [loading, setLoading] = useState(false);
    const [opening, setOpening] = useState(false);

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        if (open && skill) {
            setFullSkill(skill); // Initialize with passed skill data
            fetchSkillContent(skill.name);
        } else {
            setFullSkill(null);
        }
    }, [open, skill]);

    const fetchSkillContent = async (skillId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/skills?name=${encodeURIComponent(skillId)}&content=1`);
            if (res.ok) {
                const data = await res.json();
                setFullSkill(prev => prev ? { ...prev, content: data.content, location: data.location } : data);
            }
        } catch (error) {
            console.error("Failed to fetch skill content", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
    };

    const handleEdit = async () => {
        if (!fullSkill?.location) return;

        setOpening(true);
        try {
            await fetch('/api/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: fullSkill.location })
            });
            // We don't necessarily need to close the dialog, but we could show a toast or something.
            // For now, let's just keep it open.
        } catch (error) {
            console.error("Failed to open file", error);
        } finally {
            setOpening(false);
        }
    };

    if (!open || !skill) return null;
    if (!portalReady) return null;

    const displaySkill = fullSkill || skill;

    // Strip frontmatter if present
    const content = displaySkill?.content || '';
    const cleanContent = content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

    const handleUseSkill = () => {
        const event = new CustomEvent('insert-skill-token', {
            detail: { skillId: displaySkill.id }
        });
        window.dispatchEvent(event);
        handleClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="w-full max-w-3xl bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10 h-[80vh]">
                {/* Header */}
                <div className="relative h-20 shrink-0 bg-muted/30 overflow-hidden border-b">
                    <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-indigo-500 to-purple-500" />

                    <div className="absolute top-4 right-4 flex gap-2 z-20">
                        {displaySkill.status === 'Enabled' && (
                            <button
                                onClick={handleUseSkill}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-sm"
                                title="Add to chat"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                Use
                            </button>
                        )}
                        <button
                            onClick={handleEdit}
                            disabled={opening || !displaySkill.location}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/50 text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                            title="Open in VSCode"
                        >
                            {opening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5" />}
                            Edit
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 text-foreground transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="absolute bottom-4 left-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-200/20">
                            <Puzzle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{displaySkill.name}</h2>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full font-medium border",
                                    displaySkill.status === 'Enabled'
                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                        : "bg-muted text-muted-foreground border-border"
                                )}>
                                    {displaySkill.status}
                                </span>
                                {displaySkill.location && (
                                    <span className="font-mono opacity-70 truncate max-w-[300px]" title={displaySkill.location}>
                                        {displaySkill.location.split('/').slice(-3).join('/')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin bg-card/5">
                    <p className="text-sm text-foreground/80 leading-relaxed font-medium mb-6">
                        {displaySkill.description}
                    </p>

                    {loading && !displaySkill.content ? (
                        <div className="flex flex-col items-center justify-center py-12 opacity-50">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <span className="text-xs">Loading content...</span>
                        </div>
                    ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none 
                            prose-headings:font-bold prose-headings:tracking-tight
                            prose-h1:text-xl prose-h1:mb-4
                            prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-foreground
                            prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-h3:text-foreground/90
                            prose-p:leading-relaxed prose-p:text-foreground/90 
                            prose-li:text-foreground/90 prose-li:my-0.5
                            prose-strong:text-foreground prose-strong:font-semibold
                            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-sm
                            prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0"
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code: ({ node, className, children, ...props }: any) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const isInline = !match && !String(children).includes('\n');

                                        if (isInline) {
                                            return (
                                                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground font-normal" {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }

                                        return (
                                            <div className="relative my-4 rounded-lg overflow-hidden border bg-[#1e1e1e] not-prose shadow-sm">
                                                {match?.[1] && (
                                                    <div className="absolute right-2 top-2 text-[10px] text-muted-foreground/50 font-mono select-none uppercase tracking-wider">
                                                        {match[1]}
                                                    </div>
                                                )}
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={match?.[1] || 'text'}
                                                    PreTag="div"
                                                    customStyle={{
                                                        margin: 0,
                                                        padding: '1rem',
                                                        background: 'transparent',
                                                        fontSize: '0.875rem',
                                                        lineHeight: '1.5',
                                                    }}
                                                    codeTagProps={{
                                                        style: {
                                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                        }
                                                    }}
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            </div>
                                        );
                                    },
                                }}
                            >
                                {cleanContent || '*No content available*'}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
