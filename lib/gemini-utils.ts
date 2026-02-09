import { execSync, spawn } from 'child_process';
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

export function getGeminiEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TERM: 'dumb',
    GEMINI_FORCE_FILE_STORAGE: 'true'
  };
}

export async function runGeminiCommand(prompt: string, args: string[] = []): Promise<any> {
  const geminiPath = getGeminiPath();
  const env = getGeminiEnv();
  
  const finalArgs = [geminiPath, '-p', prompt, '--output-format', 'json', ...args];

  return new Promise((resolve, reject) => {
    // Use process.execPath (node) to run the script
    const gemini = spawn(process.execPath, finalArgs, { env });
    
    let stdout = '';
    let stderr = '';

    gemini.stdout.on('data', (data) => stdout += data.toString());
    gemini.stderr.on('data', (data) => stderr += data.toString());

    gemini.on('close', (code) => {
      if (code !== 0) {
        // Even if code is not 0, there might be JSON output (e.g. error response)
        // But usually it's an error.
        console.warn(`Gemini command "${prompt}" exited with code ${code}`);
      }
      
      try {
        // Attempt to find JSON in the output (it might be wrapped in other text)
        // For --output-format json, it should be pure JSON or JSON lines.
        // We'll try parsing the whole thing, or finding the last JSON object.
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            resolve(JSON.parse(jsonMatch[0]));
        } else {
            resolve({ type: 'text', content: stdout, raw: stdout });
        }
      } catch (e) {
        resolve({ type: 'text', content: stdout, error: 'Failed to parse JSON', raw: stdout });
      }
    });
    
    gemini.on('error', (err) => {
        reject(err);
    });
  });
}
