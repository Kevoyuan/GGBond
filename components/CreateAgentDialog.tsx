import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Sparkles, Settings, Wrench, Check, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}


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



export function CreateAgentDialog({ open, onOpenChange, onSuccess }: CreateAgentDialogProps) {

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
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);


  const resetForm = () => {
    setName('');
    setDisplayName('');
    setDescription('');
    setSystemPrompt('');
    setModel('gemini-2.5-pro');
    setTemperature(1);
    setMaxTurns(20);
    setTimeoutMins(5);
    setSelectedTools([]);
    setError(null);

  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const toggleTool = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool)
        ? prev.filter(t => t !== tool)
        : [...prev, tool]
    );
  };

  const selectAllTools = () => {
    setSelectedTools([...AVAILABLE_TOOLS]);
  };

  const clearAllTools = () => {
    setSelectedTools([]);
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

      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
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
      <div className="w-full max-w-4xl max-h-[85vh] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-semibold text-xl">Create Custom Agent</h2>
              <p className="text-xs text-muted-foreground">Configure your new AI assistant</p>
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
          <div className="mx-5 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-8">

          {/* Section 1: Basic Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Basic Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Command: <code className="bg-muted px-1.5 py-0.5 rounded">/agent {name || 'name'}</code>
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
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this agent do? (e.g., A specialized agent for code review...)"
                  className="w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none h-[152px]"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Configuration */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Wrench className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Configuration & Tools</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Model</label>
                  <ModelSelector
                    value={model}
                    onChange={setModel}
                    variant="form"
                    showInherit={true}
                  />
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
              </div>

              <div className="space-y-4">
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
                    <label className="text-sm font-medium mb-2 block">Timeout (m)</label>
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

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Tools</label>
                    <div className="flex gap-2">
                      <button onClick={selectAllTools} className="text-xs text-primary hover:underline">All</button>
                      <button onClick={clearAllTools} className="text-xs text-muted-foreground hover:underline">None</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 h-20 overflow-y-auto content-start">
                    {AVAILABLE_TOOLS.map((tool) => (
                      <button
                        key={tool}
                        onClick={() => toggleTool(tool)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md border transition-all flex items-center gap-1.5",
                          selectedTools.includes(tool)
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                      >
                        {selectedTools.includes(tool) && <Check className="w-3 h-3" />}
                        {tool}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: System Prompt */}
          <section className="space-y-4 flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 pb-2 border-b shrink-0">
              <Settings className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">System Prompt</h3>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={`You are an expert code reviewer specialized in...

Responsibilities:
- ...`}
                className="flex-1 w-full px-4 py-3 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                The core personality and instruction set for your agent.
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-muted/30 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || !description.trim()}
            className="px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Create Agent
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
