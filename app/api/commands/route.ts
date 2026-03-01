import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { basename, join, resolve } from 'path';
import { resolveGeminiConfigDir, resolveRuntimeHome } from '@/lib/runtime-home';

type CommandScope = 'project' | 'global' | 'extension';

interface CommandFile {
  id: string;
  name: string;
  path: string;
  scope: CommandScope;
  editable: boolean;
  updatedAt: number;
  content: string;
}

const COMMANDS_CACHE_TTL_MS = 4000;
let commandsCache: { data: CommandFile[]; expiresAt: number } | null = null;
let commandsInFlight: Promise<CommandFile[]> | null = null;

function invalidateCommandsCache() {
  commandsCache = null;
  commandsInFlight = null;
}

function getGeminiHome() {
  const fromEnv = process.env.GEMINI_CLI_HOME?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return resolveGeminiConfigDir(fromEnv);
  }
  return resolveGeminiConfigDir(resolveRuntimeHome());
}

function getProjectCommandsDir() {
  return join(process.cwd(), '.gemini', 'commands');
}

function getGlobalCommandsDir() {
  return join(getGeminiHome(), 'commands');
}

function sanitizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function readCommandFilesFromDir(dir: string, scope: CommandScope, editable: boolean): Promise<CommandFile[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.toml'));

    const rows = await Promise.all(
      files.map(async (entry) => {
        const filePath = join(dir, entry.name);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = entry.name.replace(/\.toml$/, '');

        return {
          id: `${scope}:${filePath}`,
          name,
          path: filePath,
          scope,
          editable,
          updatedAt: stat.mtimeMs,
          content,
        } as CommandFile;
      })
    );

    return rows;
  } catch {
    return [];
  }
}

async function listCommandFiles() {
  const projectDir = getProjectCommandsDir();
  const globalDir = getGlobalCommandsDir();
  const geminiHome = getGeminiHome();

  const [projectCommands, globalCommands] = await Promise.all([
    readCommandFilesFromDir(projectDir, 'project', true),
    readCommandFilesFromDir(globalDir, 'global', true),
  ]);

  const extensionCommands: CommandFile[] = [];
  const extensionRoot = join(geminiHome, 'extensions');

  try {
    const extensionDirs = await fs.readdir(extensionRoot, { withFileTypes: true });
    for (const dirent of extensionDirs) {
      if (!dirent.isDirectory()) {
        continue;
      }
      const commandsDir = join(extensionRoot, dirent.name, 'commands');
      const commands = await readCommandFilesFromDir(commandsDir, 'extension', false);
      extensionCommands.push(...commands);
    }
  } catch {
    // ignore missing extension directory
  }

  return [...projectCommands, ...globalCommands, ...extensionCommands].sort((a, b) => b.updatedAt - a.updatedAt);
}

function isPathInsideAllowedWritableRoots(filePath: string) {
  const abs = resolve(filePath);
  const writableRoots = [resolve(getProjectCommandsDir()), resolve(getGlobalCommandsDir())];
  return writableRoots.some((root) => abs.startsWith(`${root}/`) || abs === root);
}

export async function GET() {
  try {
    const now = Date.now();
    if (commandsCache && commandsCache.expiresAt > now) {
      return NextResponse.json({ commands: commandsCache.data });
    }
    if (!commandsInFlight) {
      commandsInFlight = listCommandFiles().finally(() => {
        commandsInFlight = null;
      });
    }
    const commands = await commandsInFlight;
    commandsCache = { data: commands, expiresAt: Date.now() + COMMANDS_CACHE_TTL_MS };
    return NextResponse.json({ commands });
  } catch (error) {
    console.error('Failed to list command files:', error);
    return NextResponse.json({ error: 'Failed to list command files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, prompt } = await req.json();
    const slug = sanitizeName(String(name || ''));

    if (!slug) {
      return NextResponse.json({ error: 'Command name is required' }, { status: 400 });
    }

    const projectDir = getProjectCommandsDir();
    await fs.mkdir(projectDir, { recursive: true });

    const filePath = join(projectDir, `${slug}.toml`);

    const content = [
      `description = "${String(description || '').replace(/"/g, '\\"')}"`,
      '',
      'prompt = """',
      String(prompt || '').trim() || 'Describe what this command should do.',
      '"""',
      '',
    ].join('\n');

    await fs.writeFile(filePath, content, 'utf-8');
    invalidateCommandsCache();

    return NextResponse.json({ ok: true, path: filePath });
  } catch (error) {
    console.error('Failed to create command file:', error);
    return NextResponse.json({ error: 'Failed to create command file' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { path, content } = await req.json();

    if (typeof path !== 'string' || typeof content !== 'string') {
      return NextResponse.json({ error: 'path and content are required' }, { status: 400 });
    }

    if (!isPathInsideAllowedWritableRoots(path)) {
      return NextResponse.json({ error: 'Path is outside writable command directories' }, { status: 403 });
    }

    await fs.writeFile(resolve(path), content, 'utf-8');
    invalidateCommandsCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to update command file:', error);
    return NextResponse.json({ error: 'Failed to update command file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    if (!isPathInsideAllowedWritableRoots(path)) {
      return NextResponse.json({ error: 'Path is outside writable command directories' }, { status: 403 });
    }

    await fs.unlink(resolve(path));
    invalidateCommandsCache();
    return NextResponse.json({ ok: true, deleted: basename(path) });
  } catch (error) {
    console.error('Failed to delete command file:', error);
    return NextResponse.json({ error: 'Failed to delete command file' }, { status: 500 });
  }
}
