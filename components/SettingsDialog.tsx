import React, { useEffect, useState } from 'react';
import { X, Settings, Save, RotateCcw, Shield, Zap, Code2, Plus, Trash2, Wrench, Folder, FolderOpen, Terminal, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';

// Types for config
interface GeminiIgnoreConfig {
    patterns: string[];
    enabled: boolean;
}

interface TrustedFolder {
    id: string;
    path: string;
    description?: string;
    addedAt: number;
}

interface CustomCommand {
    id: string;
    name: string;
    description: string;
    command: string;
    enabled: boolean;
    createdAt: number;
}

// Types for presets and custom tools
interface ModelPreset {
  id: string;
  name: string;
  description?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  routing?: {
    enabled: boolean;
    conditions: Array<{
      type: 'keyword' | 'length';
      keywords?: string[];
      minLength?: number;
      maxLength?: number;
      model: string;
      temperature?: number;
    }>;
  };
}

interface CustomTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ChatSettings {
  model: string;
  systemInstruction: string;
  toolPermissionStrategy: 'safe' | 'auto';
  ui: {
    footer: {
      hideModelInfo: boolean;
      hideContextPercentage: boolean;
    };
    showMemoryUsage: boolean;
  };
  modelSettings: {
    compressionThreshold: number;
    maxSessionTurns: number;
    tokenBudget: number;
  };
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
}

const FALLBACK_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', icon: Code2 },
  { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', icon: Zap },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', icon: Code2 },
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', icon: Zap },
  { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', icon: Zap },
];

export function SettingsDialog({ open, onClose, settings, onSave }: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [models, setModels] = useState<typeof FALLBACK_MODELS>(FALLBACK_MODELS);
  const [defaultModel, setDefaultModel] = useState('gemini-2.5-pro');
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('balanced');
  const [showAddTool, setShowAddTool] = useState(false);
  const [newTool, setNewTool] = useState<Partial<CustomTool>>({ name: '', description: '', enabled: true });

  // Config state for new features
  const [geminiIgnore, setGeminiIgnore] = useState<GeminiIgnoreConfig>({ patterns: [], enabled: true });
  const [trustedFolders, setTrustedFolders] = useState<TrustedFolder[]>([]);
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const [newIgnorePattern, setNewIgnorePattern] = useState('');
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newCommand, setNewCommand] = useState<Partial<CustomCommand>>({ name: '', description: '', command: '', enabled: true });

  // Fetch models, presets, custom tools, and config from API
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch('/api/models').then(r => r.json()).catch(() => ({ known: [], current: 'gemini-2.5-flash' })),
      fetch('/api/presets').then(r => r.json()).catch(() => ({ presets: [] })),
      fetch('/api/custom-tools').then(r => r.json()).catch(() => ({ tools: [] })),
      fetch('/api/config').then(r => r.json()).catch(() => ({})),
    ]).then(([modelsData, presetsData, toolsData, configData]) => {
      // Set models
      const modelList = (modelsData.known || []).map((m: { id: string; name?: string; tier?: string }) => ({
        id: m.id,
        name: m.name || m.id,
        icon: m.tier === 'pro' ? Code2 : Zap,
      }));
      if (modelList.length > 0) {
        setModels(modelList);
        setDefaultModel(modelsData.current || modelList[0].id);
      }
      // Set presets
      if (presetsData.presets) {
        setPresets(presetsData.presets);
      }
      // Set custom tools
      if (toolsData.tools) {
        setCustomTools(toolsData.tools);
      }
      // Set config (new features)
      if (configData.geminiIgnore) {
        setGeminiIgnore(configData.geminiIgnore);
      }
      if (configData.trustedFolders) {
        setTrustedFolders(configData.trustedFolders);
      }
      if (configData.customCommands) {
        setCustomCommands(configData.customCommands);
      }
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    // Merge provided settings with defaults to ensure all fields exist
    setLocalSettings({
      ...settings,
      toolPermissionStrategy: settings.toolPermissionStrategy ?? 'safe',
      ui: {
        footer: {
          hideModelInfo: settings.ui?.footer?.hideModelInfo ?? false,
          hideContextPercentage: settings.ui?.footer?.hideContextPercentage ?? false,
        },
        showMemoryUsage: settings.ui?.showMemoryUsage ?? true,
      },
      modelSettings: {
        compressionThreshold: settings.modelSettings?.compressionThreshold ?? 0.5,
        maxSessionTurns: settings.modelSettings?.maxSessionTurns ?? -1,
        tokenBudget: settings.modelSettings?.tokenBudget ?? 2000,
      }
    });
  }, [settings, open]);

  const handleSave = async () => {
    // Save chat settings
    onSave(localSettings);

    // Save new config (geminiignore, trusted folders, custom commands)
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiIgnore,
          trustedFolders,
          customCommands,
        }),
      });
    } catch (error) {
      console.error('Failed to save config:', error);
    }

    onClose();
  };

  const handleReset = () => {
    setLocalSettings({
        model: defaultModel,
        systemInstruction: '',
        toolPermissionStrategy: 'safe',
        ui: {
          footer: {
            hideModelInfo: false,
            hideContextPercentage: false,
          },
          showMemoryUsage: true,
        },
        modelSettings: {
          compressionThreshold: 0.5,
          maxSessionTurns: -1,
          tokenBudget: 2000,
        }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2 font-medium text-lg">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Preset Selection */}
          <Select
            label="Model Preset"
            value={selectedPreset}
            onChange={(value) => {
              setSelectedPreset(value);
              const preset = presets.find(p => p.id === value);
              if (preset) {
                setLocalSettings(s => ({
                  ...s,
                  model: preset.model,
                }));
              }
            }}
            options={presets.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description,
              icon: p.model.includes('pro') ? Code2 : Zap,
            }))}
            description="Select a preset configuration for different use cases."
          />

          {/* Model Selection */}
          <Select
            label="Model"
            value={localSettings.model}
            onChange={(value) => setLocalSettings(s => ({ ...s, model: value }))}
            options={models}
            description="Select the AI model to use."
          />

          {/* System Instruction */}
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">System Instruction</label>
            <textarea 
              value={localSettings.systemInstruction}
              onChange={(e) => setLocalSettings(s => ({ ...s, systemInstruction: e.target.value }))}
              placeholder="e.g. You are a helpful coding assistant..."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Tool Permissions */}
          <Select
            label="Tool Permission Strategy"
            value={localSettings.toolPermissionStrategy}
            onChange={(value) => setLocalSettings(s => ({
              ...s,
              toolPermissionStrategy: value as 'safe' | 'auto'
            }))}
            options={[
              { id: 'safe', name: 'Safe', description: 'Approve / Deny / Allow Session', icon: Shield },
              { id: 'auto', name: 'Auto', description: 'Always Allow', icon: Zap },
            ]}
            description="Safe mode prompts for each privileged tool call. Auto mode sends tool calls without confirmation."
          />

          {/* UI Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">UI Settings</h3>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Hide Model Info (Footer)</label>
              <input 
                type="checkbox"
                checked={localSettings.ui.footer.hideModelInfo}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, footer: { ...s.ui.footer, hideModelInfo: e.target.checked } }
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Hide Context Percentage</label>
              <input 
                type="checkbox"
                checked={localSettings.ui.footer.hideContextPercentage}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, footer: { ...s.ui.footer, hideContextPercentage: e.target.checked } }
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Show Memory Usage</label>
              <input 
                type="checkbox"
                checked={localSettings.ui.showMemoryUsage}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, showMemoryUsage: e.target.checked } }
                ))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
          </div>

          {/* Model Configuration */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Model Configuration</h3>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Compression Threshold <span className="text-muted-foreground font-normal">(default: 50%)</span></label>
                <span className="text-sm text-muted-foreground">{localSettings.modelSettings.compressionThreshold}</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.1"
                value={localSettings.modelSettings.compressionThreshold}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, compressionThreshold: parseFloat(e.target.value) }
                }))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Session Turns (-1 for infinite)</label>
              <input
                type="number"
                value={localSettings.modelSettings.maxSessionTurns}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, maxSessionTurns: parseInt(e.target.value) }
                }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Shell Token Budget</label>
              <input
                type="number"
                value={localSettings.modelSettings.tokenBudget}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, tokenBudget: parseInt(e.target.value) }
                }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Custom Tools */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Custom Tools</h3>

            {customTools.length > 0 && (
              <div className="space-y-2">
                {customTools.map(tool => (
                  <div key={tool.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{tool.name}</div>
                        <div className="text-xs text-muted-foreground">{tool.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={tool.enabled}
                        onChange={async (e) => {
                          const updated = customTools.map(t =>
                            t.id === tool.id ? { ...t, enabled: e.target.checked } : t
                          );
                          setCustomTools(updated);
                          await fetch('/api/custom-tools', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...tool, enabled: e.target.checked }),
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <button
                        onClick={async () => {
                          await fetch(`/api/custom-tools?id=${tool.id}`, { method: 'DELETE' });
                          setCustomTools(customTools.filter(t => t.id !== tool.id));
                        }}
                        className="p-1 hover:bg-destructive/20 rounded text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddTool ? (
              <div className="space-y-2 p-3 border rounded-md">
                <input
                  type="text"
                  placeholder="Tool name"
                  value={newTool.name || ''}
                  onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newTool.description || ''}
                  onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!newTool.name) return;
                      const tool: CustomTool = {
                        id: `custom-${Date.now()}`,
                        name: newTool.name,
                        description: newTool.description || '',
                        enabled: true,
                      };
                      await fetch('/api/custom-tools', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(tool),
                      });
                      setCustomTools([...customTools, tool]);
                      setNewTool({ name: '', description: '', enabled: true });
                      setShowAddTool(false);
                    }}
                    className="flex-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTool(false);
                      setNewTool({ name: '', description: '', enabled: true });
                    }}
                    className="flex-1 px-3 py-1 border rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddTool(true)}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                Add Custom Tool
              </button>
            )}
          </div>

          {/* GeminiIgnore */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                .geminiignore
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Enabled</label>
                <input
                  type="checkbox"
                  checked={geminiIgnore.enabled}
                  onChange={(e) => setGeminiIgnore({ ...geminiIgnore, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure patterns to ignore files during AI operations.
            </p>

            {geminiIgnore.patterns.length > 0 && (
              <div className="space-y-2">
                {geminiIgnore.patterns.map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <code className="text-sm font-mono">{pattern}</code>
                    <button
                      onClick={() => {
                        const newPatterns = geminiIgnore.patterns.filter((_, i) => i !== index);
                        setGeminiIgnore({ ...geminiIgnore, patterns: newPatterns });
                      }}
                      className="p-1 hover:bg-destructive/20 rounded text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add pattern (e.g., *.log, node_modules/, **/dist)"
                value={newIgnorePattern}
                onChange={(e) => setNewIgnorePattern(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newIgnorePattern.trim()) {
                    setGeminiIgnore({
                      ...geminiIgnore,
                      patterns: [...geminiIgnore.patterns, newIgnorePattern.trim()]
                    });
                    setNewIgnorePattern('');
                  }
                }}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <button
                onClick={() => {
                  if (newIgnorePattern.trim()) {
                    setGeminiIgnore({
                      ...geminiIgnore,
                      patterns: [...geminiIgnore.patterns, newIgnorePattern.trim()]
                    });
                    setNewIgnorePattern('');
                  }
                }}
                className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Trusted Folders */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Trusted Folders
            </h3>
            <p className="text-xs text-muted-foreground">
              Mark folders as trusted for file operations without confirmation.
            </p>

            {trustedFolders.length > 0 && (
              <div className="space-y-2">
                {trustedFolders.map((folder) => (
                  <div key={folder.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{folder.path}</div>
                        {folder.description && (
                          <div className="text-xs text-muted-foreground">{folder.description}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/config/trusted-folders?id=${folder.id}`, { method: 'DELETE' });
                        setTrustedFolders(trustedFolders.filter(f => f.id !== folder.id));
                      }}
                      className="p-1 hover:bg-destructive/20 rounded text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Folder path (e.g., /Users/me/projects)"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <button
                onClick={async () => {
                  if (newFolderPath.trim()) {
                    const res = await fetch('/api/config/trusted-folders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: newFolderPath.trim(), description: '' }),
                    });
                    const data = await res.json();
                    if (data.folder) {
                      setTrustedFolders([...trustedFolders, data.folder]);
                      setNewFolderPath('');
                    }
                  }
                }}
                className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Custom Commands */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Custom Commands
            </h3>
            <p className="text-xs text-muted-foreground">
              Define slash commands (e.g., /build, /test) to run custom actions.
            </p>

            {customCommands.length > 0 && (
              <div className="space-y-2">
                {customCommands.map((cmd) => (
                  <div key={cmd.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">/{cmd.name}</div>
                        <div className="text-xs text-muted-foreground">{cmd.description}</div>
                        <code className="text-xs text-primary">{cmd.command}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cmd.enabled}
                        onChange={async (e) => {
                          const updated = customCommands.map(c =>
                            c.id === cmd.id ? { ...c, enabled: e.target.checked } : c
                          );
                          setCustomCommands(updated);
                          await fetch('/api/config/custom-commands', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: cmd.id, enabled: e.target.checked }),
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <button
                        onClick={async () => {
                          await fetch(`/api/config/custom-commands?id=${cmd.id}`, { method: 'DELETE' });
                          setCustomCommands(customCommands.filter(c => c.id !== cmd.id));
                        }}
                        className="p-1 hover:bg-destructive/20 rounded text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {newCommand.name !== undefined && newCommand.name !== '' ? (
              <div className="space-y-2 p-3 border rounded-md">
                <div className="flex gap-2">
                  <span className="text-sm font-medium self-center">/</span>
                  <input
                    type="text"
                    placeholder="Command name"
                    value={newCommand.name}
                    onChange={(e) => setNewCommand({ ...newCommand, name: e.target.value })}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description"
                  value={newCommand.description || ''}
                  onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <input
                  type="text"
                  placeholder="Command to run (e.g., npm run build)"
                  value={newCommand.command || ''}
                  onChange={(e) => setNewCommand({ ...newCommand, command: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!newCommand.name || !newCommand.command) return;
                      const res = await fetch('/api/config/custom-commands', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newCommand),
                      });
                      const data = await res.json();
                      if (data.command) {
                        setCustomCommands([...customCommands, data.command]);
                        setNewCommand({ name: '', description: '', command: '', enabled: true });
                      }
                    }}
                    className="flex-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setNewCommand({ name: '', description: '', command: '', enabled: true });
                    }}
                    className="flex-1 px-3 py-1 border rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setNewCommand({ name: '', description: '', command: '', enabled: true })}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                Add Custom Command
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
