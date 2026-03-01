import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { resolveGeminiConfigDir, resolveRuntimeHome } from '@/lib/runtime-home';
import { Storage } from '@google/gemini-cli-core';
import { CoreService } from '@/lib/core-service';

interface ImportAgentRequest {
  sourcePath: string;
  sourcePaths?: string[]; // For batch import
}

// Resolve ~ to home directory
function resolvePath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

// Get agent name from markdown file
function getAgentNameFromFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const nameMatch = content.match(/^---\s*\nname:\s*(.+)\s*\n/);
    return nameMatch ? nameMatch[1].trim() : null;
  } catch {
    return null;
  }
}

// Import a single agent file
async function importAgentFile(sourcePath: string): Promise<{ success: boolean; name?: string; error?: string }> {
  const resolvedPath = resolvePath(sourcePath);

  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: `File not found: ${resolvedPath}` };
  }

  if (!resolvedPath.endsWith('.md')) {
    return { success: false, error: 'Agent file must be a .md file' };
  }

  const agentName = getAgentNameFromFile(resolvedPath);
  if (!agentName) {
    return { success: false, error: 'Invalid agent file: missing name in frontmatter' };
  }

  const targetDir = Storage.getUserAgentsDir();
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, path.basename(resolvedPath));

  if (fs.existsSync(targetPath)) {
    return { success: false, error: `Agent "${agentName}" already exists` };
  }

  if (path.resolve(resolvedPath) === path.resolve(targetPath)) {
    return { success: false, error: 'Source and target are the same file' };
  }

  try {
    fs.symlinkSync(resolvedPath, targetPath, 'file');
    return { success: true, name: agentName };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create symlink' };
  }
}

export async function POST(request: Request) {
  try {
    const body: ImportAgentRequest = await request.json();
    const { sourcePath, sourcePaths } = body;

    // Handle batch import
    if (sourcePaths && Array.isArray(sourcePaths) && sourcePaths.length > 0) {
      const results = [];
      const errors = [];

      for (const p of sourcePaths) {
        const result = await importAgentFile(p);
        if (result.success) {
          results.push(result);
        } else {
          errors.push({ path: p, error: result.error });
        }
      }

      // Reload agent registry after batch import
      if (results.length > 0) {
        try {
          const core = CoreService.getInstance();
          if (core.config) {
            await core.config.getAgentRegistry().reload();
          }
        } catch (e) {
          console.warn('[agents/import] Failed to reload agent registry:', e);
        }
      }

      return NextResponse.json({
        success: true,
        imported: results.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // Single file import
    if (!sourcePath) {
      return NextResponse.json(
        { error: 'Source path is required' },
        { status: 400 }
      );
    }

    const result = await importAgentFile(sourcePath);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Reload agent registry
    try {
      const core = CoreService.getInstance();
      if (core.config) {
        await core.config.getAgentRegistry().reload();
      }
    } catch (e) {
      console.warn('[agents/import] Failed to reload agent registry:', e);
    }

    return NextResponse.json({
      success: true,
      agent: {
        name: result.name,
        sourcePath: resolvePath(sourcePath),
      },
    });
  } catch (error) {
    console.error('[agents/import] Error importing agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import agent' },
      { status: 500 }
    );
  }
}

// GET handler - scan a directory or list from common locations
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dirPath = searchParams.get('dir');

  try {
    // If a directory path is provided, scan that directory
    if (dirPath) {
      const resolvedDir = resolvePath(dirPath);

      if (!fs.existsSync(resolvedDir)) {
        return NextResponse.json({ agents: [], error: 'Directory not found' });
      }

      const stats = fs.statSync(resolvedDir);
      if (!stats.isDirectory()) {
        return NextResponse.json({ agents: [], error: 'Path is not a directory' });
      }

      const files = fs.readdirSync(resolvedDir);
      const agents: { path: string; name: string }[] = [];

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(resolvedDir, file);
          const agentName = getAgentNameFromFile(filePath);
          if (agentName) {
            agents.push({ path: filePath, name: agentName });
          }
        }
      }

      return NextResponse.json({ agents, isDirectory: true });
    }

    // Default: scan common locations
    const runtimeConfigDir = resolveGeminiConfigDir(resolveRuntimeHome());
    const possiblePaths = [
      path.join(process.env.HOME || '', '.claude', 'agents'),
      path.join(process.env.HOME || '', 'gemini', 'agents'),
      path.join(runtimeConfigDir, 'agents'),
    ];

    const importableAgents: { path: string; name: string }[] = [];

    for (const dir of possiblePaths) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(dir, file);
            // Skip symlinks
            try {
              const stats = fs.lstatSync(filePath);
              if (stats.isSymbolicLink()) continue;
            } catch {
              continue;
            }

            const agentName = getAgentNameFromFile(filePath);
            if (agentName) {
              importableAgents.push({ path: filePath, name: agentName });
            }
          }
        }
      }
    }

    return NextResponse.json({ agents: importableAgents, isDirectory: false });
  } catch (error) {
    console.error('[agents/import] Error listing agents:', error);
    return NextResponse.json({ agents: [], error: 'Failed to scan directory' });
  }
}
