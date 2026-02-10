import { AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default'
}: ConfirmDialogProps) {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    // Focus management
    useEffect(() => {
        if (open) {
            // Small timeout to ensure element is mounted
            const timer = setTimeout(() => {
                confirmButtonRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (open) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-md bg-background border border-border rounded-xl shadow-2xl overflow-hidden p-6 flex flex-col gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                variant === 'destructive' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                            )}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 -mr-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {description}
                        </p>

                        <div className="flex items-center justify-end gap-3 mt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 flex items-center justify-center rounded-lg hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={cn(
                                    "px-4 py-2 flex items-center justify-center rounded-lg text-sm font-medium text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]",
                                    variant === 'destructive'
                                        ? "bg-destructive hover:bg-destructive/90"
                                        : "bg-primary hover:bg-primary/90"
                                )}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
