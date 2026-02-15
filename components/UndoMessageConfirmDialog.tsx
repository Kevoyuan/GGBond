import React from 'react';
import { X, Undo2, Loader2, FilePlus2, FileMinus2, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UndoPreviewFileChange = {
  path: string;
  displayPath: string;
  status: 'modified' | 'created' | 'deleted';
  addedLines: number;
  removedLines: number;
};

interface UndoMessageConfirmDialogProps {
  open: boolean;
  fileChanges: UndoPreviewFileChange[];
  hasCheckpoint: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export function UndoMessageConfirmDialog({
  open,
  fileChanges,
  hasCheckpoint,
  onCancel,
  onConfirm,
  isConfirming = false,
}: UndoMessageConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg rounded-2xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-primary" />
            <h3 className="text-2xl font-semibold tracking-tight">Confirm Undo</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-lg text-muted-foreground leading-relaxed">
            Confirming this undo action will make the following changes:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {fileChanges.length > 0 ? (
              fileChanges.map((change) => (
                <div key={`${change.path}-${change.status}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {change.status === 'created' ? (
                      <FilePlus2 className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : change.status === 'deleted' ? (
                      <FileMinus2 className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <FileCode2 className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <span className="text-xl text-foreground truncate">{change.displayPath}</span>
                  </div>

                  <div className="flex items-center gap-2 text-base font-semibold tabular-nums">
                    <span className={cn(change.addedLines > 0 ? 'text-green-500' : 'text-muted-foreground')}>
                      +{change.addedLines}
                    </span>
                    <span className={cn(change.removedLines > 0 ? 'text-red-500' : 'text-muted-foreground')}>
                      -{change.removedLines}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                {hasCheckpoint
                  ? 'Workspace files will be restored from checkpoint. Exact file diff preview is unavailable.'
                  : 'No file-level preview is available for this undo.'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/60 bg-muted/10">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="px-4 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
