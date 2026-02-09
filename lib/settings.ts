import { readFileSync, writeFileSync, existsSync } from 'fs';
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
  settings: Record<string, any>,
  scope: 'user' | 'project' = 'user'
) {
  const path = getSettingsPath(scope);
  // Ensure directory exists
  const dir = scope === 'project' ? join(process.cwd(), '.gemini') : join(homedir(), '.gemini');
  if (!existsSync(dir)) {
    const fs = require('fs');
    fs.mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8');
}

function deepMerge(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;

  const output = { ...target };
  Object.keys(source).forEach(key => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (key in target) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    } else {
      output[key] = source[key];
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
