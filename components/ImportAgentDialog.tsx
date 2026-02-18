import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Link2, FolderOpen, RefreshCw, FileCode, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportableAgent {
  path: string;
  name: string;
}

interface ImportAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportAgentDialog({ open, onOpenChange, onSuccess }: ImportAgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importableAgents, setImportableAgents] = useState<ImportableAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (open) {
      scanForAgents();
    }
  }, [open]);

  const scanForAgents = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/agents/import');
      const data = await res.json();
      setImportableAgents(data.agents || []);
    } catch (err) {
      setError('Failed to scan for agents');
    } finally {
      setScanning(false);
    }
  };

  const handleImport = async () => {
    if (!selectedPath) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: selectedPath }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import agent');
      }

      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import agent');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedPath(null);
    setError(null);
    onOpenChange(false);
  };

  if (!open) return null;
  if (!portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="w-full max-w-lg bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <Link2 className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-semibold text-xl">Import Agent</h2>
              <p className="text-xs text-muted-foreground">Import agents from other locations</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm shrink-0 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {scanning ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Scanning for agents...</p>
            </div>
          ) : importableAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No importable agents found</p>
              <p className="text-xs text-muted-foreground/70">
                Agents can be stored in ~/.claude/agents or ~/.gemini/agents
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Found {importableAgents.length} agent{importableAgents.length > 1 ? 's' : ''}:
              </p>
              {importableAgents.map((agent) => (
                <button
                  key={agent.path}
                  onClick={() => setSelectedPath(agent.path)}
                  className={cn(
                    "w-full p-4 rounded-lg border text-left transition-colors",
                    selectedPath === agent.path
                      ? "bg-primary/5 border-primary ring-2 ring-primary/20"
                      : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FileCode className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.path}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-muted/30 flex items-center justify-between shrink-0">
          <button
            onClick={scanForAgents}
            disabled={scanning}
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", scanning && "animate-spin")} />
            Rescan
          </button>

          <button
            onClick={handleImport}
            disabled={!selectedPath || importing}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
