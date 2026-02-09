import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const GLOBAL_SETTINGS = join(homedir(), '.gemini', 'settings.json');
const PROJECT_SETTINGS = join(process.cwd(), '.gemini', 'settings.json');

export function getSettingsPath(scope: 'user' | 'project' = 'user'): string {
  return scope === 'project' ? PROJECT_SETTINGS : GLOBAL_SETTINGS;
}

export async function readSettingsJson(scope: 'user' | 'project' = 'user') {
  const path = getSettingsPath(scope);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

export async function writeSettingsJson(
  settings: Record<string, unknown>,
  scope: 'user' | 'project' = 'user'
) {
  const path = getSettingsPath(scope);
  // Ensure directory exists
  const dir = scope === 'project' ? join(process.cwd(), '.gemini') : join(homedir(), '.gemini');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8');
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;

  const t = target as Record<string, unknown>;
  const s = source as Record<string, unknown>;

  const output = { ...t };
  Object.keys(s).forEach(key => {
    const sVal = s[key];
    const tVal = t[key];
    if (sVal && typeof sVal === 'object' && !Array.isArray(sVal)) {
      if (key in t) {
        output[key] = deepMerge(tVal, sVal);
      } else {
        output[key] = sVal;
      }
    } else {
      output[key] = sVal;
    }
  });
  return output;
}

// 合并两层配置（项目覆盖用户）
export async function getMergedSettings() {
  const user = await readSettingsJson('user');
  const project = await readSettingsJson('project');
  return deepMerge(user, project);
}
