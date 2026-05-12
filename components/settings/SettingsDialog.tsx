import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  X,
  Settings,
  Save,
  RotateCcw,
  Shield,
  Zap,
  Code2,
  Plus,
  Trash2,
  Wrench,
  Folder,
  FolderOpen,
  Terminal as TerminalIcon,
  Eye,
  Clock3,
  Bot,
  Download,
  Keyboard,
  ChevronDown,
  Command,
  Monitor,
  Package,
  Activity,
  Info,
  RefreshCw,
  AlertTriangle,
  Server,
  Database,
  Search,
  Tag,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  User,
  Loader2,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { UISettingsSection } from './sections/UISettingsSection';
import { ModelConfigSection } from './sections/ModelConfigSection';
import { CustomToolsSection, CustomTool } from './sections/CustomToolsSection';
import packageJson from '../../package.json';

// --- Types ---

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
  initialTab?: SettingsTab;
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

interface BootEvent {
  name: string;
  ts?: number;
  elapsedMs: number;
  meta?: Record<string, unknown>;
}

interface DiagnosticsData {
  status?: string;
  engine?: string;
  port?: number | string;
  error?: string;
  _fallback?: boolean;
  client?: {
    cachedSidecarPort?: number | null;
    lastResolveFoundLivePort?: boolean;
    resolvingSidecarPort?: boolean;
    forcedRefreshInFlight?: boolean;
    health?: Array<{
      port: number;
      ok: boolean;
      ttlMs: number;
      circuitOpen: boolean;
      failures: number;
    }>;
    consecutiveFailures?: Array<{
      port: number;
      failures: number;
      circuitOpen: boolean;
    }>;
  };
  db?: {
    dbPath: string;
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    hasArchivedColumn: boolean;
  };
  events?: BootEvent[];
}

interface GalleryExtension {
  id: string;
  name: string;
  description: string;
  installCommand: string;
  category?: string;
  author?: string;
  githubUrl?: string;
}

// --- Constants ---

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

type SettingsTab = 'general' | 'extensions' | 'diagnostics' | 'about';

// --- Utility Functions ---

function formatMs(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

// --- Component ---

export function SettingsDialog({ open, onClose, settings, onSave, initialTab }: SettingsDialogProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [models, setModels] = useState<typeof FALLBACK_MODELS>(FALLBACK_MODELS);
  const [defaultModel, setDefaultModel] = useState('gemini-3.1-pro-preview');
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('balanced');

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

  // Diagnostics State
  const [diagnosticsData, setDiagnosticsData] = useState<DiagnosticsData | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  // Extensions State
  const [galleryExtensions, setGalleryExtensions] = useState<GalleryExtension[]>([]);
  const [galleryCategories, setGalleryCategories] = useState<string[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [installingExtension, setInstallingExtension] = useState<string | null>(null);
  const [installedExtensionNames, setInstalledExtensionNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

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

  const normalizedConflictMap = useMemo(() => keybindings.reduce<Record<string, number[]>>((accumulator, binding, index) => {
    const normalizedKey = binding.key.trim().toLowerCase();
    if (!normalizedKey) {
      return accumulator;
    }
    if (!accumulator[normalizedKey]) {
      accumulator[normalizedKey] = [];
    }
    accumulator[normalizedKey].push(index);
    return accumulator;
  }, {}), [keybindings]);

  const conflictingKeys = Object.entries(normalizedConflictMap).filter(([, indexes]) => indexes.length > 1);
  const conflictingRowIndexes = useMemo(() => new Set(conflictingKeys.flatMap(([, indexes]) => indexes)), [conflictingKeys]);

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

  // --- Effects ---

  // Initial data loading
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
      if (presetsData.presets) setPresets(presetsData.presets);
      if (toolsData.tools) setCustomTools(toolsData.tools);
      if (configData.geminiIgnore) setGeminiIgnore(configData.geminiIgnore);
      if (configData.trustedFolders) setTrustedFolders(configData.trustedFolders);
      if (configData.customCommands) setCustomCommands(configData.customCommands);
      if (configData.mcpSecurity) setMcpSecurity(configData.mcpSecurity);

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

      if (upgradeData) setCoreUpgradeStatus(upgradeData);
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

  // Load Diagnostics
  const fetchDiagnostics = useCallback(async () => {
    setIsLoadingDiagnostics(true);
    setDiagnosticsError(null);
    try {
      const response = await fetch('/api/diagnostics');
      const payload = await response.json().catch(() => null) as DiagnosticsData | null;
      if (payload?._fallback) {
        setDiagnosticsData(payload);
        setDiagnosticsError(payload.error ?? null);
        return;
      }
      if (!response.ok || !payload) {
        throw new Error(payload?.error || `Diagnostics returned ${response.status}`);
      }
      setDiagnosticsData(payload);
    } catch (err) {
      setDiagnosticsError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingDiagnostics(false);
    }
  }, []);

  // Load Extensions Gallery
  const loadGallery = useCallback(async () => {
    setIsLoadingGallery(true);
    setGalleryError(null);
    try {
      const [galleryRes, installedRes] = await Promise.all([
        fetch('/api/mcp/gallery'),
        fetch('/api/extensions'),
      ]);
      if (!galleryRes.ok) throw new Error('Failed to load extensions gallery');
      const data = await galleryRes.json() as { extensions: GalleryExtension[]; categories: string[] };
      setGalleryExtensions(data.extensions);
      setGalleryCategories(data.categories);
      if (installedRes.ok) {
        const installedData = await installedRes.json() as Array<{ name?: string }>;
        setInstalledExtensionNames(new Set(
          installedData.map((item) => (item.name || '').trim().toLowerCase()).filter(Boolean)
        ));
      }
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setIsLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'diagnostics') void fetchDiagnostics();
    if (activeTab === 'extensions') void loadGallery();
  }, [activeTab, fetchDiagnostics, loadGallery, open]);

  // --- Handlers ---

  const handleSave = async () => {
    const parsedKeybindings = parseKeybindingsDraft();
    if (!parsedKeybindings) return;
    if (conflictingKeys.length > 0) {
      setKeybindingsError(`Resolve ${conflictingKeys.length} shortcut conflict${conflictingKeys.length === 1 ? '' : 's'} before saving.`);
      return;
    }

    onSave(localSettings);
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiIgnore, trustedFolders, customCommands, mcpSecurity }),
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
        footer: { hideModelInfo: false, hideContextPercentage: false },
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
        sessionRetention: { enabled: true, maxAge: '30d', maxCount: 50, minRetention: '1d' },
      },
      experimental: { enableAgents: true },
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
      setCoreUpgradeStatus(payload.status || null);
      setCoreUpgradeMessage(`Gemini CLI upgrade finished: ${payload.beforeVersion || 'unknown'} -> ${payload.afterVersion || 'unknown'}`);
    } catch (error) {
      setCoreUpgradeMessage(error instanceof Error ? error.message : 'Failed to run Gemini CLI upgrade.');
    } finally {
      setCoreUpgradeRunning(false);
    }
  };

  const handleInstallExtension = async (extension: GalleryExtension) => {
    setInstallingExtension(extension.id);
    try {
      const urlMatch = extension.installCommand.match(/https:\/\/[^\s]+/);
      if (!urlMatch) throw new Error('Invalid install command');
      const repoUrl = urlMatch[0];
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'installExtension', name: extension.name, repoUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to install extension');
      }
      setInstalledExtensionNames((prev) => new Set(prev).add(extension.name.trim().toLowerCase()));
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : 'Failed to install extension');
    } finally {
      setInstallingExtension(null);
    }
  };

  const filteredExtensions = useMemo(() => {
    let filtered = galleryExtensions;
    if (selectedCategory) filtered = filtered.filter(ext => ext.category === selectedCategory);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ext => ext.name.toLowerCase().includes(query) || ext.description.toLowerCase().includes(query));
    }
    return filtered;
  }, [galleryExtensions, searchQuery, selectedCategory]);

  const bootEvents = useMemo(() => diagnosticsData?.events ?? [], [diagnosticsData?.events]);

  if (!open) return null;

  // --- Sub-renderers ---

  const renderGeneralTab = () => (
    <div className="space-y-6">
      {/* Theme Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Monitor className="w-4 h-4 text-primary" />
          Appearance
        </h3>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Theme</div>
            <div className="text-xs text-muted-foreground">Customize application look and feel</div>
          </div>
          <div className="flex p-1 rounded-lg bg-background border gap-1">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'light' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
              )}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                theme === 'dark' ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
              )}
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Model Settings
        </h3>
        <Select
          label="Model Preset"
          value={selectedPreset}
          onChange={(value) => {
            setSelectedPreset(value);
            const preset = presets.find(p => p.id === value);
            if (preset) setLocalSettings(s => ({ ...s, model: preset.model }));
          }}
          options={presets.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            icon: p.model.includes('pro') ? Code2 : Zap,
          }))}
          description="Select a preset configuration for different use cases."
        />
        <Select
          label="Model"
          value={localSettings.model}
          onChange={(value) => setLocalSettings(s => ({ ...s, model: value }))}
          options={models}
          description="Select the AI model to use."
        />
      </div>

      {/* Permissions & Behavior */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Behavior
        </h3>
        <Select
          label="Tool Permission Strategy"
          value={localSettings.toolPermissionStrategy}
          onChange={(value) => setLocalSettings(s => ({
            ...s,
            toolPermissionStrategy: value as 'safe' | 'auto'
          }))}
          options={[
            { id: 'safe', name: 'Safe Mode', description: 'Approve / Deny / Allow Session', icon: Shield },
            { id: 'auto', name: 'Auto Mode', description: 'Always Allow', icon: Zap },
          ]}
          description="Safe mode prompts for each tool call. Auto mode executes without confirmation."
        />
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">System Instruction</label>
          <textarea
            value={localSettings.systemInstruction}
            onChange={(e) => setLocalSettings(s => ({ ...s, systemInstruction: e.target.value }))}
            placeholder="e.g. You are a helpful coding assistant..."
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
          />
        </div>
      </div>

      {/* UI Controls */}
      <UISettingsSection localSettings={localSettings} setLocalSettings={setLocalSettings} />

      {/* Keyboard Shortcuts */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={() => syncDraftFromKeybindings([...keybindings, { command: '', key: '' }])}
            className="text-xs px-2.5 py-1.5 rounded-md border border-input hover:bg-muted transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        {conflictingKeys.length > 0 && (
          <p className="text-[11px] text-red-500 font-medium">{conflictingKeys.length} conflicts detected.</p>
        )}
        <div className="rounded-lg border overflow-hidden">
          <div className="divide-y">
            {keybindings.map((binding, index) => (
              <div key={index} className={cn("grid grid-cols-[1fr_120px_auto] gap-2 p-2 items-center", conflictingRowIndexes.has(index) && "bg-red-500/5")}>
                <input
                  list="gemini-keybinding-commands"
                  value={binding.command}
                  onChange={(e) => {
                    const next = [...keybindings];
                    next[index] = { ...next[index], command: e.target.value };
                    syncDraftFromKeybindings(next);
                  }}
                  className="bg-transparent border-none text-xs font-mono focus:ring-0 px-1"
                  placeholder="command.id"
                />
                <input
                  readOnly
                  value={binding.key}
                  onFocus={() => setRecordingRowIndex(index)}
                  onBlur={() => setRecordingRowIndex(null)}
                  onKeyDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!e.ctrlKey && !e.metaKey && !e.altKey && ['Backspace', 'Delete'].includes(e.key)) {
                      const next = [...keybindings];
                      next[index] = { ...next[index], key: '' };
                      syncDraftFromKeybindings(next);
                      return;
                    }
                    const recordedKey = normalizeRecordedKey(e);
                    if (recordedKey) {
                      const next = [...keybindings];
                      next[index] = { ...next[index], key: recordedKey };
                      syncDraftFromKeybindings(next);
                      e.currentTarget.blur();
                    }
                  }}
                  className={cn(
                    "text-center py-1 rounded bg-muted/50 text-[11px] font-mono",
                    recordingRowIndex === index && "ring-2 ring-primary"
                  )}
                  placeholder="Record..."
                />
                <button
                  onClick={() => syncDraftFromKeybindings(keybindings.filter((_, i) => i !== index))}
                  className="p-1 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Runtime Configs */}
      <ModelConfigSection localSettings={localSettings} setLocalSettings={setLocalSettings} />

      <div className="space-y-4 pt-4 border-t">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          Runtime Config
        </h3>
        {/* GeminiIgnore */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">.geminiignore Patterns</label>
            <input
              type="checkbox"
              checked={geminiIgnore.enabled}
              onChange={(e) => setGeminiIgnore({ ...geminiIgnore, enabled: e.target.checked })}
              className="h-3.5 w-3.5"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add pattern..."
              value={newIgnorePattern}
              onChange={(e) => setNewIgnorePattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newIgnorePattern.trim()) {
                  setGeminiIgnore({ ...geminiIgnore, patterns: [...geminiIgnore.patterns, newIgnorePattern.trim()] });
                  setNewIgnorePattern('');
                }
              }}
              className="flex-1 h-8 rounded border bg-transparent px-2 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {geminiIgnore.patterns.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                {p}
                <button onClick={() => setGeminiIgnore({ ...geminiIgnore, patterns: geminiIgnore.patterns.filter((_, idx) => idx !== i) })}>
                  <X className="w-2.5 h-2.5 hover:text-red-500" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <CustomToolsSection customTools={customTools} setCustomTools={setCustomTools} />
    </div>
  );

  const renderExtensionsTab = () => (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Extensions Gallery
          </h3>
          <p className="text-xs text-muted-foreground">Browse and install MCP servers</p>
        </div>
        <button onClick={loadGallery} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
          <RefreshCw className={cn("w-4 h-4", isLoadingGallery && "animate-spin")} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search extensions..."
          aria-label="Search extensions"
          className="w-full pl-8 pr-4 py-2 rounded-lg border bg-muted/20 text-xs outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {galleryError && <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">{galleryError}</div>}
        {isLoadingGallery ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
        ) : filteredExtensions.length > 0 ? (
          filteredExtensions.map(ext => {
            const isInstalled = installedExtensionNames.has(ext.name.trim().toLowerCase());
            return (
              <div key={ext.id} className="p-3 rounded-lg border bg-muted/10 space-y-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{ext.name}</div>
                    <div className="text-[10px] text-primary/70 font-medium uppercase">{ext.category}</div>
                  </div>
                  <button
                    onClick={() => handleInstallExtension(ext)}
                    disabled={installingExtension === ext.id || isInstalled}
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors",
                      isInstalled ? "bg-emerald-500/10 text-emerald-500" : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {installingExtension === ext.id ? "..." : isInstalled ? "Installed" : "Install"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{ext.description}</p>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center opacity-40">
            <Search className="w-12 h-12 mb-4" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">No extensions found</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-6 px-8 leading-relaxed">
              We couldn&apos;t find any MCP servers matching &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors border border-primary/20"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDiagnosticsTab = () => (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Diagnostics
          </h3>
          <p className="text-xs text-muted-foreground">Runtime state and boot performance</p>
        </div>
        <button onClick={fetchDiagnostics} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
          <RefreshCw className={cn("w-4 h-4", isLoadingDiagnostics && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
        {diagnosticsError && <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-xs">{diagnosticsError}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border bg-muted/20">
            <div className="text-[10px] font-medium text-muted-foreground uppercase">Status</div>
            <div className="text-sm font-mono mt-0.5">{diagnosticsData?.status || 'unknown'}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/20">
            <div className="text-[10px] font-medium text-muted-foreground uppercase">Port</div>
            <div className="text-sm font-mono mt-0.5">{diagnosticsData?.port ?? 'unknown'}</div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/20 col-span-2">
            <div className="text-[10px] font-medium text-muted-foreground uppercase">Engine</div>
            <div className="text-xs mt-0.5 text-muted-foreground truncate">{diagnosticsData?.engine || 'Not connected'}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 text-[10px] font-bold uppercase tracking-wider">Boot Timeline</div>
          <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
            {bootEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono">
                <span className="text-muted-foreground truncate mr-4">{e.name}</span>
                <span className="text-primary shrink-0">{formatMs(e.elapsedMs)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAboutTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-8 text-center space-y-4">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-xl">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">GGBond</h2>
          <p className="text-sm text-muted-foreground">Premium Desktop AI Coding Assistant</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">App Version</span>
            <span className="font-mono font-medium">v{packageJson.version}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Core Version</span>
            <span className="font-mono font-medium">v{coreUpgradeStatus?.localCoreVersion || '0.35.2'}</span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
            <span className="text-muted-foreground">Build Platform</span>
            <span className="capitalize">{typeof window !== 'undefined' ? (navigator as any).platform : 'unknown'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">CLI Core Update</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Manage the upstream Gemini CLI core runtime. Upgrading may provide new models and improved reasoning capabilities.
          </p>
          <div className="pt-2">
            <button
              onClick={handleCoreUpgrade}
              disabled={coreUpgradeRunning || coreUpgradeLoading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {coreUpgradeRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {coreUpgradeRunning ? "Upgrading..." : "Update CLI Core"}
            </button>
            {coreUpgradeMessage && <p className="mt-2 text-[10px] text-center text-primary font-medium">{coreUpgradeMessage}</p>}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
          <Info className="w-3 h-3" />
          View Licenses & Legal
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-background border rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] w-full max-w-4xl h-[640px] flex overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Sidebar Tabs */}
        <div className="w-64 bg-muted/30 border-r flex flex-col">
          <div className="p-6 flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            Settings
          </div>

          <nav className="flex-1 px-3 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                activeTab === 'general'
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Monitor className="w-4 h-4" />
              General
            </button>
            <button
              onClick={() => setActiveTab('extensions')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                activeTab === 'extensions'
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Package className="w-4 h-4" />
              Extensions
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                activeTab === 'diagnostics'
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Activity className="w-4 h-4" />
              Diagnostics
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                activeTab === 'about'
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Info className="w-4 h-4" />
              About
            </button>
          </nav>

          <div className="p-4 border-t border-border/50">
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-background/50">
          {/* Header */}
          <div className="h-14 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur-md">
            <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">
              {activeTab}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
            <div className="max-w-2xl mx-auto h-full">
              {activeTab === 'general' && renderGeneralTab()}
              {activeTab === 'extensions' && renderExtensionsTab()}
              {activeTab === 'diagnostics' && renderDiagnosticsTab()}
              {activeTab === 'about' && renderAboutTab()}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="h-20 border-t flex items-center justify-end px-8 gap-3 bg-background/80 backdrop-blur-md">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-bold shadow-xl shadow-primary/25 active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <datalist id="gemini-keybinding-commands">
        {KEYBINDING_COMMAND_OPTIONS.map((option) => (
          <option key={option.command} value={option.command}>
            {option.group} - {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
