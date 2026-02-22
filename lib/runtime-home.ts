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
  const resolved = path.resolve(trimmed);
  // Accept either "<root>" or "<root>/.gemini" and normalize to "<root>".
  return path.basename(resolved) === '.gemini' ? path.dirname(resolved) : resolved;
};

const getPlatformDefaultHome = () => {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'ggbond', 'gemini-home');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'ggbond', 'gemini-home');
  }
  return path.join(home, '.local', 'share', 'ggbond', 'gemini-home');
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
  fs.mkdirSync(home, { recursive: true });

  process.env.GGBOND_DATA_HOME = home;
  process.env.GEMINI_CLI_HOME = home;
  if (!process.env.GGBOND_HOME) {
    process.env.GGBOND_HOME = home;
  }

  globalCache.__ggbondRuntimeHome = home;
  globalCache.__ggbondRuntimeHomeSource = source;
  return home;
};

export const getRuntimeHomeSource = () => {
  const globalCache = globalThis as RuntimeHomeCache;
  if (globalCache.__ggbondRuntimeHomeSource) return globalCache.__ggbondRuntimeHomeSource;
  resolveRuntimeHome();
  return (globalThis as RuntimeHomeCache).__ggbondRuntimeHomeSource || 'DEFAULT';
};
