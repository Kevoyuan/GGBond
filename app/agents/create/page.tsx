'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Sparkles, Settings, Wrench, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro' },
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' },
  { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash' },
  { id: 'inherit', name: 'Inherit from settings' },
];

const AVAILABLE_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'TodoWrite',
  'SearchCode',
  'ReadMultipleFiles',
];

type Step = 'basics' | 'config' | 'prompt';

export default function CreateAgentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('basics');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('gemini-2.5-pro');
  const [temperature, setTemperature] = useState(1);
  const [maxTurns, setMaxTurns] = useState(20);
  const [timeoutMins, setTimeoutMins] = useState(5);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: { id: Step; label: string }[] = [
    { id: 'basics', label: 'Basic Info' },
    { id: 'config', label: 'Configuration' },
    { id: 'prompt', label: 'System Prompt' },
  ];

  const toggleTool = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool)
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const selectAllTools = () => setSelectedTools([...AVAILABLE_TOOLS]);
  const clearAllTools = () => setSelectedTools([]);

  const canProceed = () => {
    if (currentStep === 'basics') {
      return name.trim() && description.trim();
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setError('Name and description are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          displayName: displayName.trim() || undefined,
          description: description.trim(),
          systemPrompt: systemPrompt.trim() || undefined,
          model: model === 'inherit' ? undefined : model,
          temperature: temperature !== 1 ? temperature : undefined,
          maxTurns: maxTurns !== 20 ? maxTurns : undefined,
          timeoutMins: timeoutMins !== 5 ? timeoutMins : undefined,
          tools: selectedTools.length > 0 ? selectedTools : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create agent');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-zinc-900/30 to-black/70 p-3 md:p-6">
      <div className="mx-auto max-w-4xl h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] flex flex-col overflow-hidden rounded-2xl border border-zinc-300/30 bg-background shadow-2xl">

        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
          <div className="mx-auto px-6 py-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              <ChevronLeft size={12} />
              Back
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Create Custom Agent</h1>
                <p className="text-sm text-muted-foreground">Step {steps.findIndex(s => s.id === currentStep) + 1} of {steps.length}</p>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 px-6 pb-4">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => canProceed() && setCurrentStep(step.id)}
                  disabled={step.id !== currentStep && !canProceed() && currentStep !== step.id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                    currentStep === step.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted"
                  )}>
                    {index + 1}
                  </span>
                  {step.label}
                </button>
                {index < steps.length - 1 && (
                  <span className="text-muted-foreground/50">/</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* Step 1: Basic Info */}
          {currentStep === 'basics' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Agent Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                    placeholder="my-code-reviewer"
                    className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Used in commands: <code className="bg-muted px-1.5 py-0.5 rounded">/agent {name || 'my-agent'}</code>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Code Reviewer"
                    className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Description <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A specialized agent for code review..."
                    className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none h-24"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {currentStep === 'config' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Temperature: <span className="text-primary font-mono">{temperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Precise</span>
                    <span>Balanced</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Turns</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={maxTurns}
                      onChange={(e) => setMaxTurns(parseInt(e.target.value) || 20)}
                      className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Timeout (mins)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={timeoutMins}
                      onChange={(e) => setTimeoutMins(parseInt(e.target.value) || 5)}
                      className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Tools
                    </label>
                    <div className="flex gap-3 text-xs">
                      <button onClick={selectAllTools} className="text-primary hover:underline">Select All</button>
                      <button onClick={clearAllTools} className="text-muted-foreground hover:underline">Clear</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TOOLS.map((tool) => (
                      <button
                        key={tool}
                        onClick={() => toggleTool(tool)}
                        className={cn(
                          "px-4 py-2 text-sm rounded-lg border transition-all flex items-center gap-2",
                          selectedTools.includes(tool)
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        {selectedTools.includes(tool) && <Check className="w-4 h-4" />}
                        {tool}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {selectedTools.length === 0 ? 'No tools selected - will use all available' : `${selectedTools.length} tools selected`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: System Prompt */}
          {currentStep === 'prompt' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are an expert code reviewer..."
                  className="w-full h-64 px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed"
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Preview</h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {systemPrompt || 'No system prompt defined yet.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-muted/30 flex items-center justify-between">
          <button
            onClick={() => {
              const idx = steps.findIndex(s => s.id === currentStep);
              if (idx > 0) setCurrentStep(steps[idx - 1].id);
            }}
            disabled={currentStep === 'basics'}
            className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep === 'prompt' ? (
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !description.trim()}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Creating...' : 'Create Agent'}
            </button>
          ) : (
            <button
              onClick={() => {
                const idx = steps.findIndex(s => s.id === currentStep);
                if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].id);
              }}
              disabled={!canProceed()}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
