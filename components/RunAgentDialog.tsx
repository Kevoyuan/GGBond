'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Play, Sparkles, Settings, Search, Check, Folder, Cpu, AlertCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentDefinition {
  name: string;
  displayName?: string;
  description: string;
  kind: 'local' | 'remote';
  experimental?: boolean;
}

interface RunAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedAgent?: string | null;
}

export function RunAgentDialog({ open, onOpenChange, preselectedAgent }: RunAgentDialogProps) {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [task, setTask] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [model, setModel] = useState('inherit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; task: string } | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Load agents when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        setAgents(data.agents || []);
        // Auto-select preselected agent
        if (preselectedAgent) {
          const agent = data.agents?.find((a: AgentDefinition) => a.name === preselectedAgent);
          if (agent) setSelectedAgent(agent);
        }
      })
      .finally(() => setLoading(false));
  }, [open, preselectedAgent]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedAgent(null);
      setTask('');
      setWorkspace('');
      setModel('inherit');
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRun = async () => {
    if (!selectedAgent || !task.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: selectedAgent.name,
          task: task.trim(),
          workspace: workspace.trim() || undefined,
          model: model || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start agent');
      }

      setSuccess({ id: data.id, task: task.trim() });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAnother = () => {
    setSuccess(null);
    setTask('');
  };

  if (!open) return null;
  if (!portalReady) return null;

  // Success state
  if (success) {
    return createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
        <div className="w-full max-w-md bg-background border rounded-xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200 relative z-10">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Agent Started!</h2>
          <p className="text-muted-foreground mb-6">
            Your agent <strong>{selectedAgent?.displayName || selectedAgent?.name}</strong> is now running in the background.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
            <div className="text-xs text-muted-foreground mb-1">Task</div>
            <div className="text-sm">{success.task}</div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium rounded-xl border hover:bg-muted transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleRunAnother}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Run Another
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="w-full max-w-2xl bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Play className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold text-xl">Run Agent</h2>
              <p className="text-xs text-muted-foreground">Execute an AI agent in the background</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-4">
          {/* Agent Selection with Search */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Select Agent</span>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Agent List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No agents found
              </div>
            ) : (
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {filteredAgents.map((agent) => (
                  <button
                    key={agent.name}
                    onClick={() => setSelectedAgent(agent)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      selectedAgent?.name === agent.name
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        agent.kind === 'remote' ? "bg-purple-500" : "bg-blue-500"
                      )} />
                      <span className="font-medium text-sm truncate">
                        {agent.displayName || agent.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {agent.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Task Configuration */}
          {/* Selected Agent Badge */}
          {selectedAgent && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm">
                Running: <strong>{selectedAgent.displayName || selectedAgent.name}</strong>
              </span>
            </div>
          )}

          {/* Task Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Task Description
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the agent to do..."
              className="w-full h-24 px-4 py-3 rounded-xl border border-border bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
              disabled={submitting}
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <Folder className="w-4 h-4 inline mr-1" />
                Workspace
              </label>
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="Project directory (optional)"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                <Settings className="w-4 h-4 inline mr-1" />
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm"
                disabled={submitting}
              >
                <option value="inherit">Inherit from settings</option>
                <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleRun}
            disabled={!selectedAgent || !task.trim() || submitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Agent...
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
    </div>,
    document.body
  );
}
