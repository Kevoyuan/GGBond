import { NextResponse } from 'next/server';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawnSync } from 'child_process';
import { getGeminiPath, getGeminiEnv } from '@/lib/gemini-utils';

export async function GET() {
  // 直接读扩展目录
  const extensionsDir = join(homedir(), '.gemini', 'extensions');
  if (!require('fs').existsSync(extensionsDir)) {
      return NextResponse.json([]);
  }
  
  try {
    const dirs = readdirSync(extensionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    const extensions = dirs.map(dir => {
      const manifestPath = join(extensionsDir, dir.name, 'gemini-extension.json');
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        return { name: dir.name, ...manifest };
      } catch {
        return { name: dir.name, error: 'Invalid manifest' };
      }
    });

    return NextResponse.json(extensions);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const { action, url } = await req.json();
  // 安装/卸载必须用 CLI
  try {
      const geminiPath = getGeminiPath();
      const env = getGeminiEnv();
      
      const args = ['extensions', action === 'install' ? 'install' : 'uninstall', url];
      
      // Use process.execPath (node) to run the script
      const result = spawnSync(process.execPath, [geminiPath, ...args], { 
        env,
        encoding: 'utf-8',
        timeout: 60000 // 1 minute timeout for installs
      });

      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'Command failed');
      }

      return NextResponse.json({ success: true, output: result.stdout });
  } catch (error: any) {
      console.error('Extension action failed:', error);
      return NextResponse.json({ error: error.message || 'Extension action failed' }, { status: 500 });
  }
}
