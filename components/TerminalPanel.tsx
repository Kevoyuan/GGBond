'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Loader2,
  Minimize2,
  Play,
  Plus,
  Settings2,
  Square,
  TerminalSquare,
  Trash2,
  X,
  SplitSquareHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalPanelProps {
  workspacePath?: string;
  sessionId?: string | null;
  onSessionRunStateChange?: (sessionId: string, delta: number) => void;
  onClose: () => void;
  onHeightChange?: (height: number) => void;
}

type TerminalEntryStatus = 'running' | 'completed' | 'failed' | 'stopped' | 'timed_out';

interface TerminalEntry {
  id: string;
  runId?: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  createdAt: number;
  status: TerminalEntryStatus;
}

interface TerminalAction {
  id: string;
  name: string;
  script: string;
}

interface TerminalEnvironmentConfig {
  name: string;
  shell: string;
  defaultCwd: string;
  envText: string;
  actions: TerminalAction[];
  selectedActionId: string;
}

interface TerminalStreamErrorResponse {
  error?: unknown;
}

interface TerminalStreamEvent {
  type?: unknown;
  runId?: unknown;
  chunk?: unknown;
  message?: unknown;
  cwd?: unknown;
  exitCode?: unknown;
  timedOut?: unknown;
  stopped?: unknown;
  durationMs?: unknown;
}

interface TerminalSession {
  id: string;
  name: string;
  entries: TerminalEntry[];
  command: string;
  commandHistory: string[];
  commandHistoryIndex: number | null;
  historyDraft: string;
  sessionCwd: string;
  isRunning: boolean;
  isStopping: boolean;
  currentRunId: string | null;
}

const STORAGE_KEY = 'ggbond-terminal-environment-v1';
const HEIGHT_STORAGE_KEY = 'ggbond-terminal-height-v1';
const SIDEBAR_WIDTH_STORAGE_KEY = 'ggbond-terminal-sidebar-width-v1';
const DEFAULT_ACTION_ID = 'run';
const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 240;
const DEFAULT_SIDEBAR_WIDTH = 160;
const MIN_SIDEBAR_WIDTH = 100;
const MAX_SIDEBAR_WIDTH = 400;

const toStringOrEmpty = (value: unknown) => (typeof value === 'string' ? value : '');

const toNumberOr = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
};

const toStatus = (exitCode: number, timedOut: boolean, stopped: boolean): TerminalEntryStatus => {
  if (timedOut) return 'timed_out';
  if (stopped) return 'stopped';
  if (exitCode === 0) return 'completed';
  return 'failed';
};

const statusMeta: Record<TerminalEntryStatus, { label: string; className: string }> = {
  running: { label: 'running', className: 'text-sky-300' },
  completed: { label: 'completed', className: 'text-emerald-300' },
  failed: { label: 'failed', className: 'text-rose-300' },
  stopped: { label: 'stopped', className: 'text-amber-300' },
  timed_out: { label: 'timed out', className: 'text-amber-300' },
};

type AnsiStyleState = {
  fg?: string;
  bg?: string;
  bold?: boolean;
};

const ANSI_BASE_COLORS = [
  '#000000',
  '#cd3131',
  '#0dbc79',
  '#e5e510',
  '#2472c8',
  '#bc3fbc',
  '#11a8cd',
  '#e5e5e5',
];

const ANSI_BRIGHT_COLORS = [
  '#666666',
  '#f14c4c',
  '#23d18b',
  '#f5f543',
  '#3b8eea',
  '#d670d6',
  '#29b8db',
  '#ffffff',
];

const clampColorByte = (value: number) => Math.max(0, Math.min(255, Math.floor(value)));

const ansi256ToRgb = (index: number) => {
  const normalized = Math.max(0, Math.min(255, Math.floor(index)));
  if (normalized < 8) return ANSI_BASE_COLORS[normalized];
  if (normalized < 16) return ANSI_BRIGHT_COLORS[normalized - 8];
  if (normalized < 232) {
    const n = normalized - 16;
    const r = Math.floor(n / 36);
    const g = Math.floor((n % 36) / 6);
    const b = n % 6;
    const cube = [0, 95, 135, 175, 215, 255];
    return `rgb(${cube[r]}, ${cube[g]}, ${cube[b]})`;
  }

  const gray = 8 + (normalized - 232) * 10;
  return `rgb(${gray}, ${gray}, ${gray})`;
};

const applySgrCodes = (codes: number[], currentState: AnsiStyleState): AnsiStyleState => {
  let nextState: AnsiStyleState = { ...currentState };

  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];

    if (code === 0) {
      nextState = {};
      continue;
    }

    if (code === 1) {
      nextState.bold = true;
      continue;
    }

    if (code === 22) {
      nextState.bold = false;
      continue;
    }

    if (code === 39) {
      nextState.fg = undefined;
      continue;
    }

    if (code === 49) {
      nextState.bg = undefined;
      continue;
    }

    if (code >= 30 && code <= 37) {
      nextState.fg = ANSI_BASE_COLORS[code - 30];
      continue;
    }

    if (code >= 90 && code <= 97) {
      nextState.fg = ANSI_BRIGHT_COLORS[code - 90];
      continue;
    }

    if (code >= 40 && code <= 47) {
      nextState.bg = ANSI_BASE_COLORS[code - 40];
      continue;
    }

    if (code >= 100 && code <= 107) {
      nextState.bg = ANSI_BRIGHT_COLORS[code - 100];
      continue;
    }

    if (code === 38 || code === 48) {
      const channel = code === 38 ? 'fg' : 'bg';
      const mode = codes[index + 1];

      if (mode === 5) {
        const colorIndex = codes[index + 2];
        if (Number.isFinite(colorIndex)) {
          nextState[channel] = ansi256ToRgb(colorIndex);
          index += 2;
          continue;
        }
      }

      if (mode === 2) {
        const red = codes[index + 2];
        const green = codes[index + 3];
        const blue = codes[index + 4];
        if (Number.isFinite(red) && Number.isFinite(green) && Number.isFinite(blue)) {
          nextState[channel] = `rgb(${clampColorByte(red)}, ${clampColorByte(green)}, ${clampColorByte(blue)})`;
          index += 4;
          continue;
        }
      }
    }
  }

  return nextState;
};

const parseAnsiSegments = (input: string): Array<{ text: string; state: AnsiStyleState }> => {
  if (!input.includes('\u001b[')) {
    return [{ text: input, state: {} }];
  }

  const segments: Array<{ text: string; state: AnsiStyleState }> = [];
  const ansiPattern = /\u001b\[([0-9;]*)m/g;
  let state: AnsiStyleState = {};
  let cursor = 0;
  let match = ansiPattern.exec(input);

  while (match) {
    if (match.index > cursor) {
      segments.push({
        text: input.slice(cursor, match.index),
        state: { ...state },
      });
    }

    const rawCodes = match[1] ?? '';
    const codes = rawCodes
      .split(';')
      .filter((code) => code.length > 0)
      .map((code) => Number.parseInt(code, 10))
      .filter((code) => Number.isFinite(code));

    state = applySgrCodes(codes.length > 0 ? codes : [0], state);
    cursor = ansiPattern.lastIndex;
    match = ansiPattern.exec(input);
  }

  if (cursor < input.length) {
    segments.push({
      text: input.slice(cursor),
      state: { ...state },
    });
  }

  return segments;
};

const renderAnsiText = (input: string) => {
  const segments = parseAnsiSegments(input);
  return segments.map((segment, index) => {
    const style: React.CSSProperties = {};
    if (segment.state.fg) style.color = segment.state.fg;
    if (segment.state.bg) style.backgroundColor = segment.state.bg;
    if (segment.state.bold) style.fontWeight = 700;

    return (
      <span key={`${index}-${segment.text.length}`} style={style}>
        {segment.text}
      </span>
    );
  });
};

const stripWrappingQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const quoteForPosixShell = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

const quoteForCmdShell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const parseSimpleCdCommand = (command: string) => {
  const match = command.match(/^cd(?:\s+(.+))?$/);
  if (!match) return null;

  const rawTarget = (match[1] ?? '').trim();
  if (/[;&|<>`$()]/.test(rawTarget)) return null;

  return { target: rawTarget };
};

const buildCdProbeCommand = (target: string, shellHint: string) => {
  const cleanedTarget = stripWrappingQuotes(target);
  const isWindowsShell = /(?:^|[\\/])(cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh(?:\.exe)?)$/i.test(
    shellHint
  );

  if (isWindowsShell) {
    if (!cleanedTarget) return 'cd';
    return `cd /d ${quoteForCmdShell(cleanedTarget)} && cd`;
  }

  if (!cleanedTarget) return 'cd && pwd';
  return `cd ${quoteForPosixShell(cleanedTarget)} && pwd`;
};

const parseResolvedCwdFromStdout = (stdout: string) => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
};

const generateActionId = () => `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clampHeight = (height: number) => {
  if (typeof window === 'undefined') return Math.max(MIN_HEIGHT, height);
  const maxHeight = Math.max(MIN_HEIGHT + 80, Math.floor(window.innerHeight * 0.78));
  return Math.min(maxHeight, Math.max(MIN_HEIGHT, Math.floor(height)));
};

const clampSidebarWidth = (width: number) => {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.floor(width)));
};

const parseEnvironmentVariables = (envText: string) => {
  const vars: Record<string, string> = {};
  const lines = envText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    vars[key] = value;
  }

  return vars;
};

const createDefaultEnvironment = (workspacePath?: string): TerminalEnvironmentConfig => ({
  name: workspacePath ? workspacePath.split('/').filter(Boolean).pop() || 'workspace' : 'workspace',
  shell: '',
  defaultCwd: workspacePath || '',
  envText: '',
  actions: [
    {
      id: DEFAULT_ACTION_ID,
      name: 'Run',
      script: 'npm run dev',
    },
  ],
  selectedActionId: DEFAULT_ACTION_ID,
});

const normalizeEnvironment = (
  value: unknown,
  workspacePath?: string
): TerminalEnvironmentConfig => {
  const base = createDefaultEnvironment(workspacePath);
  if (!value || typeof value !== 'object') return base;

  const source = value as Partial<TerminalEnvironmentConfig>;
  const normalizedActions = Array.isArray(source.actions)
    ? source.actions
      .map((action) => {
        if (!action || typeof action !== 'object') return null;
        const actionRecord = action as Partial<TerminalAction>;
        const id = toStringOrEmpty(actionRecord.id) || generateActionId();
        const name = toStringOrEmpty(actionRecord.name).trim() || 'Action';
        const script = toStringOrEmpty(actionRecord.script);
        return { id, name, script };
      })
      .filter((action): action is TerminalAction => Boolean(action))
    : [];

  const actions = normalizedActions.length > 0 ? normalizedActions : base.actions;
  const selectedActionId = toStringOrEmpty(source.selectedActionId);
  const hasSelectedAction = actions.some((action) => action.id === selectedActionId);

  return {
    name: toStringOrEmpty(source.name).trim() || base.name,
    shell: toStringOrEmpty(source.shell).trim(),
    defaultCwd: toStringOrEmpty(source.defaultCwd).trim() || base.defaultCwd,
    envText: toStringOrEmpty(source.envText),
    actions,
    selectedActionId: hasSelectedAction ? selectedActionId : actions[0].id,
  };
};

export const TerminalPanel = React.memo(function TerminalPanel({
  workspacePath,
  sessionId,
  onSessionRunStateChange,
  onClose,
  onHeightChange,
}: TerminalPanelProps) {
  // Multi-tab state
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [{
    id: 'default',
    name: 'Terminal 1',
    entries: [],
    command: '',
    commandHistory: [],
    commandHistoryIndex: null,
    historyDraft: '',
    sessionCwd: '',
    isRunning: false,
    isStopping: false,
    currentRunId: null,
  }]);
  const [activeSessionId, setActiveSessionId] = useState('default');

  const [environment, setEnvironment] = useState<TerminalEnvironmentConfig>(() =>
    createDefaultEnvironment(workspacePath)
  );
  const [showEnvironmentSettings, setShowEnvironmentSettings] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const commandTextareaRef = useRef<HTMLTextAreaElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number; startX: number; startWidth: number } | null>(null);

  // Ref to hold AbortControllers for all sessions
  const abortControllersRef = useRef<Record<string, AbortController | null>>({});
  // Ref to hold refs for entries/sessions for async operations
  const activeEntryIdRef = useRef<Record<string, string | null>>({});
  const activeRunSessionIdRef = useRef<Record<string, string | null>>({});

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId) || sessions[0], [sessions, activeSessionId]);

  // Update specific session state
  const updateSession = useCallback((sessionId: string, updates: Partial<TerminalSession>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  }, []);

  // Update active session state
  const updateActiveSession = useCallback((updates: Partial<TerminalSession>) => {
    updateSession(activeSessionId, updates);
  }, [activeSessionId, updateSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rawEnv = window.localStorage.getItem(STORAGE_KEY);
    if (rawEnv) {
      try {
        setEnvironment(normalizeEnvironment(JSON.parse(rawEnv), workspacePath));
      } catch {
        setEnvironment(createDefaultEnvironment(workspacePath));
      }
    }

    const rawHeight = window.localStorage.getItem(HEIGHT_STORAGE_KEY);
    if (rawHeight) {
      const parsed = Number(rawHeight);
      if (Number.isFinite(parsed)) {
        setPanelHeight(clampHeight(parsed));
      }
    }

    const rawSidebarWidth = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (rawSidebarWidth) {
      const parsed = Number(rawSidebarWidth);
      if (Number.isFinite(parsed)) {
        setSidebarWidth(clampSidebarWidth(parsed));
      }
    }
  }, [workspacePath]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(environment));
  }, [environment]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(panelHeight));
  }, [panelHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    onHeightChange?.(panelHeight);
  }, [onHeightChange, panelHeight]);

  useEffect(() => {
    if (!environment.defaultCwd && workspacePath) {
      setEnvironment((prev) => ({ ...prev, defaultCwd: workspacePath }));
    }
  }, [workspacePath, environment.defaultCwd]);

  useEffect(() => {
    // Initialize session CWD if empty
    sessions.forEach(s => {
      if (s.sessionCwd.trim()) return;
      if (environment.defaultCwd.trim()) {
        updateSession(s.id, { sessionCwd: environment.defaultCwd.trim() });
        return;
      }
      if (workspacePath?.trim()) {
        updateSession(s.id, { sessionCwd: workspacePath.trim() });
      }
    });
  }, [environment.defaultCwd, workspacePath, sessions, updateSession]);

  useEffect(() => {
    // Use 'auto' instead of 'smooth' to avoid CPU-intensive scroll interpolation
    // on every terminal output chunk
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'auto' });
  }, [activeSession.entries, activeSession.isRunning]);

  useEffect(() => {
    commandTextareaRef.current?.focus();
  }, [activeSessionId]);

  useEffect(() => {
    const textarea = commandTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    const nextHeight = Math.min(180, Math.max(30, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
  }, [activeSession.command]);

  useEffect(() => {
    if (!showActionMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const menuElement = actionMenuRef.current;
      if (!menuElement) return;
      if (menuElement.contains(event.target as Node)) return;
      setShowActionMenu(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowActionMenu(false);
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showActionMenu]);

  useEffect(() => {
    if (!isResizing && !isSidebarResizing) return;

    const onMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStartRef.current;
      if (!resizeState) return;

      if (isResizing) {
        const delta = resizeState.startY - event.clientY;
        setPanelHeight(clampHeight(resizeState.startHeight + delta));
      }

      if (isSidebarResizing) {
        const delta = resizeState.startX - event.clientX;
        setSidebarWidth(clampSidebarWidth(resizeState.startWidth + delta));
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      setIsSidebarResizing(false);
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isSidebarResizing]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      Object.keys(abortControllersRef.current).forEach(sid => {
        abortControllersRef.current[sid]?.abort();
      });
      Object.keys(activeRunSessionIdRef.current).forEach(sid => {
        const runId = activeRunSessionIdRef.current[sid];
        if (runId) {
          onSessionRunStateChange?.(runId, -1);
        }
      });
    };
  }, [onSessionRunStateChange]);

  const selectedAction = useMemo(
    () =>
      environment.actions.find((action) => action.id === environment.selectedActionId) ||
      environment.actions[0] ||
      null,
    [environment.actions, environment.selectedActionId]
  );

  const getCurrentWorkingDirectory = useCallback((session: TerminalSession) => {
    if (session.sessionCwd.trim()) return session.sessionCwd.trim();
    if (environment.defaultCwd.trim()) return environment.defaultCwd.trim();
    if (workspacePath?.trim()) return workspacePath;
    return '';
  }, [environment.defaultCwd, workspacePath]);

  const terminalPrompt = useMemo(() => {
    const location = getCurrentWorkingDirectory(activeSession) || '~';
    return `${location} $`;
  }, [activeSession, getCurrentWorkingDirectory]);

  const updateEntry = useCallback((sessionId: string, entryId: string, updater: (entry: TerminalEntry) => TerminalEntry) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        entries: s.entries.map(e => e.id === entryId ? updater(e) : e)
      };
    }));
  }, []);

  const appendEntryText = useCallback(
    (sessionId: string, entryId: string, key: 'stdout' | 'stderr', chunk: string) => {
      if (!chunk) return;
      updateEntry(sessionId, entryId, (entry) => ({ ...entry, [key]: entry[key] + chunk }));
    },
    [updateEntry]
  );

  const finalizeActiveRun = useCallback(
    (sessionId: string, entryId: string, updates: Partial<TerminalEntry>) => {
      updateEntry(sessionId, entryId, (entry) => ({
        ...entry,
        ...updates,
        status: updates.status ?? (entry.status === 'running' ? 'failed' : entry.status),
      }));

      updateSession(sessionId, {
        isRunning: false,
        isStopping: false,
        currentRunId: null
      });

      activeEntryIdRef.current[sessionId] = null;
      abortControllersRef.current[sessionId] = null;
      const activeRunSessionId = activeRunSessionIdRef.current[sessionId];
      if (activeRunSessionId) {
        onSessionRunStateChange?.(activeRunSessionId, -1);
        activeRunSessionIdRef.current[sessionId] = null;
      }
    },
    [onSessionRunStateChange, updateEntry, updateSession]
  );

  const handleRunCommand = useCallback(
    async (sessionId: string, commandOverride?: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const normalizedCommand = (commandOverride ?? session.command).trim();
      if (!normalizedCommand || session.isRunning) return;

      // Auto-rename session based on command
      const commandName = normalizedCommand.split(' ')[0];
      if (session.name.startsWith('Terminal ')) {
        updateSession(sessionId, { name: commandName || session.name });
      }

      const startedAt = Date.now();
      const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const runSessionId = typeof sessionId === 'string' && sessionId.trim() ? sessionId : null; // Using internal terminal sessionId as key if external one not mapped? Actually props.sessionId is for chat session.
      // We should use props.sessionId if available for tracking, but maybe we should scope it? 
      // For simplicity, reusing prop sessionId for all tabs run state tracking if present.
      const externalSessionId = typeof sessionId === 'string' && sessionId.trim() ? sessionId : null;

      activeRunSessionIdRef.current[sessionId] = externalSessionId;
      if (externalSessionId) {
        onSessionRunStateChange?.(externalSessionId, 1);
      }
      activeEntryIdRef.current[sessionId] = entryId;

      const newEntries = [
        ...session.entries,
        {
          id: entryId,
          command: normalizedCommand,
          cwd: getCurrentWorkingDirectory(session) || '',
          stdout: '',
          stderr: '',
          exitCode: 0,
          durationMs: 0,
          createdAt: startedAt,
          status: 'running' as TerminalEntryStatus,
        },
      ];

      updateSession(sessionId, {
        isRunning: true,
        isStopping: false,
        currentRunId: null,
        entries: newEntries,
        ...(!commandOverride ? {
          command: '',
          commandHistory: [...session.commandHistory, normalizedCommand].slice(-200),
          commandHistoryIndex: null,
          historyDraft: ''
        } : {})
      });

      const abortController = new AbortController();
      abortControllersRef.current[sessionId] = abortController;

      let receivedExitEvent = false;
      const envVariables = parseEnvironmentVariables(environment.envText);
      const shellOverride = environment.shell.trim();
      const cdCommand = parseSimpleCdCommand(normalizedCommand);
      const isSimpleCd = Boolean(cdCommand);
      const executedCommand = cdCommand
        ? buildCdProbeCommand(cdCommand.target, shellOverride)
        : normalizedCommand;
      let cdProbeStdout = '';

      try {
        const response = await fetch('/api/terminal/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: executedCommand,
            cwd: getCurrentWorkingDirectory(session) || undefined,
            shell: shellOverride || undefined,
            env: Object.keys(envVariables).length > 0 ? envVariables : undefined,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as TerminalStreamErrorResponse;
          const responseError = toStringOrEmpty(data.error) || 'Command request failed';
          finalizeActiveRun(sessionId, entryId, {
            stderr: responseError,
            exitCode: 1,
            durationMs: Date.now() - startedAt,
            status: 'failed',
          });
          return;
        }

        if (!response.body) {
          finalizeActiveRun(sessionId, entryId, {
            stderr: 'No stream body returned from server',
            exitCode: 1,
            durationMs: Date.now() - startedAt,
            status: 'failed',
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            let event: TerminalStreamEvent;
            try {
              event = JSON.parse(line) as TerminalStreamEvent;
            } catch {
              appendEntryText(sessionId, entryId, 'stderr', `\n[stream parse error] ${line}`);
              continue;
            }

            const eventType = toStringOrEmpty(event.type);
            if (!eventType) continue;

            if (eventType === 'init') {
              const runId = toStringOrEmpty(event.runId);
              const streamCwd = toStringOrEmpty(event.cwd);

              if (runId) {
                updateSession(sessionId, { currentRunId: runId });
                updateEntry(sessionId, entryId, (entry) => ({ ...entry, runId }));
              }

              if (streamCwd) {
                updateEntry(sessionId, entryId, (entry) => ({ ...entry, cwd: streamCwd }));
              }
              continue;
            }

            if (eventType === 'stdout') {
              const stdoutChunk = toStringOrEmpty(event.chunk);
              if (isSimpleCd) {
                cdProbeStdout += stdoutChunk;
              } else {
                appendEntryText(sessionId, entryId, 'stdout', stdoutChunk);
              }
              continue;
            }

            if (eventType === 'stderr') {
              appendEntryText(sessionId, entryId, 'stderr', toStringOrEmpty(event.chunk));
              continue;
            }

            if (eventType === 'error') {
              const message = toStringOrEmpty(event.message) || 'Unknown terminal error';
              appendEntryText(sessionId, entryId, 'stderr', `\n${message}`);
              continue;
            }

            if (eventType === 'exit') {
              receivedExitEvent = true;
              const exitCode = toNumberOr(event.exitCode, 1);
              const timedOut = Boolean(event.timedOut);
              const stopped = Boolean(event.stopped);
              const durationMs = toNumberOr(event.durationMs, Date.now() - startedAt);

              if (isSimpleCd && exitCode === 0) {
                const resolvedCwd = parseResolvedCwdFromStdout(cdProbeStdout);
                if (resolvedCwd) {
                  updateSession(sessionId, { sessionCwd: resolvedCwd });
                  updateEntry(sessionId, entryId, (entry) => ({ ...entry, cwd: resolvedCwd }));
                }
              }

              finalizeActiveRun(sessionId, entryId, {
                exitCode,
                durationMs,
                status: toStatus(exitCode, timedOut, stopped),
              });
            }
          }
        }

        if (!receivedExitEvent) {
          const wasStopped = abortController.signal.aborted || session.isStopping; // session.isStopping might be stale closure, but we handle via finalize logic typically.
          if (!wasStopped) {
            appendEntryText(sessionId, entryId, 'stderr', '\n[stream closed unexpectedly]');
          }
          finalizeActiveRun(sessionId, entryId, {
            exitCode: wasStopped ? 130 : 1,
            durationMs: Date.now() - startedAt,
            status: wasStopped ? 'stopped' : 'failed',
          });
        }
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        if (!isAbort) {
          appendEntryText(
            sessionId,
            entryId,
            'stderr',
            `\n${error instanceof Error ? error.message : 'Failed to run command'}`
          );
        }
        finalizeActiveRun(sessionId, entryId, {
          exitCode: isAbort ? 130 : 1,
          durationMs: Date.now() - startedAt,
          status: isAbort ? 'stopped' : 'failed',
        });
      }
    },
    [
      appendEntryText,
      environment.envText,
      environment.shell,
      finalizeActiveRun,
      getCurrentWorkingDirectory,
      onSessionRunStateChange,
      sessionId, // props sessionId
      sessions,
      updateEntry,
      updateSession
    ]
  );

  // Use alias for prop sessionId to avoid confusion
  const propsSessionId = sessionId;

  const navigateCommandHistory = useCallback((direction: 'up' | 'down') => {
    const session = activeSession;
    if (session.commandHistory.length === 0) return;

    if (direction === 'up') {
      if (session.commandHistoryIndex === null) {
        updateActiveSession({
          historyDraft: session.command,
          commandHistoryIndex: session.commandHistory.length - 1,
          command: session.commandHistory[session.commandHistory.length - 1] ?? ''
        });
        return;
      }

      const nextIndex = Math.max(0, session.commandHistoryIndex - 1);
      updateActiveSession({
        commandHistoryIndex: nextIndex,
        command: session.commandHistory[nextIndex] ?? ''
      });
      return;
    }

    if (session.commandHistoryIndex === null) return;
    if (session.commandHistoryIndex >= session.commandHistory.length - 1) {
      updateActiveSession({
        commandHistoryIndex: null,
        command: session.historyDraft
      });
      return;
    }

    const nextIndex = session.commandHistoryIndex + 1;
    updateActiveSession({
      commandHistoryIndex: nextIndex,
      command: session.commandHistory[nextIndex] ?? ''
    });
  }, [activeSession, updateActiveSession]);

  const sendStopSignal = useCallback(async (signal: 'SIGINT' | 'SIGTERM') => {
    const session = activeSession;
    if (!session.isRunning) return;
    updateActiveSession({ isStopping: true });

    if (session.currentRunId) {
      try {
        await fetch('/api/terminal/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: session.currentRunId, signal }),
        });
      } catch (error) {
        const activeEntryId = activeEntryIdRef.current[activeSessionId];
        if (activeEntryId) {
          appendEntryText(
            activeSessionId,
            activeEntryId,
            'stderr',
            `\n[${signal} request failed] ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
      return;
    }

    abortControllersRef.current[activeSessionId]?.abort();
  }, [activeSession, activeSessionId, appendEntryText, updateActiveSession]);

  const handleStopCommand = useCallback(async () => {
    await sendStopSignal('SIGTERM');
  }, [sendStopSignal]);

  const handleInterruptCommand = useCallback(async () => {
    await sendStopSignal('SIGINT');
  }, [sendStopSignal]);

  const handleRunSelectedAction = useCallback(() => {
    if (!selectedAction?.script.trim()) return;
    setShowActionMenu(false);
    void handleRunCommand(activeSessionId, selectedAction.script);
  }, [handleRunCommand, activeSessionId, selectedAction]);

  const updateAction = useCallback((actionId: string, updates: Partial<TerminalAction>) => {
    setEnvironment((prev) => ({
      ...prev,
      actions: prev.actions.map((action) =>
        action.id === actionId ? { ...action, ...updates } : action
      ),
    }));
  }, []);

  const handleAddAction = useCallback(() => {
    const action: TerminalAction = {
      id: generateActionId(),
      name: `Action ${environment.actions.length + 1}`,
      script: '',
    };

    setEnvironment((prev) => ({
      ...prev,
      actions: [...prev.actions, action],
      selectedActionId: action.id,
    }));
  }, [environment.actions.length]);

  const handleSelectAction = useCallback((actionId: string) => {
    setEnvironment((prev) => ({ ...prev, selectedActionId: actionId }));
    setShowActionMenu(false);
  }, []);

  const handleRemoveAction = useCallback(
    (actionId: string) => {
      setEnvironment((prev) => {
        const remaining = prev.actions.filter((action) => action.id !== actionId);
        const actions =
          remaining.length > 0 ? remaining : createDefaultEnvironment(workspacePath).actions;
        const selectedActionId = actions.some((action) => action.id === prev.selectedActionId)
          ? prev.selectedActionId
          : actions[0].id;
        return { ...prev, actions, selectedActionId };
      });
    },
    [workspacePath]
  );

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartRef.current = {
      startY: event.clientY,
      startHeight: panelHeight,
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsResizing(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSidebarResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartRef.current = {
      startY: event.clientY,
      startHeight: panelHeight,
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    setIsSidebarResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleAddTab = useCallback(() => {
    const newId = generateActionId(); // Reuse simple ID gen
    setSessions(prev => [
      ...prev,
      {
        id: newId,
        name: `Terminal ${prev.length + 1}`,
        entries: [],
        command: '',
        commandHistory: [],
        commandHistoryIndex: null,
        historyDraft: '',
        sessionCwd: environment.defaultCwd || workspacePath || '',
        isRunning: false,
        isStopping: false,
        currentRunId: null,
      }
    ]);
    setActiveSessionId(newId);
  }, [environment.defaultCwd, workspacePath]);

  const handleCloseTab = useCallback((idToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      if (prev.length <= 1) return prev; // Don't close last tab
      const newSessions = prev.filter(s => s.id !== idToClose);
      return newSessions;
    });
    if (activeSessionId === idToClose) {
      setSessions(prev => { // Get new list locally to find next active
        const newSessions = prev.filter(s => s.id !== idToClose);
        const index = prev.findIndex(s => s.id === idToClose);
        const nextSession = newSessions[Math.max(0, index - 1)];
        if (nextSession) setActiveSessionId(nextSession.id);
        return newSessions; // Actual update done in first setSessions, this is just logic flow sync
      });
    }
  }, [activeSessionId]);

  const formatTerminalTranscript = (entry: TerminalEntry) => {
    const status = statusMeta[entry.status];
    const transcript: string[] = [];
    transcript.push(`$ ${entry.command}`);
    if (entry.cwd) {
      transcript.push(`[cwd] ${entry.cwd}`);
    }
    if (entry.stdout) {
      transcript.push(entry.stdout);
    }
    if (entry.stderr) {
      transcript.push(entry.stderr);
    }
    transcript.push(`[${status.label} | exit ${entry.exitCode} | ${entry.durationMs}ms]`);
    return transcript.join('\n');
  };

  return (
    <>
      <div
        className="relative border-t border-border bg-card/70 backdrop-blur-sm flex flex-col"
        style={{ height: `${panelHeight}px` }}
      >
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-2 cursor-row-resize z-20',
            isResizing ? 'bg-primary/30' : 'hover:bg-primary/20'
          )}
          onMouseDown={handleResizeStart}
          title="Drag to resize terminal"
        />

        <div className="h-10 px-3 border-b border-border/40 bg-muted/5 flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1 rounded-md bg-primary/10 text-primary">
              <TerminalSquare size={14} className="shrink-0" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Terminal</span>
            {(activeSession.entries.length > 0 || activeSession.isRunning) && (
              <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted/50 rounded-full border border-border/50 px-2 py-0.5">
                {activeSession.entries.length} runs
              </span>
            )}
            {activeSession.isRunning && (
              <span className="text-[10px] font-bold text-sky-500 dark:text-sky-400 bg-sky-500/10 rounded-full border border-sky-500/20 px-2 py-0.5 animate-pulse">
                active
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <div ref={actionMenuRef} className="relative">
              <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/50 p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSession.isRunning) {
                      void handleStopCommand();
                      return;
                    }
                    void handleRunSelectedAction();
                  }}
                  disabled={!activeSession.isRunning && !selectedAction?.script.trim()}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors',
                    !activeSession.isRunning && !selectedAction?.script.trim()
                      ? 'text-muted-foreground bg-transparent cursor-not-allowed'
                      : activeSession.isRunning
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                        : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                  )}
                  title={selectedAction?.script || 'No action script set'}
                >
                  {activeSession.isRunning ? (
                    activeSession.isStopping ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} fill="currentColor" />
                  ) : (
                    <Play size={12} fill="currentColor" />
                  )}
                  {activeSession.isRunning ? (activeSession.isStopping ? 'Stopping' : 'Stop') : 'Run'}
                </button>
                <div className="w-[1px] h-4 bg-border/60 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setShowActionMenu((prev) => !prev)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  title="Open run menu"
                >
                  <ChevronDown size={12} className={cn('transition-transform duration-200', showActionMenu && 'rotate-180')} />
                </button>
              </div>

              {showActionMenu && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-60 rounded-xl border border-border/50 bg-background dark:bg-zinc-950 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 dark:ring-white/5">
                  <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    {environment.name || 'workspace'} actions
                  </div>
                  <div className="space-y-0.5">
                    {environment.actions.map((action) => {
                      const selected = action.id === environment.selectedActionId;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => handleSelectAction(action.id)}
                          className={cn(
                            'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-left transition-colors',
                            selected
                              ? 'bg-primary/10 dark:bg-zinc-800 text-foreground dark:text-zinc-100'
                              : 'text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:hover:text-zinc-200 hover:bg-muted dark:hover:bg-zinc-900'
                          )}
                          title={action.script || 'No script set'}
                        >
                          <div className={cn("p-1 rounded-md bg-muted dark:bg-zinc-900 border border-border/50 dark:border-zinc-800", selected && "border-primary/30 dark:border-zinc-700 bg-primary/5 dark:bg-zinc-800")}>
                            <Play size={10} className={cn(selected ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground dark:text-zinc-500")} fill="currentColor" />
                          </div>
                          <span className="flex-1 truncate">{action.name}</span>
                          {selected && <Check size={12} className="text-emerald-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="my-1.5 h-px bg-border/30" />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddAction();
                      setShowActionMenu(false);
                      setShowEnvironmentSettings(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:hover:text-zinc-200 hover:bg-muted dark:hover:bg-zinc-900 transition-colors"
                  >
                    <Plus size={12} className="text-muted-foreground dark:text-muted-foreground shrink-0" />
                    Add action
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowEnvironmentSettings(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left text-muted-foreground dark:text-zinc-400 hover:text-foreground dark:hover:text-zinc-200 hover:bg-muted dark:hover:bg-zinc-900 transition-colors"
                  >
                    <Settings2 size={12} className="text-muted-foreground dark:text-muted-foreground shrink-0" />
                    Change environment
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => updateActiveSession({ entries: [] })}
              disabled={activeSession.entries.length === 0}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Clear terminal output"
            >
              <Trash2 size={13} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Minimize terminal panel"
            >
              <Minimize2 size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 relative">
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto bg-zinc-950 dark:bg-zinc-950 text-zinc-100 dark:text-zinc-100 font-mono text-[13px] px-3 py-3 space-y-3"
            onClick={() => commandTextareaRef.current?.focus()}
          >
            {activeSession.entries.map((entry) => (
              <pre
                key={entry.id}
                className="whitespace-pre-wrap break-words leading-relaxed"
              >
                {renderAnsiText(formatTerminalTranscript(entry))}
              </pre>
            ))}

            <div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-[13px] text-zinc-400 dark:text-zinc-400 shrink-0 pt-1">{terminalPrompt}</span>
                <textarea
                  ref={commandTextareaRef}
                  value={activeSession.command}
                  onChange={(event) => updateActiveSession({ command: event.target.value })}
                  onKeyDown={(event) => {
                    if (
                      activeSession.isRunning &&
                      !event.altKey &&
                      (event.ctrlKey || event.metaKey) &&
                      event.key.toLowerCase() === 'c'
                    ) {
                      event.preventDefault();
                      void handleInterruptCommand();
                      return;
                    }

                    const isPlainArrow =
                      !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

                    if (event.key === 'ArrowUp' && isPlainArrow) {
                      const isCursorAtStart =
                        event.currentTarget.selectionStart === 0 &&
                        event.currentTarget.selectionEnd === 0;
                      if (isCursorAtStart) {
                        event.preventDefault();
                        navigateCommandHistory('up');
                        return;
                      }
                    }

                    if (event.key === 'ArrowDown' && isPlainArrow) {
                      const cursorPosition = event.currentTarget.selectionStart;
                      const isCursorAtEnd =
                        cursorPosition === event.currentTarget.selectionEnd &&
                        cursorPosition === event.currentTarget.value.length;
                      if (isCursorAtEnd) {
                        event.preventDefault();
                        navigateCommandHistory('down');
                        return;
                      }
                    }

                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleRunCommand(activeSessionId);
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent font-mono text-[15px] leading-relaxed text-zinc-100 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 border-none rounded-none px-0 py-0.5 focus:outline-none resize-none"
                  placeholder="Type command. Enter run, Shift+Enter newline, Up/Down history, Ctrl+C interrupt."
                  spellCheck={false}
                  autoComplete="off"
                  rows={1}
                />
              </div>
            </div>
          </div>

          {/* Resizer Handle */}
          <div
            className={cn(
              "w-1 cursor-col-resize hover:bg-primary/50 dark:hover:bg-primary/50 transition-colors z-20 flex items-center justify-center group/resize",
              isSidebarResizing && "bg-primary/50 dark:bg-primary/50"
            )}
            onMouseDown={handleSidebarResizeStart}
          />

          {/* Right Sidebar Tabs */}
          <div
            className="border-l border-border/40 bg-muted/5 dark:bg-muted/5 flex flex-col shrink-0"
            style={{ width: sidebarWidth }}
          >
            <div className="px-2 py-1.5 flex items-center justify-between border-b border-border/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Sessions</span>
              <button
                onClick={handleAddTab}
                className="p-1 rounded hover:bg-muted/80 dark:hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title="New Terminal"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5 scrollbar-thin">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn(
                    "group relative flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors border border-transparent select-none overflow-hidden",
                    activeSessionId === session.id
                      ? "bg-background dark:bg-background shadow-sm border-border/50 text-foreground dark:text-foreground font-medium"
                      : "text-muted-foreground dark:text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/50 hover:text-foreground/80 dark:hover:text-foreground/80"
                  )}
                >
                  <TerminalSquare size={13} className={cn("shrink-0", activeSessionId === session.id ? "text-primary dark:text-primary" : "opacity-70")} />
                  <span className="truncate flex-1 min-w-0 pr-12">{session.name}</span>
                  {session.isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-500 animate-pulse shrink-0" />
                  )}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddTab();
                      }}
                      className="p-1 hover:bg-muted-foreground/20 dark:hover:bg-muted-foreground/20 rounded transition-colors text-muted-foreground dark:text-muted-foreground bg-background/80 dark:bg-background/80 backdrop-blur-sm"
                      title="Split (New Tab)"
                    >
                      <SplitSquareHorizontal size={12} />
                    </button>
                    {sessions.length > 1 && (
                      <button
                        onClick={(e) => handleCloseTab(session.id, e)}
                        className="p-1 hover:bg-red-500/10 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-500 rounded transition-colors text-muted-foreground dark:text-muted-foreground bg-background/80 dark:bg-background/80 backdrop-blur-sm"
                        title="Close"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEnvironmentSettings && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          {/* ... Environment Settings Modal Content ... */}
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
                onClick={() => setShowEnvironmentSettings(false)}
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
                      setSessions(prev => prev.map(s => ({ ...s, sessionCwd: nextValue }))); // Update all sessions? or just active? Updating all for consistency with env change
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
                onClick={() => setShowEnvironmentSettings(false)}
                className="rounded-md px-3 py-1.5 text-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
