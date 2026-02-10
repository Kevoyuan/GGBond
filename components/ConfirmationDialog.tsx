
'use client';

import React from 'react';
import {
    AlertTriangle,
    Check,
    X,
    Terminal,
    FileText,
    HelpCircle,
    Server,
    LogOut
} from 'lucide-react';
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
    // Edit
    fileName?: string;
    filePath?: string;
    fileDiff?: string;
    originalContent?: string;
    newContent?: string;
    // MCP
    serverName?: string;
    toolName?: string;
    // Ask User
    questions?: any[];
}

interface ConfirmationDialogProps {
    details: ConfirmationDetails;
    onConfirm: (payload?: any) => void;
    onCancel: () => void;
}

export function ConfirmationDialog({ details, onConfirm, onCancel }: ConfirmationDialogProps) {
    const { type, title, command, fileDiff, fileName, serverName, toolName, prompt } = details;

    let Icon = AlertTriangle;
    let iconColor = "text-amber-500";
    let bgColor = "bg-amber-500/10";
    let borderColor = "border-amber-500/20";

    if (type === 'exec') {
        Icon = Terminal;
        iconColor = "text-blue-500";
        bgColor = "bg-blue-500/10";
        borderColor = "border-blue-500/20";
    } else if (type === 'edit') {
        Icon = FileText;
        iconColor = "text-emerald-500";
        bgColor = "bg-emerald-500/10";
        borderColor = "border-emerald-500/20";
    } else if (type === 'mcp') {
        Icon = Server;
        iconColor = "text-purple-500";
        bgColor = "bg-purple-500/10";
        borderColor = "border-purple-500/20";
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={cn(
                "w-full max-w-2xl bg-background rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
                borderColor
            )}>
                {/* Header */}
                <div className={cn("px-4 py-3 border-b flex items-center gap-3", bgColor, borderColor)}>
                    <Icon className={cn("w-5 h-5", iconColor)} />
                    <h3 className="font-semibold text-foreground">{title}</h3>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                    {prompt && (
                        <p className="text-muted-foreground mb-4">{prompt}</p>
                    )}

                    {/* Exec Command */}
                    {type === 'exec' && command && (
                        <div className="bg-muted/50 rounded-lg border border-border/50 p-3 font-mono text-sm overflow-x-auto">
                            <span className="text-blue-500 select-none">$ </span>
                            {command}
                        </div>
                    )}

                    {/* File Edit */}
                    {type === 'edit' && fileDiff && (
                        <div className="flex flex-col gap-2">
                            <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded w-fit">
                                {fileName}
                            </div>
                            <div className="border rounded-md overflow-hidden bg-background">
                                <DiffBlock
                                    code={details.fileDiff || ''}
                                    filename={fileName}
                                />
                            </div>
                        </div>
                    )}

                    {/* MCP Tool */}
                    {type === 'mcp' && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">Server:</span>
                                <span className="font-medium">{serverName}</span>
                                <span className="text-muted-foreground">Tool:</span>
                                <span className="font-medium">{toolName}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t bg-muted/5 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm()}
                        className={cn(
                            "px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm shadow-sm flex items-center gap-2",
                            type === 'exec' ? "bg-blue-600 hover:bg-blue-700" :
                                type === 'edit' ? "bg-emerald-600 hover:bg-emerald-700" :
                                    "bg-primary hover:bg-primary/90"
                        )}
                    >
                        <Check className="w-4 h-4" />
                        Confirm {type === 'exec' ? 'Execution' : type === 'edit' ? 'Changes' : 'Action'}
                    </button>
                </div>
            </div>
        </div>
    );
}
