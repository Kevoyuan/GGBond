'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Play, CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentRun {
  id: string;
  agent_name: string;
  agent_display_name?: string;
  description?: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  workspace?: string;
  model?: string;
  result?: string;
  error?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
  current_content?: string;
}

interface AgentRunsListProps {
  className?: string;
}

export function AgentRunsList({ className }: AgentRunsListProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/run');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Failed to fetch agent runs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Poll for running jobs
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'running' || r.status === 'pending');
    if (!hasRunning) return;

    const interval = setInterval(() => {
      setPolling(true);
      fetchRuns().finally(() => setPolling(false));
    }, 3000);

    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - ts;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
      case 'failed':
        return 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400';
      default:
        return 'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Agent Runs
          {polling && <Loader2 className="w-3 h-3 animate-spin" />}
        </h3>
        <button
          onClick={fetchRuns}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", polling && "animate-spin")} />
        </button>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No agent runs yet</p>
          <p className="text-xs mt-1">Run an agent to see it here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {runs.map((run) => (
            <div
              key={run.id}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                getStatusColor(run.status)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStatusIcon(run.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {run.agent_display_name || run.agent_name}
                    </span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      run.status === 'running' && "bg-blue-500/20",
                      run.status === 'completed' && "bg-emerald-500/20",
                      run.status === 'failed' && "bg-red-500/20"
                    )}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {run.task}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(run.created_at)}</span>
                    {run.workspace && (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[100px]">{run.workspace.split('/').pop()}</span>
                      </>
                    )}
                  </div>
                  {run.status === 'running' && run.current_content && (
                    <div className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-900 p-2 rounded truncate">
                      {run.current_content.substring(0, 200)}
                    </div>
                  )}
                  {run.status === 'failed' && run.error && (
                    <div className="mt-2 text-xs bg-red-50 dark:bg-red-950/30 p-2 rounded text-red-600 dark:text-red-400">
                      {run.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RunAgentDialogProps {
  agentName: string;
  agentDisplayName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun?: (runId: string) => void;
}

export function RunAgentDialog({ agentName, agentDisplayName, open, onOpenChange, onRun }: RunAgentDialogProps) {
  const [task, setTask] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!task.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          task: task.trim(),
          workspace: workspace.trim() || undefined,
          model: model || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start agent');
      }

      onRun?.(data.id);
      onOpenChange(false);
      setTask('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog open={open} className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-500" />
          Run Agent: {agentDisplayName || agentName}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Task</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the agent to do..."
              className="textarea textarea-bordered w-full h-24"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Workspace (optional)</label>
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="Project directory"
                className="input input-bordered w-full"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="select select-bordered w-full"
                disabled={loading}
              >
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={loading || !task.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Agent
              </>
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={() => onOpenChange(false)}>close</button>
      </form>
    </dialog>
  );
}
