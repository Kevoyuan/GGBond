'use client';

import React from 'react';
import { AlertTriangle, Check, FileText, Server, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiffBlock } from './DiffBlock';

export type ConfirmationType = 'info' | 'edit' | 'exec' | 'mcp' | 'ask_user' | 'exit_plan_mode';

export interface ConfirmationDetails {
    type: ConfirmationType;
    title: string;
    // Common
    prompt?: string;
    // Exec
    command?: string;
    rootCommand?: string;
    rootCommands?: string[];
    commands?: string[];
    // Edit
    fileName?: string;
    filePath?: string;
    fileDiff?: string;
    originalContent?: string;
    newContent?: string;
    // MCP
    serverName?: string;
    toolName?: string;
    toolDisplayName?: string;
    // Ask User
    questions?: any[];
    // Exit plan mode
    planPath?: string;
}

interface ConfirmationDialogProps {
    details: ConfirmationDetails;
    onConfirm: (mode?: 'once' | 'session') => void;
    onCancel: () => void;
    bottomOffset?: number;
}

export function ConfirmationDialog({ details, onConfirm, onCancel, bottomOffset = 120 }: ConfirmationDialogProps) {
    const {
        type,
        title,
        command,
        fileDiff,
        fileName,
        serverName,
        toolName,
        toolDisplayName,
        prompt,
    } = details;

    let Icon = AlertTriangle;
    let accent = 'text-amber-400';
    let button = 'bg-amber-600 hover:bg-amber-500';

    if (type === 'exec') {
        Icon = Terminal;
        accent = 'text-blue-400';
        button = 'bg-blue-600 hover:bg-blue-500';
    } else if (type === 'edit') {
        Icon = FileText;
        accent = 'text-emerald-400';
        button = 'bg-emerald-600 hover:bg-emerald-500';
    } else if (type === 'mcp') {
        Icon = Server;
        accent = 'text-fuchsia-400';
        button = 'bg-fuchsia-600 hover:bg-fuchsia-500';
    }

    const primaryLabel =
        type === 'exec'
            ? 'Run Command'
            : type === 'edit'
                ? 'Apply Changes'
                : 'Confirm';
    const showAllowSession = type !== 'ask_user' && type !== 'exit_plan_mode';

    return (
        <div
            className="absolute inset-x-0 z-50 flex justify-center px-2 pointer-events-none animate-in slide-in-from-bottom-2 fade-in duration-200"
            style={{ bottom: `${Math.max(8, bottomOffset + 8)}px` }}
        >
            <div className="pointer-events-auto w-[min(520px,100%)] rounded-lg border border-border/70 bg-background/95 backdrop-blur-md shadow-[0_16px_42px_-20px_rgba(0,0,0,0.7)] overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
                    <Icon className={cn('h-4 w-4', accent)} />
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                </div>

                <div className="max-h-[42vh] overflow-y-auto px-3 py-2.5 custom-scrollbar">
                    {prompt && (
                        <p className="mb-2 text-sm text-muted-foreground">{prompt}</p>
                    )}

                    {type === 'exec' && (
                        <div className="space-y-2">
                            <div className="rounded-md border border-border/70 bg-black/25 px-2.5 py-2 font-mono text-sm text-zinc-100 overflow-x-auto">
                                <span className="select-none text-blue-400">$ </span>
                                {command || '(empty command)'}
                            </div>
                        </div>
                    )}

                    {type === 'edit' && (
                        <div className="space-y-2">
                            <div className="w-fit rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-mono text-muted-foreground">
                                {fileName || details.filePath || 'unknown file'}
                            </div>
                            <div className="overflow-hidden rounded-md border border-border/80 bg-background">
                                <DiffBlock code={fileDiff || ''} filename={fileName} />
                            </div>
                        </div>
                    )}

                    {type === 'mcp' && (
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                            <span className="text-muted-foreground">Server</span>
                            <span className="font-medium text-foreground">{serverName || 'unknown'}</span>
                            <span className="text-muted-foreground">Tool</span>
                            <span className="font-medium text-foreground">{toolDisplayName || toolName || 'unknown'}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/10 px-3 py-2.5">
                    <button
                        onClick={onCancel}
                        className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    {showAllowSession && (
                        <button
                            onClick={() => onConfirm('session')}
                            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-colors"
                        >
                            Allow Session
                        </button>
                    )}
                    <button
                        onClick={() => onConfirm('once')}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-white transition-colors',
                            button
                        )}
                    >
                        <Check className="h-4 w-4" />
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
