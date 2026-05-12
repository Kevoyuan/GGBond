export interface TerminalTheme {
  foreground?: string;
  background?: string;
  cursor?: string;
  cursorAccent?: string;
  selectionBackground?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

export interface TerminalPanelProps {
  workspacePath?: string;
  sessionId?: string | null;
  onSessionRunStateChange?: (sessionId: string, delta: number) => void;
  onClose: () => void;
  onHeightChange?: (height: number) => void;
  variant?: 'bottom' | 'side';
}

export type TerminalEntryStatus = 'running' | 'completed' | 'failed' | 'stopped' | 'timed_out';

export interface TerminalEntry {
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

export interface TerminalAction {
  id: string;
  name: string;
  script: string;
}

export interface TerminalEnvironmentConfig {
  name: string;
  shell: string;
  defaultCwd: string;
  envText: string;
  interactiveAutocomplete: boolean;
  actions: TerminalAction[];
  selectedActionId: string;
}

export interface TerminalStreamErrorResponse {
  error?: unknown;
}

export interface TerminalStreamEvent {
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

export interface TerminalSession {
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
  term?: {
    write: (data: string) => void;
    clear: () => void;
    focus: () => void;
    open: (element: HTMLElement) => void;
    dispose: () => void;
    onData: (cb: (data: string) => void) => void;
    element?: HTMLElement;
    options: { theme?: TerminalTheme };
  } | null;
  fitAddon?: { fit: () => void } | null;
}
