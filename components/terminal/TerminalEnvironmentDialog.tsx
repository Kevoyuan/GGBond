import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { TerminalEnvironmentConfig, TerminalAction, TerminalSession } from './types';

interface TerminalEnvironmentDialogProps {
  environment: TerminalEnvironmentConfig;
  setEnvironment: React.Dispatch<React.SetStateAction<TerminalEnvironmentConfig>>;
  setSessions: React.Dispatch<React.SetStateAction<TerminalSession[]>>;
  handleAddAction: () => void;
  updateAction: (id: string, updates: Partial<TerminalAction>) => void;
  handleRemoveAction: (id: string) => void;
  onClose: () => void;
}

export function TerminalEnvironmentDialog({
  environment,
  setEnvironment,
  setSessions,
  handleAddAction,
  updateAction,
  handleRemoveAction,
  onClose,
}: TerminalEnvironmentDialogProps) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[min(980px,96vw)] h-[min(760px,88vh)] rounded-xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Environment Settings</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Configure shell, default cwd, env vars, and reusable run actions.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em]">Name</span>
              <input
                value={environment.name}
                onChange={(event) => setEnvironment((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full bg-background text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em]">Shell</span>
              <input
                value={environment.shell}
                onChange={(event) => setEnvironment((prev) => ({ ...prev, shell: event.target.value }))}
                placeholder="/bin/zsh"
                className="w-full bg-background text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em]">Default CWD</span>
              <input
                value={environment.defaultCwd}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setEnvironment((prev) => ({ ...prev, defaultCwd: nextValue }));
                  setSessions(prev => prev.map(s => ({ ...s, sessionCwd: nextValue }))); // Update all sessions
                }}
                className="w-full bg-background text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
              Environment Variables (KEY=VALUE, one per line)
            </span>
            <textarea
              value={environment.envText}
              onChange={(event) => setEnvironment((prev) => ({ ...prev, envText: event.target.value }))}
              rows={6}
              className="w-full bg-background text-sm font-mono text-foreground border border-border/70 rounded-md px-3 py-3 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={`NODE_ENV=development\nPORT=3000`}
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 bg-muted/10">
            <input
              type="checkbox"
              checked={environment.interactiveAutocomplete}
              onChange={(event) =>
                setEnvironment((prev) => ({
                  ...prev,
                  interactiveAutocomplete: event.target.checked,
                }))
              }
            />
            <span className="text-xs text-muted-foreground">
              Interactive shell autocompletion
            </span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground uppercase tracking-[0.08em]">Actions</span>
              <button
                type="button"
                onClick={handleAddAction}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus size={12} />
                Add Action
              </button>
            </div>

            <div className="space-y-2">
              {environment.actions.map((action) => (
                <div key={action.id} className="grid grid-cols-[180px_1fr_auto] gap-2 items-center">
                  <input
                    value={action.name}
                    onChange={(event) => updateAction(action.id, { name: event.target.value })}
                    className="bg-background text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Action name"
                  />
                  <input
                    value={action.script}
                    onChange={(event) => updateAction(action.id, { script: event.target.value })}
                    className="bg-background font-mono text-sm text-foreground border border-border/70 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="npm run dev"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAction(action.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove action"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
