import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GEMINI_GUI_HOME = '/tmp/gemini-gui-home';
const GEMINI_ORIGINAL_HOME = path.join(process.env.HOME || '~', '.gemini');
const GEMINI_GUI_CONFIG_DIR = path.join(GEMINI_GUI_HOME, '.gemini');
const PROJECT_GEMINI_HOME = path.join(process.cwd(), 'gemini-home');

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
  const existingHome = process.env.GEMINI_CLI_HOME;
  const projectConfigDir = path.join(PROJECT_GEMINI_HOME, '.gemini');
  const projectHasSettings = fs.existsSync(path.join(projectConfigDir, 'settings.json'));
  const projectHasSkills = fs.existsSync(path.join(projectConfigDir, 'skills'));
  const userHasSkills = fs.existsSync(path.join(GEMINI_ORIGINAL_HOME, 'skills'));

  // Prefer project snapshot only when it already has skills (or no user skills exist).
  // Otherwise use isolated GUI home and hydrate it from ~/.gemini to keep behavior consistent.
  const selectedHome = existingHome
    || ((projectHasSettings && (projectHasSkills || !userHasSkills)) ? PROJECT_GEMINI_HOME : GEMINI_GUI_HOME);

  if (selectedHome === GEMINI_GUI_HOME) {
    ensureGeminiHome(GEMINI_GUI_HOME);
  }

  return {
    ...process.env,
    TERM: 'dumb',
    GEMINI_FORCE_FILE_STORAGE: 'true',
    GEMINI_CLI_HOME: selectedHome,
  };
}
