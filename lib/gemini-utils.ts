import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveRuntimeHome } from '@/lib/runtime-home';

const GEMINI_ORIGINAL_HOME = path.join(os.homedir(), '.gemini');

// Files to copy from ~/.gemini to the GUI home
const CREDENTIAL_FILES = [
  'settings.json',
  'oauth_creds.json',
  'google_accounts.json',
  'google_account_id',
  'installation_id',
  'user_id',
  'state.json',
];

/**
 * Ensure a Gemini home has required auth/config files.
 * Also links (or copies) user skills so runtime and UI see the same skills set.
 */
function ensureGeminiHome(targetHome: string): void {
  const targetConfigDir = path.join(targetHome, '.gemini');
  const sourceSkillsDir = path.join(GEMINI_ORIGINAL_HOME, 'skills');
  const targetSkillsDir = path.join(targetConfigDir, 'skills');

  try {
    if (!fs.existsSync(targetConfigDir)) {
      fs.mkdirSync(targetConfigDir, { recursive: true });
    }

    for (const file of CREDENTIAL_FILES) {
      const src = path.join(GEMINI_ORIGINAL_HOME, file);
      const dst = path.join(targetConfigDir, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }

    if (fs.existsSync(sourceSkillsDir) && !fs.existsSync(targetSkillsDir)) {
      try {
        fs.symlinkSync(sourceSkillsDir, targetSkillsDir, 'dir');
      } catch {
        // Fallback for environments that disallow symlinks.
        fs.cpSync(sourceSkillsDir, targetSkillsDir, { recursive: true });
      }
    }
  } catch (err) {
    console.error('Failed to setup Gemini home:', err);
  }
}

export function getGeminiPath(): string {
  try {
    const geminiBin = execSync('which gemini').toString().trim();
    return fs.realpathSync(geminiBin);
  } catch (error) {
    console.error('Failed to find gemini executable:', error);
    throw new Error('Gemini CLI not found');
  }
}

export function getGeminiEnv(): NodeJS.ProcessEnv {
  const selectedHome = resolveRuntimeHome();
  ensureGeminiHome(selectedHome);

  return {
    ...process.env,
    TERM: 'dumb',
    GEMINI_FORCE_FILE_STORAGE: 'true',
    GEMINI_CLI_HOME: selectedHome,
    GGBOND_DATA_HOME: selectedHome,
  };
}
