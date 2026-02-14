'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Square,
  Copy,
  ExternalLink,
  MoreVertical,
  Activity,
  Cpu
} from 'lucide-react';
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
  onNavigateToChat?: () => void;
}

export function AgentRunsList({ className, onNavigateToChat }: AgentRunsListProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

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
    }, 2000);

    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  const deleteRun = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/agents/run?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchRuns();
      }
    } catch (err) {
      console.error('Failed to delete run:', err);
    }
  };

  const clearHistory = async () => {
    try {
      const res = await fetch('/api/agents/run', {
        method: 'DELETE',
      });
      if (res.ok) {
        setShowClearConfirm(false);
        fetchRuns();
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  const getDuration = (start: number, end?: number) => {
    const endTime = end || Date.now();
    const diffMs = endTime - start;
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${secs % 60}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  const runningCount = runs.filter(r => r.status === 'running' || r.status === 'pending').length;
  const completedCount = runs.filter(r => r.status === 'completed').length;
  const failedCount = runs.filter(r => r.status === 'failed').length;

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Agent Runs</span>
          </div>
          {runningCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Activity className="w-3 h-3 animate-pulse" />
              {runningCount} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {runs.length > 0 && (
            <div
              className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseLeave={() => setShowClearConfirm(false)}
            >
              {showClearConfirm ? (
                <button
                  onClick={clearHistory}
                  className="px-2 py-1 text-[10px] font-bold bg-red-500 text-white rounded hover:bg-red-600 transition-colors animate-in fade-in slide-in-from-right-2 duration-200"
                >
                  Confirm
                </button>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <button
            onClick={fetchRuns}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", polling && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {runs.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {completedCount} completed
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            {failedCount} failed
          </span>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 opacity-50" />
          </div>
          <p className="font-medium">No agent runs yet</p>
          <p className="text-sm mt-1">Run an agent from the panel above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <AgentRunCard
              key={run.id}
              run={run}
              isExpanded={expandedRun === run.id}
              onToggleExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              onDelete={(e) => deleteRun(run.id, e)}
              onNavigateToChat={onNavigateToChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AgentRunCardProps {
  run: AgentRun;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onNavigateToChat?: () => void;
}

function AgentRunCard({ run, isExpanded, onToggleExpand, onDelete, onNavigateToChat }: AgentRunCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (run.status === 'running') {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [run.status]);

  const getDuration = (start: number, end?: number) => {
    const endTime = end || currentTime;
    const diffMs = endTime - start;
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${secs % 60}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          label: 'Running'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          label: 'Completed'
        };
      case 'failed':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          label: 'Failed'
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          color: 'text-zinc-400',
          bg: 'bg-zinc-500/10',
          border: 'border-zinc-500/30',
          label: 'Pending'
        };
    }
  };

  const status = getStatusConfig(run.status);

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200 group",
        status.bg, status.border,
        isExpanded && "ring-1 ring-primary/20"
      )}
    >
      {/* Card Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className={cn("p-2 rounded-lg bg-background/50", status.color)}>
          {status.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {run.agent_display_name || run.agent_name}
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              status.bg, status.color
            )}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {run.task}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {getDuration(run.created_at, run.completed_at)}
          </span>
          {run.status !== 'running' && run.status !== 'pending' && (
            <div
              className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseLeave={() => setShowDeleteConfirm(false)}
            >
              {showDeleteConfirm ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(e);
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded hover:bg-red-600 transition-colors animate-in fade-in slide-in-from-right-1 duration-200"
                >
                  Confirm
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-primary transition-colors"
                  title="Delete run"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Meta info */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {new Date(run.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            {run.model && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200 dark:border-zinc-700/50 shadow-[0_0_10px_rgba(0,0,0,0.02)] dark:shadow-none font-mono font-bold text-zinc-600 dark:text-zinc-400 group/model transition-colors hover:border-primary/30">
                <Cpu className="w-2.5 h-2.5 text-primary/60 group-hover/model:text-primary transition-colors" />
                {run.model}
              </span>
            )}
            {run.workspace && (
              <span className="truncate max-w-[120px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" title={run.workspace}>
                {run.workspace.split('/').pop()}
              </span>
            )}
          </div>

          {/* Output/Error */}
          {(run.status === 'running' || run.status === 'completed' || run.status === 'failed') && (
            <div className="rounded-lg bg-background/50 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Terminal className="w-3 h-3" />
                  Output
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    title="Copy output"
                    onClick={() => {
                      const content = run.current_content || run.result || run.error || '';
                      navigator.clipboard.writeText(content);
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto text-xs font-mono whitespace-pre-wrap">
                {run.status === 'running' && run.current_content ? (
                  <span className="text-blue-600 dark:text-blue-400">{run.current_content}</span>
                ) : run.status === 'failed' && run.error ? (
                  <span className="text-red-600 dark:text-red-400">{run.error}</span>
                ) : run.result ? (
                  <span className="text-zinc-700 dark:text-zinc-300">{run.result}</span>
                ) : (
                  <span className="text-muted-foreground italic">No output</span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {run.status === 'running' && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  // Stop functionality would go here
                }}
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}
            {run.status === 'completed' && onNavigateToChat && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToChat();
                }}
              >
                <ExternalLink className="w-3 h-3" />
                View in Chat
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                const content = run.current_content || run.result || run.error || '';
                navigator.clipboard.writeText(content);
              }}
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>
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
  workspaces?: { path: string; name: string }[];
}

export function RunAgentDialog({ agentName, agentDisplayName, open, onOpenChange, onRun, workspaces = [] }: RunAgentDialogProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !loading && onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-background rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Play className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold">Run Agent</h3>
              <p className="text-sm text-muted-foreground">{agentDisplayName || agentName}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Task Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Task Description</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the agent to do..."
              className="w-full h-32 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Workspace</label>
              <select
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm"
                disabled={loading}
              >
                <option value="">Default</option>
                {workspaces.map((ws) => (
                  <option key={ws.path} value={ws.path}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm"
                disabled={loading}
              >
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                Start Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
