import fs from 'fs';
import os from 'os';
import path from 'path';

type RuntimeHomeSource =
  | 'GGBOND_DATA_HOME'
  | 'GGBOND_HOME'
  | 'GEMINI_CLI_HOME'
  | 'DEFAULT';

type RuntimeHomeCache = typeof globalThis & {
  __ggbondRuntimeHome?: string;
  __ggbondRuntimeHomeSource?: RuntimeHomeSource;
};

const normalizeHome = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return path.resolve(trimmed);
};

const getPlatformDefaultHome = () => {
  const home = os.homedir();
  // Default to the native Gemini home for shared config/session visibility.
  return path.join(home, '.gemini');
};

export const resolveGeminiCliHome = (dataHome: string) => {
  // gemini-cli-core treats GEMINI_CLI_HOME as the parent that contains ".gemini".
  // If dataHome already points to "~/.gemini", CLI home should be "~".
  if (path.basename(dataHome) === '.gemini') {
    return path.dirname(dataHome);
  }
  return dataHome;
};

const selectRuntimeHome = (): { home: string; source: RuntimeHomeSource } => {
  const fromDataHome = normalizeHome(process.env.GGBOND_DATA_HOME || '');
  if (fromDataHome) return { home: fromDataHome, source: 'GGBOND_DATA_HOME' };

  const fromLegacyHome = normalizeHome(process.env.GGBOND_HOME || '');
  if (fromLegacyHome) return { home: fromLegacyHome, source: 'GGBOND_HOME' };

  const fromGeminiHome = normalizeHome(process.env.GEMINI_CLI_HOME || '');
  if (fromGeminiHome) return { home: fromGeminiHome, source: 'GEMINI_CLI_HOME' };

  return { home: getPlatformDefaultHome(), source: 'DEFAULT' };
};

export const resolveRuntimeHome = () => {
  const globalCache = globalThis as RuntimeHomeCache;
  if (globalCache.__ggbondRuntimeHome) {
    return globalCache.__ggbondRuntimeHome;
  }

  const { home, source } = selectRuntimeHome();
  const geminiCliHome = resolveGeminiCliHome(home);
  fs.mkdirSync(home, { recursive: true });

  process.env.GGBOND_DATA_HOME = home;
  process.env.GEMINI_CLI_HOME = geminiCliHome;
  if (!process.env.GGBOND_HOME) {
    process.env.GGBOND_HOME = home;
  }

  globalCache.__ggbondRuntimeHome = home;
  globalCache.__ggbondRuntimeHomeSource = source;
  return home;
};

export const resolveDefaultWorkspaceRoot = () => {
  const explicit = normalizeHome(process.env.GGBOND_DEFAULT_CWD || '');
  if (explicit) {
    return explicit;
  }

  return process.cwd();
};

export const resolveSystemTempRoot = () => {
  const explicit = normalizeHome(process.env.GGBOND_TEMP_DIR || '');
  if (explicit) {
    fs.mkdirSync(explicit, { recursive: true });
    return explicit;
  }

  const tempRoot = path.join(os.tmpdir(), 'ggbond');
  fs.mkdirSync(tempRoot, { recursive: true });
  return tempRoot;
};

export const resolveDefaultSessionWorkspaceRoot = (sessionId?: string | null) => {
  const safeSessionId = String(sessionId || 'default')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
  const sessionRoot = path.join(resolveSystemTempRoot(), 'sessions', safeSessionId);
  fs.mkdirSync(sessionRoot, { recursive: true });
  return sessionRoot;
};

export const resolveWorkspaceExecutionRoot = (workspace: unknown, sessionId?: string | null) => {
  const trimmedWorkspace = typeof workspace === 'string' ? workspace.trim() : '';
  if (trimmedWorkspace && trimmedWorkspace !== 'Default') {
    return path.resolve(trimmedWorkspace);
  }

  return resolveDefaultSessionWorkspaceRoot(sessionId);
};

export const resolveGeminiConfigDir = (homeOverride?: string) => {
  const baseHome = homeOverride || resolveRuntimeHome();
  return path.basename(baseHome) === '.gemini'
    ? baseHome
    : path.join(baseHome, '.gemini');
};

export const getRuntimeHomeSource = () => {
  const globalCache = globalThis as RuntimeHomeCache;
  if (globalCache.__ggbondRuntimeHomeSource) return globalCache.__ggbondRuntimeHomeSource;
  resolveRuntimeHome();
  return (globalThis as RuntimeHomeCache).__ggbondRuntimeHomeSource || 'DEFAULT';
};
