import React, { useEffect, useState } from 'react';
import { X, Settings, Save, RotateCcw, Shield, Zap, Code2, Plus, Trash2, Wrench, Folder, FolderOpen, Terminal, Eye, EyeOff, Clock3, Bot, Download, Keyboard, ChevronDown, Command } from 'lucide-react';
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

interface McpSecurityConfig {
  enabled: boolean;
  allowedServerNames: string[];
  allowedCommandRegex: string[];
  blockedCommandRegex: string[];
  allowedRepoPatterns: string[];
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
    lowLatencyMode: boolean;
    advancedMode: boolean;
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
    maxRetries: number;
  };
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSave: (settings: ChatSettings) => void;
}

interface CoreSettings {
  general: {
    sessionRetention: {
      enabled: boolean;
      maxAge: string;
      maxCount?: number;
      minRetention: string;
    };
  };
  experimental: {
    enableAgents: boolean;
  };
}

interface CoreUpgradeStatus {
  localCoreVersion: string | null;
  globalCliVersion: string | null;
  globalCliPath: string | null;
  installMethod: 'homebrew' | 'npm-global' | 'unknown' | 'missing';
  canUpgrade: boolean;
  upgradeCommand: string | null;
}

interface GeminiKeybinding {
  command: string;
  key: string;
}

const KEYBINDING_COMMAND_OPTIONS = [
  { command: 'input.submit', label: 'Submit prompt', group: 'Input' },
  { command: 'input.queueMessage', label: 'Queue prompt', group: 'Input' },
  { command: 'input.newline', label: 'Insert newline', group: 'Input' },
  { command: 'input.openExternalEditor', label: 'Open external editor', group: 'Input' },
  { command: 'app.toggleYolo', label: 'Toggle YOLO mode', group: 'App' },
  { command: 'app.cycleApprovalMode', label: 'Cycle approval mode', group: 'App' },
  { command: 'app.toggleMarkdown', label: 'Toggle markdown rendering', group: 'App' },
  { command: 'app.showFullTodos', label: 'Toggle full TODO list', group: 'App' },
  { command: 'app.focusShellInput', label: 'Focus shell input', group: 'App' },
  { command: 'app.clearScreen', label: 'Clear and redraw screen', group: 'App' },
  { command: 'background.toggle', label: 'Toggle active background shell', group: 'Background' },
  { command: 'background.kill', label: 'Kill active background shell', group: 'Background' },
  { command: 'suggest.accept', label: 'Accept suggestion', group: 'Suggestions' },
  { command: 'cursor.wordLeft', label: 'Move cursor one word left', group: 'Cursor' },
  { command: 'cursor.wordRight', label: 'Move cursor one word right', group: 'Cursor' },
];

const KEYBINDING_SUGGESTIONS: GeminiKeybinding[] = [
  { command: 'app.toggleYolo', key: 'ctrl+y' },
  { command: 'app.cycleApprovalMode', key: 'shift+tab' },
  { command: 'input.openExternalEditor', key: 'ctrl+x' },
  { command: 'app.toggleMarkdown', key: 'alt+m' },
  { command: 'app.showFullTodos', key: 'ctrl+t' },
  { command: 'background.toggle', key: 'ctrl+b' },
];

const KEYBINDING_SPECIAL_KEYS: Record<string, string> = {
  ' ': 'space',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Escape: 'escape',
  Enter: 'enter',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'delete',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
};

const FALLBACK_MODELS = [
  { id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro-preview', icon: Code2 },
  { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', icon: Code2 },
  { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', icon: Zap },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', icon: Code2 },
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', icon: Zap },
  { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', icon: Zap },
];

export function SettingsDialog({ open, onClose, settings, onSave }: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [models, setModels] = useState<typeof FALLBACK_MODELS>(FALLBACK_MODELS);
  const [defaultModel, setDefaultModel] = useState('gemini-3.1-pro-preview');
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
  const [mcpSecurity, setMcpSecurity] = useState<McpSecurityConfig>({
    enabled: false,
    allowedServerNames: [],
    allowedCommandRegex: [],
    blockedCommandRegex: [],
    allowedRepoPatterns: [],
  });
  const [coreSettings, setCoreSettings] = useState<CoreSettings>({
    general: {
      sessionRetention: {
        enabled: true,
        maxAge: '30d',
        maxCount: 50,
        minRetention: '1d',
      },
    },
    experimental: {
      enableAgents: true,
    },
  });
  const [coreUpgradeStatus, setCoreUpgradeStatus] = useState<CoreUpgradeStatus | null>(null);
  const [coreUpgradeLoading, setCoreUpgradeLoading] = useState(false);
  const [coreUpgradeRunning, setCoreUpgradeRunning] = useState(false);
  const [coreUpgradeMessage, setCoreUpgradeMessage] = useState<string | null>(null);
  const [keybindings, setKeybindings] = useState<GeminiKeybinding[]>([]);
  const [keybindingsDraft, setKeybindingsDraft] = useState('[]');
  const [keybindingsPath, setKeybindingsPath] = useState('');
  const [keybindingsError, setKeybindingsError] = useState<string | null>(null);
  const [showAdvancedKeybindings, setShowAdvancedKeybindings] = useState(false);
  const [recordingRowIndex, setRecordingRowIndex] = useState<number | null>(null);

  const syncDraftFromKeybindings = (next: GeminiKeybinding[]) => {
    setKeybindings(next);
    setKeybindingsDraft(JSON.stringify(next, null, 2));
    setKeybindingsError(null);
  };

  const parseKeybindingsDraft = (): GeminiKeybinding[] | null => {
    try {
      const parsed = JSON.parse(keybindingsDraft);
      if (!Array.isArray(parsed) || parsed.some((entry) =>
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.command !== 'string' ||
        typeof entry.key !== 'string'
      )) {
        setKeybindingsError('Keybindings must be a JSON array of { command, key } objects.');
        return null;
      }
      setKeybindingsError(null);
      return parsed;
    } catch {
      setKeybindingsError('Keybindings JSON is invalid. Fix the syntax before saving.');
      return null;
    }
  };

  const normalizedConflictMap = keybindings.reduce<Record<string, number[]>>((accumulator, binding, index) => {
    const normalizedKey = binding.key.trim().toLowerCase();
    if (!normalizedKey) {
      return accumulator;
    }
    if (!accumulator[normalizedKey]) {
      accumulator[normalizedKey] = [];
    }
    accumulator[normalizedKey].push(index);
    return accumulator;
  }, {});

  const conflictingKeys = Object.entries(normalizedConflictMap).filter(([, indexes]) => indexes.length > 1);
  const conflictingRowIndexes = new Set(conflictingKeys.flatMap(([, indexes]) => indexes));

  const normalizeRecordedKey = (event: React.KeyboardEvent<HTMLInputElement>): string | null => {
    const rawKey = event.key;
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(rawKey)) {
      return null;
    }

    const normalizedKey = KEYBINDING_SPECIAL_KEYS[rawKey]
      || (rawKey.length === 1 ? rawKey.toLowerCase() : rawKey.toLowerCase());

    const parts = [
      event.ctrlKey ? 'ctrl' : null,
      event.metaKey ? 'cmd' : null,
      event.altKey ? 'alt' : null,
      event.shiftKey ? 'shift' : null,
      normalizedKey,
    ].filter(Boolean);

    return parts.join('+');
  };

  // Fetch models, presets, custom tools, and config from API
  useEffect(() => {
    if (!open) return;
    setCoreUpgradeLoading(true);
    setCoreUpgradeMessage(null);
    Promise.all([
      fetch('/api/models').then(r => r.json()).catch(() => ({ known: [], current: 'gemini-3-pro-preview' })),
      fetch('/api/presets').then(r => r.json()).catch(() => ({ presets: [] })),
      fetch('/api/custom-tools').then(r => r.json()).catch(() => ({ tools: [] })),
      fetch('/api/config').then(r => r.json()).catch(() => ({})),
      fetch('/api/settings').then(r => r.json()).catch(() => ({})),
      fetch('/api/core/upgrade').then(r => r.json()).catch(() => null),
      fetch('/api/keybindings').then(r => r.json()).catch(() => null),
    ]).then(([modelsData, presetsData, toolsData, configData, geminiSettings, upgradeData, keybindingsData]) => {
      // Set models
      const modelList: typeof FALLBACK_MODELS = (modelsData.known || []).map((m: { id: string; name?: string; tier?: string }) => ({
        id: m.id,
        name: m.name || m.id,
        icon: m.tier === 'pro' ? Code2 : Zap,
      }));
      const dedupedModels = modelList.filter(
        (model, index, self) => self.findIndex((item) => item.id === model.id) === index
      );
      if (dedupedModels.length > 0) {
        setModels(dedupedModels);
        setDefaultModel(modelsData.current || dedupedModels[0].id);
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
      if (configData.mcpSecurity) {
        setMcpSecurity(configData.mcpSecurity);
      }
      setCoreSettings({
        general: {
          sessionRetention: {
            enabled: geminiSettings?.general?.sessionRetention?.enabled ?? true,
            maxAge: geminiSettings?.general?.sessionRetention?.maxAge ?? '30d',
            maxCount: geminiSettings?.general?.sessionRetention?.maxCount ?? 50,
            minRetention: geminiSettings?.general?.sessionRetention?.minRetention ?? '1d',
          },
        },
        experimental: {
          enableAgents: geminiSettings?.experimental?.enableAgents ?? true,
        },
      });
      if (upgradeData) {
        setCoreUpgradeStatus(upgradeData);
      }
      if (keybindingsData?.keybindings) {
        setKeybindings(keybindingsData.keybindings);
        setKeybindingsDraft(JSON.stringify(keybindingsData.keybindings, null, 2));
        setKeybindingsPath(keybindingsData.path || '');
      } else {
        setKeybindings([]);
        setKeybindingsDraft('[]');
        setKeybindingsPath('');
      }
      setKeybindingsError(null);
    }).catch(() => { }).finally(() => setCoreUpgradeLoading(false));
  }, [open]);

  useEffect(() => {
    // Merge provided settings with defaults to ensure all fields exist
    setLocalSettings({
      ...settings,
      toolPermissionStrategy: settings.toolPermissionStrategy ?? 'safe',
      ui: {
        lowLatencyMode: settings.ui?.lowLatencyMode ?? true,
        advancedMode: settings.ui?.advancedMode ?? false,
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
        maxRetries: settings.modelSettings?.maxRetries ?? 3,
      }
    });
  }, [settings, open]);

  const handleSave = async () => {
    const parsedKeybindings = parseKeybindingsDraft();
    if (!parsedKeybindings) {
      return;
    }
    if (conflictingKeys.length > 0) {
      setKeybindingsError(`Resolve ${conflictingKeys.length} shortcut conflict${conflictingKeys.length === 1 ? '' : 's'} before saving.`);
      return;
    }

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
          mcpSecurity,
        }),
      });
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coreSettings),
      });
      await fetch('/api/keybindings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keybindings: parsedKeybindings }),
      });
      syncDraftFromKeybindings(parsedKeybindings);
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
        lowLatencyMode: true,
        advancedMode: false,
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
        maxRetries: 3,
      }
    });
    setCoreSettings({
      general: {
        sessionRetention: {
          enabled: true,
          maxAge: '30d',
          maxCount: 50,
          minRetention: '1d',
        },
      },
      experimental: {
        enableAgents: true,
      },
    });
    syncDraftFromKeybindings([]);
  };

  const handleCoreUpgrade = async () => {
    setCoreUpgradeRunning(true);
    setCoreUpgradeMessage(null);
    try {
      const response = await fetch('/api/core/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok) {
        setCoreUpgradeMessage(payload.error || 'Failed to run Gemini CLI upgrade.');
        return;
      }

      const beforeVersion = payload.beforeVersion || 'unknown';
      const afterVersion = payload.afterVersion || 'unknown';
      setCoreUpgradeStatus(payload.status || null);
      setCoreUpgradeMessage(`Gemini CLI upgrade finished: ${beforeVersion} -> ${afterVersion}`);
    } catch (error) {
      setCoreUpgradeMessage(error instanceof Error ? error.message : 'Failed to run Gemini CLI upgrade.');
    } finally {
      setCoreUpgradeRunning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">

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
              <label className="text-sm font-medium">Low Latency Mode</label>
              <input
                type="checkbox"
                checked={localSettings.ui.lowLatencyMode}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, lowLatencyMode: e.target.checked }
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Advanced Mode</label>
              <input
                type="checkbox"
                checked={localSettings.ui.advancedMode}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  ui: { ...s.ui, advancedMode: e.target.checked }
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>

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
                  ui: { ...s.ui, showMemoryUsage: e.target.checked }
                }
                ))}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-primary" />
                  Keyboard Shortcuts
                </h3>
                <p className="text-xs text-muted-foreground">
                  Manage Gemini CLI&apos;s global <code>keybindings.json</code> with a table-first editor. This maps directly to upstream keyboard customization in v0.35.x.
                </p>
                {keybindingsPath && (
                  <p className="text-[11px] font-mono text-muted-foreground break-all">
                    {keybindingsPath}
                  </p>
                )}
                {conflictingKeys.length > 0 && (
                  <p className="text-[11px] text-red-500">
                    {conflictingKeys.length} conflict{conflictingKeys.length === 1 ? '' : 's'} detected. Conflicting rows are highlighted below.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncDraftFromKeybindings([...keybindings, { command: '', key: '' }])}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-input hover:bg-muted transition-colors inline-flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseKeybindingsDraft();
                    if (parsed) syncDraftFromKeybindings(parsed);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-input hover:bg-muted transition-colors"
                >
                  Revert
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_auto] gap-3 px-4 py-3 border-b border-border/60 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span>Command</span>
                <span>Key</span>
                <span className="text-right">Action</span>
              </div>

              <div className="divide-y divide-border/50">
                {keybindings.length === 0 ? (
                  <div className="px-4 py-8 text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border/60 bg-background/70">
                      <Command className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No custom keybindings yet</p>
                    <p className="text-xs text-muted-foreground max-w-[56ch] mx-auto">
                      Add alternative bindings, or prefix a command with <code>-</code> to unbind an upstream default shortcut.
                    </p>
                  </div>
                ) : (
                  keybindings.map((binding, index) => (
                    <div
                      key={`${binding.command}:${binding.key}:${index}`}
                      className={cn(
                        "grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_auto] gap-3 px-4 py-3 items-start bg-background/50",
                        conflictingRowIndexes.has(index) && "bg-red-500/5"
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <input
                          list="gemini-keybinding-commands"
                          value={binding.command}
                          onChange={(e) => {
                            const next = [...keybindings];
                            next[index] = { ...next[index], command: e.target.value };
                            syncDraftFromKeybindings(next);
                          }}
                          placeholder="input.submit"
                          className={cn(
                            "flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            conflictingRowIndexes.has(index) && "border-red-500/50 focus-visible:ring-red-500/30"
                          )}
                        />
                        <p className="text-[11px] text-muted-foreground truncate">
                          {KEYBINDING_COMMAND_OPTIONS.find((option) => option.command === binding.command)?.label || 'Custom or unbind command'}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <input
                          readOnly
                          value={binding.key}
                          onFocus={() => setRecordingRowIndex(index)}
                          onBlur={() => {
                            if (recordingRowIndex === index) {
                              setRecordingRowIndex(null);
                            }
                          }}
                          onKeyDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            if (!event.ctrlKey && !event.metaKey && !event.altKey && ['Backspace', 'Delete'].includes(event.key)) {
                              const next = [...keybindings];
                              next[index] = { ...next[index], key: '' };
                              syncDraftFromKeybindings(next);
                              return;
                            }

                            const recordedKey = normalizeRecordedKey(event);
                            if (!recordedKey) {
                              return;
                            }

                            const next = [...keybindings];
                            next[index] = { ...next[index], key: recordedKey };
                            syncDraftFromKeybindings(next);
                            setRecordingRowIndex(null);
                            event.currentTarget.blur();
                          }}
                          placeholder="Click and press keys"
                          className={cn(
                            "flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
                            recordingRowIndex === index && "border-primary bg-primary/5 ring-2 ring-primary/20",
                            conflictingRowIndexes.has(index) && "border-red-500/50 focus-visible:ring-red-500/30"
                          )}
                        />
                        <p className={cn(
                          "text-[11px]",
                          conflictingRowIndexes.has(index) ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {recordingRowIndex === index
                            ? 'Recording. Press a key combo, or Backspace/Delete to clear.'
                            : conflictingRowIndexes.has(index)
                              ? `Conflicts with ${normalizedConflictMap[binding.key.trim().toLowerCase()]?.length ?? 1} rows using ${binding.key || 'this shortcut'}.`
                              : 'Click to record a key combo'}
                        </p>
                      </div>

                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = keybindings.filter((_, currentIndex) => currentIndex !== index);
                            syncDraftFromKeybindings(next);
                          }}
                          className="h-10 px-3 rounded-lg border border-border/60 bg-background hover:bg-muted transition-colors text-xs font-medium inline-flex items-center gap-1.5 active:scale-[0.98]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <datalist id="gemini-keybinding-commands">
              {KEYBINDING_COMMAND_OPTIONS.map((option) => (
                <option key={option.command} value={option.command}>
                  {option.group} - {option.label}
                </option>
              ))}
            </datalist>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Starter bindings</p>
                  <p className="text-[11px] text-muted-foreground">Quick-add common actions, then fine-tune them in the table.</p>
                </div>
                <span className={cn(
                  "text-[11px]",
                  conflictingKeys.length > 0 ? "text-red-500 font-medium" : "text-muted-foreground"
                )}>
                  {keybindings.length} active rows{conflictingKeys.length > 0 ? `, ${conflictingKeys.length} conflict${conflictingKeys.length === 1 ? '' : 's'}` : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {KEYBINDING_SUGGESTIONS.map((binding) => (
                <button
                  key={`${binding.command}:${binding.key}`}
                  type="button"
                  onClick={() => {
                    const next = [...keybindings, binding];
                    syncDraftFromKeybindings(next);
                  }}
                  className="text-left p-3 rounded-xl border border-border/60 bg-background/70 hover:bg-muted/40 transition-colors active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{binding.command}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {KEYBINDING_COMMAND_OPTIONS.find((option) => option.command === binding.command)?.label || 'Shortcut'}
                      </div>
                    </div>
                    <kbd className="px-2.5 py-1 rounded-lg border border-border/60 bg-muted text-[10px] font-mono font-semibold text-foreground">
                      {binding.key}
                    </kbd>
                  </div>
                </button>
              ))}
            </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedKeybindings((value) => !value)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-xs font-medium">Advanced JSON editor</p>
                  <p className="text-[11px] text-muted-foreground">Use the raw upstream format for bulk edits, copy/paste, or unbind-heavy changes.</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showAdvancedKeybindings ? 'rotate-180' : ''}`} />
              </button>

              {showAdvancedKeybindings && (
                <div className="border-t border-border/60 p-4 space-y-3 bg-background/70">
                  <textarea
                    value={keybindingsDraft}
                    onChange={(e) => {
                      setKeybindingsDraft(e.target.value);
                      setKeybindingsError(null);
                    }}
                    spellCheck={false}
                    className="flex min-h-[220px] w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Example: <code>{`{ "command": "-app.toggleYolo", "key": "ctrl+y" }`}</code> removes a default binding.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseKeybindingsDraft();
                        if (parsed) syncDraftFromKeybindings(parsed);
                      }}
                      className="text-xs px-3 py-2 rounded-lg border border-border/60 bg-background hover:bg-muted transition-colors active:scale-[0.98]"
                    >
                      Apply JSON
                    </button>
                  </div>
                </div>
              )}
            </div>

            {keybindingsError && (
              <p className="text-xs text-red-500">{keybindingsError}</p>
            )}
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Retries</label>
              <input
                type="number"
                value={localSettings.modelSettings.maxRetries}
                onChange={(e) => setLocalSettings(s => ({
                  ...s,
                  modelSettings: { ...s.modelSettings, maxRetries: parseInt(e.target.value) }
                }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Applies to normal models. Preview models retry less aggressively to keep the app responsive.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Gemini CLI v0.35.2</h3>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock3 className="w-4 h-4 text-primary" />
                    Session Retention
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stable Gemini CLI now defaults to retaining chat history for 30 days. Control cleanup here instead of relying on implicit defaults.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={coreSettings.general.sessionRetention.enabled}
                  onChange={(e) => setCoreSettings((prev) => ({
                    ...prev,
                    general: {
                      sessionRetention: {
                        ...prev.general.sessionRetention,
                        enabled: e.target.checked,
                      },
                    },
                  }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium">Max Age</span>
                  <input
                    type="text"
                    value={coreSettings.general.sessionRetention.maxAge}
                    onChange={(e) => setCoreSettings((prev) => ({
                      ...prev,
                      general: {
                        sessionRetention: {
                          ...prev.general.sessionRetention,
                          maxAge: e.target.value,
                        },
                      },
                    }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium">Max Count</span>
                  <input
                    type="number"
                    value={coreSettings.general.sessionRetention.maxCount ?? 50}
                    onChange={(e) => setCoreSettings((prev) => ({
                      ...prev,
                      general: {
                        sessionRetention: {
                          ...prev.general.sessionRetention,
                          maxCount: Number.isFinite(parseInt(e.target.value, 10)) ? parseInt(e.target.value, 10) : undefined,
                        },
                      },
                    }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium">Min Retention</span>
                  <input
                    type="text"
                    value={coreSettings.general.sessionRetention.minRetention}
                    onChange={(e) => setCoreSettings((prev) => ({
                      ...prev,
                      general: {
                        sessionRetention: {
                          ...prev.general.sessionRetention,
                          minRetention: e.target.value,
                        },
                      },
                    }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Bot className="w-4 h-4 text-primary" />
                    Experimental Agents
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required for remote A2A agents. Gemini CLI v0.35.2 continues to use the streamlined auth metadata introduced after the legacy `agent_card_requires_auth` flag was removed, so GGBond relies on the remaining auth fields only.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={coreSettings.experimental.enableAgents}
                  onChange={(e) => setCoreSettings((prev) => ({
                    ...prev,
                    experimental: {
                      ...prev.experimental,
                      enableAgents: e.target.checked,
                    },
                  }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Code2 className="w-4 h-4 text-primary" />
                  Local v0.35.2 alignment
                </div>
                <p className="text-xs text-muted-foreground">
                  GGBond follows Gemini CLI Core `v0.35.2`, but intentionally keeps `code` as the default mode instead of switching the whole product to upstream&apos;s default Plan Mode.
                </p>
                <p className="text-xs text-muted-foreground">
                  Per-model token usage is still surfaced locally, while newer upstream improvements like keyboard customization, Vim polish, sandbox isolation, and JIT context discovery continue to flow through the core runtime unless GGBond adds explicit UI for them.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Download className="w-4 h-4 text-primary" />
                    Core Upgrade
                  </div>
                  <p className="text-xs text-muted-foreground">
                    GGBond ships with Gemini CLI Core <code>v{coreUpgradeStatus?.localCoreVersion || 'unknown'}</code> and keeps Code mode as the product default. Use this to inspect or upgrade the external Gemini CLI install on this machine.
                  </p>
                </div>
                <button
                  onClick={handleCoreUpgrade}
                  disabled={coreUpgradeRunning || coreUpgradeLoading || !coreUpgradeStatus?.canUpgrade}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    coreUpgradeRunning || coreUpgradeLoading || !coreUpgradeStatus?.canUpgrade
                      ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  {coreUpgradeRunning ? 'Upgrading...' : 'Upgrade CLI'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-md border border-border/60 bg-background/60 p-3 space-y-1">
                  <div className="text-muted-foreground">Bundled core</div>
                  <div className="font-mono">{coreUpgradeStatus?.localCoreVersion || 'Unavailable'}</div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-3 space-y-1">
                  <div className="text-muted-foreground">External Gemini CLI</div>
                  <div className="font-mono">{coreUpgradeStatus?.globalCliVersion || 'Not detected'}</div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Install method: <span className="font-mono text-foreground">{coreUpgradeStatus?.installMethod || 'unknown'}</span>
                </p>
                {coreUpgradeStatus?.upgradeCommand && (
                  <p>
                    Upgrade command: <code>{coreUpgradeStatus.upgradeCommand}</code>
                  </p>
                )}
                {coreUpgradeStatus?.globalCliPath && (
                  <p className="break-all">
                    CLI path: <code>{coreUpgradeStatus.globalCliPath}</code>
                  </p>
                )}
                {coreUpgradeMessage && (
                  <p className="text-foreground">{coreUpgradeMessage}</p>
                )}
              </div>
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

          {/* MCP Security */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                MCP Allowlist
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Enabled</label>
                <input
                  type="checkbox"
                  checked={mcpSecurity.enabled}
                  onChange={(e) => setMcpSecurity({ ...mcpSecurity, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Restrict MCP server creation/installation to allowed names, command patterns and repository sources.
            </p>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Allowed server names (one per line)</span>
                <textarea
                  rows={3}
                  value={mcpSecurity.allowedServerNames.join('\n')}
                  onChange={(e) => setMcpSecurity({
                    ...mcpSecurity,
                    allowedServerNames: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                  })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Allowed command regex (one per line)</span>
                <textarea
                  rows={3}
                  value={mcpSecurity.allowedCommandRegex.join('\n')}
                  onChange={(e) => setMcpSecurity({
                    ...mcpSecurity,
                    allowedCommandRegex: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                  })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Blocked command regex (one per line)</span>
                <textarea
                  rows={3}
                  value={mcpSecurity.blockedCommandRegex.join('\n')}
                  onChange={(e) => setMcpSecurity({
                    ...mcpSecurity,
                    blockedCommandRegex: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                  })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Allowed repo URL patterns (one per line)</span>
                <textarea
                  rows={3}
                  value={mcpSecurity.allowedRepoPatterns.join('\n')}
                  onChange={(e) => setMcpSecurity({
                    ...mcpSecurity,
                    allowedRepoPatterns: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                  })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                />
              </label>
            </div>
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
