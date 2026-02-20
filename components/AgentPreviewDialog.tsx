'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Play, Check, Folder, Cpu, AlertCircle, Activity, ExternalLink, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import ReactMarkdown from 'react-markdown';

interface AgentDefinition {
    name: string;
    displayName?: string;
    description: string;
    kind: 'local' | 'remote';
    experimental?: boolean;
    content?: string;
}

interface AgentPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agent: AgentDefinition | null;
    onSuccess?: () => void;
}

export function AgentPreviewDialog({ open, onOpenChange, agent, onSuccess }: AgentPreviewDialogProps) {
    const [task, setTask] = useState('');
    const [workspace, setWorkspace] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ id: string; task: string } | null>(null);
    const [portalReady, setPortalReady] = useState(false);

    useEffect(() => {
        setPortalReady(true);
    }, []);

    // Reset state when dialog closes or agent changes
    useEffect(() => {
        if (!open) {
            setTask('');
            setWorkspace('');
            setModel('gemini-2.5-flash');
            setError(null);
            setSuccess(null);
        }
    }, [open, agent]);

    const handleClose = () => {
        onOpenChange(false);
    };

    const handleRun = async () => {
        if (!agent || !task.trim()) return;

        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/agents/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentName: agent.name,
                    task: task.trim(),
                    workspace: workspace.trim() || undefined,
                    model: model,
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to start agent');
            }

            setSuccess({ id: data.id, task: task.trim() });
            onSuccess?.();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An error occurred';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!open || !agent) return null;
    if (!portalReady) return null;

    // Success state
    if (success) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
                <div className="w-full max-w-md bg-background border rounded-xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200 relative z-10">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Agent Started!</h2>
                    <p className="text-muted-foreground mb-6">
                        Your agent <strong>{agent.displayName || agent.name}</strong> is now running in the background.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
                        <div className="text-xs text-muted-foreground mb-1">Task</div>
                        <div className="text-sm">{success.task}</div>
                    </div>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium rounded-xl border hover:bg-muted transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="w-full max-w-4xl bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10 h-[85vh]">
                {/* Header with gradient background */}
                <div className="relative h-24 shrink-0 bg-muted/30 overflow-hidden">
                    <div className={cn(
                        "absolute inset-0 opacity-20 bg-gradient-to-br",
                        agent.kind === 'remote' ? "from-purple-500 to-pink-500" : "from-blue-500 to-emerald-500"
                    )} />
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 text-foreground transition-colors z-20"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="absolute -bottom-6 left-8 p-1.5 rounded-2xl bg-background border-4 border-background shadow-xl">
                        <div className={cn(
                            "w-16 h-16 rounded-xl flex items-center justify-center",
                            agent.kind === 'remote' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                        )}>
                            {agent.kind === 'remote' ? (
                                <ExternalLink className="w-8 h-8" />
                            ) : agent.experimental ? (
                                <Shield className="w-8 h-8" />
                            ) : (
                                <Cpu className="w-8 h-8" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Main scrollable area splits into two - details and config */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* Left: Details area (Markdown) */}
                    <div className="flex-1 overflow-y-auto p-8 pt-10 border-r scrollbar-thin bg-card/5">
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-bold">{agent.displayName || agent.name}</h2>
                                    <span className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                                        agent.kind === 'remote' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                    )}>
                                        {agent.kind}
                                    </span>
                                </div>
                                <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                                    {agent.description}
                                </p>
                            </div>

                            {agent.content && (
                                <div className="space-y-3 pt-6 border-t border-border/50">
                                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Instructions & Capabilities</h3>
                                    <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none 
                                        prose-h2:text-base prose-h2:font-bold prose-h2:mt-4 prose-h2:mb-2 
                                        prose-p:leading-relaxed prose-li:my-0.5 text-foreground/70">
                                        <ReactMarkdown>{agent.content}</ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Configuration Sidebar */}
                    <div className="w-full md:w-[320px] bg-muted/10 p-6 flex flex-col gap-6 overflow-y-auto scrollbar-none">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-4">
                                <Activity className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary/80">Deployment</h3>
                            </div>

                            {/* Task Input */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                    Define Objective
                                </label>
                                <textarea
                                    value={task}
                                    onChange={(e) => setTask(e.target.value)}
                                    placeholder="Describe the problem or task for this agent..."
                                    className="w-full h-32 px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm transition-all"
                                    disabled={submitting}
                                />
                            </div>

                            {/* Options */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                                        <Folder className="w-3 h-3" />
                                        Context (Workspace)
                                    </label>
                                    <input
                                        type="text"
                                        value={workspace}
                                        onChange={(e) => setWorkspace(e.target.value)}
                                        placeholder="Current directory by default"
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                        disabled={submitting}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                                        <Cpu className="w-3 h-3" />
                                        Model Architecture
                                    </label>
                                    <ModelSelector
                                        value={model}
                                        onChange={setModel}
                                        variant="dropdown"
                                        showInherit={false}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto space-y-3 pt-4 border-t border-border/30">
                            {/* Error */}
                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-[12px] text-destructive leading-tight animate-in fade-in slide-in-from-bottom-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleRun}
                                disabled={!task.trim() || submitting}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Initializing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 fill-current" />
                                        Execute Agent
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-center text-muted-foreground/60 leading-tight">
                                Monitor progress in the activity history
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
