'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteConfirmDialogProps {
    open: boolean;
    agentName: string;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting?: boolean;
}

export function DeleteConfirmDialog({
    open,
    agentName,
    onClose,
    onConfirm,
    isDeleting = false,
}: DeleteConfirmDialogProps) {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) {
            const timer = setTimeout(() => confirmButtonRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [open]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (open) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl overflow-hidden p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold tracking-tight">Delete Agent</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 -mr-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                    Are you sure you want to delete <span className="font-medium text-foreground">&quot;{agentName}&quot;</span>?
                    This action cannot be undone.
                </p>

                <div className="flex items-center justify-end gap-3 mt-2">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 flex items-center justify-center rounded-lg hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className={cn(
                            "px-4 py-2 flex items-center justify-center rounded-lg text-sm font-medium text-white shadow-sm transition-all hover:bg-destructive/90 disabled:opacity-60",
                            isDeleting ? "bg-destructive/70" : "bg-destructive"
                        )}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Delete'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
