import React, { useState } from 'react';
import { X, FolderOpen, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddWorkspaceDialogProps {
    open: boolean;
    onClose: () => void;
    onAdd: (path: string) => void;
}

export function AddWorkspaceDialog({ open, onClose, onAdd }: AddWorkspaceDialogProps) {
    const [path, setPath] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    if (!open) return null;

    const handleSubmit = async () => {
        const trimmed = path.trim();
        if (!trimmed) {
            setError('请输入项目路径');
            return;
        }

        setIsValidating(true);
        setError(null);

        try {
            // Validate by trying to list the directory
            const res = await fetch(`/api/files?path=${encodeURIComponent(trimmed)}`);
            if (!res.ok) {
                setError('无法访问该目录，请检查路径是否正确');
                return;
            }

            onAdd(trimmed);
            setPath('');
            setError(null);
            onClose();
        } catch {
            setError('验证路径时出错');
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FolderOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base">添加 Workspace</h3>
                            <p className="text-xs text-muted-foreground">输入项目文件夹的完整路径</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                            项目路径
                        </label>
                        <input
                            type="text"
                            value={path}
                            onChange={(e) => { setPath(e.target.value); setError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                            placeholder="/path/to/your/project"
                            className={cn(
                                "w-full bg-background border rounded-lg px-3 py-2.5 text-sm font-mono",
                                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all",
                                "placeholder:text-muted-foreground/50",
                                error && "border-destructive focus:ring-destructive/50"
                            )}
                            autoFocus
                        />
                        {error && (
                            <div className="flex items-center gap-1.5 text-xs text-destructive">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
                        <p>💡 Workspace 相当于 <code className="text-primary/80 bg-primary/5 px-1 rounded">cd</code> 到该项目目录再开始工作。</p>
                        <p className="mt-1">Gemini 的文件操作和对话都会基于此目录。</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t bg-muted/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border hover:bg-accent transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isValidating || !path.trim()}
                        className={cn(
                            "px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium",
                            "hover:bg-primary/90 transition-all",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "flex items-center gap-2"
                        )}
                    >
                        {isValidating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        添加
                    </button>
                </div>
            </div>
        </div>
    );
}
