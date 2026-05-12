import React from 'react';
import { 
  TerminalEntryStatus, 
  TerminalEnvironmentConfig, 
  TerminalAction 
} from './types';

export const STORAGE_KEY = 'ggbond-terminal-environment-v1';
export const HEIGHT_STORAGE_KEY = 'ggbond-terminal-height-v1';
export const SIDEBAR_WIDTH_STORAGE_KEY = 'ggbond-terminal-sidebar-width-v1';
export const DEFAULT_ACTION_ID = 'run';
export const DEFAULT_HEIGHT = 360;
export const MIN_HEIGHT = 240;
export const DEFAULT_SIDEBAR_WIDTH = 160;
export const MIN_SIDEBAR_WIDTH = 100;
export const MAX_SIDEBAR_WIDTH = 400;

export const toStringOrEmpty = (value: unknown) => (typeof value === 'string' ? value : '');

export const toNumberOr = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
};

export const toStatus = (exitCode: number, timedOut: boolean, stopped: boolean): TerminalEntryStatus => {
  if (timedOut) return 'timed_out';
  if (stopped) return 'stopped';
  if (exitCode === 0) return 'completed';
  return 'failed';
};

export const statusMeta: Record<TerminalEntryStatus, { label: string; className: string }> = {
  running: { label: 'running', className: 'text-sky-300' },
  completed: { label: 'completed', className: 'text-emerald-300' },
  failed: { label: 'failed', className: 'text-rose-300' },
  stopped: { label: 'stopped', className: 'text-amber-300' },
  timed_out: { label: 'timed out', className: 'text-amber-300' },
};

export type AnsiStyleState = {
  fg?: string;
  bg?: string;
  bold?: boolean;
};

export const ANSI_BASE_COLORS = [
  '#000000',
  '#cd3131',
  '#0dbc79',
  '#e5e510',
  '#2472c8',
  '#bc3fbc',
  '#11a8cd',
  '#e5e5e5',
];

export const ANSI_BRIGHT_COLORS = [
  '#666666',
  '#f14c4c',
  '#23d18b',
  '#f5f543',
  '#3b8eea',
  '#d670d6',
  '#29b8db',
  '#ffffff',
];

export const clampColorByte = (value: number) => Math.max(0, Math.min(255, Math.floor(value)));

export const ansi256ToRgb = (index: number) => {
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

export const applySgrCodes = (codes: number[], currentState: AnsiStyleState): AnsiStyleState => {
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

export const parseAnsiSegments = (input: string): Array<{ text: string; state: AnsiStyleState }> => {
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

export const renderAnsiText = (input: string) => {
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

export const stripWrappingQuotes = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const quoteForPosixShell = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const quoteForCmdShell = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const parseSimpleCdCommand = (command: string) => {
  const match = command.match(/^cd(?:\s+(.+))?$/);
  if (!match) return null;

  const rawTarget = (match[1] ?? '').trim();
  if (/[;&|<>`$()]/.test(rawTarget)) return null;

  return { target: rawTarget };
};

export const buildCdProbeCommand = (target: string, shellHint: string) => {
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

export const parseResolvedCwdFromStdout = (stdout: string) => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : null;
};

export const generateActionId = () => `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const clampHeight = (height: number) => {
  if (typeof window === 'undefined') return Math.max(MIN_HEIGHT, height);
  const maxHeight = Math.max(MIN_HEIGHT + 80, Math.floor(window.innerHeight * 0.78));
  return Math.min(maxHeight, Math.max(MIN_HEIGHT, Math.floor(height)));
};

export const clampSidebarWidth = (width: number) => {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.floor(width)));
};

export const parseEnvironmentVariables = (envText: string) => {
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

export const createDefaultEnvironment = (workspacePath?: string): TerminalEnvironmentConfig => ({
  name: workspacePath ? workspacePath.split('/').filter(Boolean).pop() || 'workspace' : 'workspace',
  shell: '',
  defaultCwd: workspacePath || '',
  envText: '',
  interactiveAutocomplete: true,
  actions: [
    {
      id: DEFAULT_ACTION_ID,
      name: 'Run',
      script: 'npm run dev',
    },
  ],
  selectedActionId: DEFAULT_ACTION_ID,
});

export const normalizeEnvironment = (
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
    interactiveAutocomplete:
      typeof source.interactiveAutocomplete === 'boolean'
        ? source.interactiveAutocomplete
        : base.interactiveAutocomplete,
    actions,
    selectedActionId: hasSelectedAction ? selectedActionId : actions[0].id,
  };
};
