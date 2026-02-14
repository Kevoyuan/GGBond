'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader2, Play, Sparkles, Settings, Search, Check, Folder, Cpu, AlertCircle, Activity, Code2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';

interface AgentDefinition {
  name: string;
  displayName?: string;
  description: string;
  kind: 'local' | 'remote';
  experimental?: boolean;
}

function RunAgentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAgent = searchParams.get('agent');
  const preselectedModel = searchParams.get('model');

  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [task, setTask] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [model, setModel] = useState(preselectedModel || 'inherit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; task: string } | null>(null);

  // Filter agents by search
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load agents with cache
  const { getAgents, setAgents: saveAgents, isAgentsCacheValid } = useAppStore();

  useEffect(() => {
    // Try to get cached agents first
    const cachedAgents = getAgents();
    if (cachedAgents) {
      setAgents(cachedAgents);
      if (preselectedAgent) {
        const agent = cachedAgents.find((a: AgentDefinition) => a.name === preselectedAgent);
        if (agent) setSelectedAgent(agent);
      }
      setLoading(false);
      return;
    }

    // Fetch fresh data if no valid cache
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        const agentsData = data.agents || [];
        setAgents(agentsData);
        saveAgents(agentsData);
        if (preselectedAgent) {
          const agent = agentsData.find((a: AgentDefinition) => a.name === preselectedAgent);
          if (agent) setSelectedAgent(agent);
        }
      })
      .finally(() => setLoading(false));
  }, [preselectedAgent, getAgents, saveAgents]);

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

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-zinc-900/30 to-black/70 p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-background rounded-2xl border shadow-2xl p-8 text-center">
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
              <Link
                href="/"
                className="px-4 py-2 text-sm font-medium rounded-xl border hover:bg-muted transition-colors"
              >
                Go to Chat
              </Link>
              <button
                onClick={handleRunAnother}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Run Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-zinc-900/30 to-black/70 p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft size={16} />
            Back to Chat
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Play className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Run Agent</h1>
              <p className="text-sm text-muted-foreground">Execute an AI agent in the background</p>
            </div>
          </div>
        </div>

        <div className="bg-background rounded-xl border shadow-lg overflow-hidden">
          {/* Agent Selection with Search */}
          <div className="p-4 border-b">
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
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
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
          <div className="p-6">
            {/* Selected Agent Badge */}
            {selectedAgent && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-sm">
                  Running: <strong>{selectedAgent.displayName || selectedAgent.name}</strong>
                </span>
              </div>
            )}

            {/* Task Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Task Description
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe what you want the agent to do..."
                className="w-full h-32 px-4 py-3 rounded-xl border border-border bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
                disabled={submitting}
              />
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4 mb-4">
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
                  <option value="inherit">Inherit from chat settings</option>
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
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 mb-4">
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

            <p className="text-xs text-muted-foreground text-center mt-3">
              The agent will run in the background. You can monitor progress in the sidebar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RunAgentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-zinc-900/30 to-black/70 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RunAgentContent />
    </Suspense>
  );
}
