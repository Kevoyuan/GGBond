import { execSync } from 'child_process';
import fs from 'fs';

export function getGeminiPath(): string {
  try {
    const geminiBin = execSync('which gemini').toString().trim();
    return fs.realpathSync(geminiBin);
  } catch (error) {
    console.error('Failed to find gemini executable:', error);
    throw new Error('Gemini CLI not found');
  }
}

export function getGeminiEnv() {
  return {
    ...process.env,
    TERM: 'dumb',
    GEMINI_FORCE_FILE_STORAGE: 'true'
  };
}
