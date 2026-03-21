import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { NextResponse } from '@/src-sidecar/mock-next-server';

type InstallMethod = 'homebrew' | 'npm-global' | 'unknown' | 'missing';

interface CoreUpgradeStatus {
  localCoreVersion: string | null;
  globalCliVersion: string | null;
  globalCliPath: string | null;
  installMethod: InstallMethod;
  canUpgrade: boolean;
  upgradeCommand: string | null;
}

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getLocalCoreVersion(): Promise<string | null> {
  const packageJson = await readJson(path.join(process.cwd(), 'node_modules', '@google', 'gemini-cli-core', 'package.json'));
  return typeof packageJson?.version === 'string' ? packageJson.version : null;
}

function resolveGlobalGeminiPath(): string | null {
  try {
    const geminiPath = execSync('which gemini', { encoding: 'utf-8' }).trim();
    return geminiPath ? path.resolve(geminiPath) : null;
  } catch {
    return null;
  }
}

function resolveGlobalGeminiRealPath(): string | null {
  try {
    const geminiPath = execSync('which gemini', { encoding: 'utf-8' }).trim();
    return geminiPath ? fsSync.realpathSync(geminiPath) : null;
  } catch {
    return null;
  }
}

function detectInstallMethod(globalCliPath: string | null): InstallMethod {
  if (!globalCliPath) return 'missing';
  if (globalCliPath.includes('/Cellar/gemini-cli/')) return 'homebrew';
  if (globalCliPath.includes('node_modules/@google/gemini-cli/')) return 'npm-global';
  return 'unknown';
}

function getUpgradeCommand(installMethod: InstallMethod): { command: string; args: string[]; display: string | null } {
  switch (installMethod) {
    case 'homebrew':
      return { command: 'brew', args: ['upgrade', 'gemini-cli'], display: 'brew upgrade gemini-cli' };
    case 'npm-global':
      return { command: 'npm', args: ['install', '-g', '@google/gemini-cli'], display: 'npm install -g @google/gemini-cli' };
    default:
      return { command: '', args: [], display: null };
  }
}

async function readGeminiCliVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('gemini', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      resolve(output.trim() || null);
    });

    child.on('error', () => resolve(null));
  });
}

async function buildStatus(): Promise<CoreUpgradeStatus> {
  const localCoreVersion = await getLocalCoreVersion();
  const globalCliPath = resolveGlobalGeminiRealPath() || resolveGlobalGeminiPath();
  const globalCliVersion = await readGeminiCliVersion();
  const installMethod = detectInstallMethod(globalCliPath);
  const upgrade = getUpgradeCommand(installMethod);

  return {
    localCoreVersion,
    globalCliVersion,
    globalCliPath,
    installMethod,
    canUpgrade: Boolean(upgrade.display),
    upgradeCommand: upgrade.display,
  };
}

function runUpgrade(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `Upgrade command exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.on('error', reject);
  });
}

export async function GET() {
  try {
    return NextResponse.json(await buildStatus());
  } catch (error) {
    console.error('Failed to read core upgrade status:', error);
    return NextResponse.json({ error: 'Failed to read core upgrade status' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const beforeStatus = await buildStatus();
    const upgrade = getUpgradeCommand(beforeStatus.installMethod);

    if (!upgrade.display) {
      return NextResponse.json(
        { error: 'Automatic Gemini CLI upgrade is unavailable for this install method.' },
        { status: 400 }
      );
    }

    const result = await runUpgrade(upgrade.command, upgrade.args);
    const afterStatus = await buildStatus();

    return NextResponse.json({
      success: true,
      beforeVersion: beforeStatus.globalCliVersion,
      afterVersion: afterStatus.globalCliVersion,
      status: afterStatus,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    });
  } catch (error) {
    console.error('Failed to upgrade Gemini CLI:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upgrade Gemini CLI' },
      { status: 500 }
    );
  }
}
