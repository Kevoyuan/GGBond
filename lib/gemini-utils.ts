import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GEMINI_GUI_HOME = '/tmp/gemini-gui-home';
const GEMINI_ORIGINAL_HOME = path.join(process.env.HOME || '~', '.gemini');
const GEMINI_GUI_CONFIG_DIR = path.join(GEMINI_GUI_HOME, '.gemini');

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
 * Ensure the GUI's clean Gemini home directory exists with credentials.
 * This bypasses macOS SIP com.apple.provenance locks on ~/.gemini/tmp/.
 */
function ensureGeminiGuiHome(): void {
  try {
    if (!fs.existsSync(GEMINI_GUI_CONFIG_DIR)) {
      fs.mkdirSync(GEMINI_GUI_CONFIG_DIR, { recursive: true });
    }

    for (const file of CREDENTIAL_FILES) {
      const src = path.join(GEMINI_ORIGINAL_HOME, file);
      const dst = path.join(GEMINI_GUI_CONFIG_DIR, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }
  } catch (err) {
    console.error('Failed to setup Gemini GUI home:', err);
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
  ensureGeminiGuiHome();
  return {
    ...process.env,
    TERM: 'dumb',
    GEMINI_FORCE_FILE_STORAGE: 'true',
    GEMINI_CLI_HOME: GEMINI_GUI_HOME,
  };
}
