import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import type { Dirent } from 'fs';
import os from 'os';
import path from 'path';

interface FileItem {
  name: string;
  type: 'directory' | 'file';
  path: string;
  extension: string | null;
  isIgnored: boolean;
}

const MENTION_SUPPORTED_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv', '.tsv', '.log', '.ini', '.env',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.php', '.java', '.kt', '.go', '.rs', '.swift', '.cs',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.m', '.mm', '.sql', '.sh', '.bash', '.zsh', '.fish',
  '.html', '.css', '.scss', '.less', '.svg', '.pdf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.mp3', '.wav', '.ogg', '.m4a'
]);

const MACOS_PRIVACY_DIR_NAMES = new Set([
  'Desktop',
  'Documents',
  'Downloads',
  'Music',
  'Movies',
  'Pictures',
  'Library',
]);

function isMentionSupported(item: FileItem) {
  if (item.type === 'directory') return true;
  return !!item.extension && MENTION_SUPPORTED_EXTENSIONS.has(item.extension);
}

function isSameOrChildPath(candidate: string, base: string) {
  const normalizedCandidate = path.resolve(candidate);
  const normalizedBase = path.resolve(base);
  const rel = path.relative(normalizedBase, normalizedCandidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function shouldAvoidMacOSPrivacyTraversal(rootPath: string, entryPath: string, isDirectory: boolean) {
  if (!isDirectory || process.platform !== 'darwin') {
    return false;
  }

  const homeDir = os.homedir();
  const protectedDirs = Array.from(MACOS_PRIVACY_DIR_NAMES).map((name) => path.join(homeDir, name));

  // If the workspace itself is one of the protected directories, allow traversal.
  const rootInsideProtected = protectedDirs.some((protectedDir) => isSameOrChildPath(rootPath, protectedDir));
  if (rootInsideProtected) {
    return false;
  }

  // Otherwise, avoid descending into protected directories from broad roots
  // like "~" to prevent repeated macOS permission prompts.
  return protectedDirs.some((protectedDir) => isSameOrChildPath(entryPath, protectedDir));
}

function resolveTargetPath(inputPath: string | null) {
  if (!inputPath) {
    return process.cwd();
  }
  if (inputPath === '~') {
    return os.homedir();
  }
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

async function walkFiles(
  rootPath: string,
  limit: number,
  query: string | null,
  shouldIgnoreFile: (filePath: string) => boolean
) {
  const result: FileItem[] = [];
  const queue: string[] = [rootPath];

  while (queue.length > 0 && result.length < limit) {
    const currentDir = queue.shift();
    if (!currentDir) {
      break;
    }

    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true }) as unknown as Dirent[];
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (result.length >= limit) {
        break;
      }

      const entryPath = path.join(currentDir, entry.name);
      const ignored = shouldIgnoreFile(entryPath);
      if (ignored) {
        continue;
      }

      if (entry.isDirectory() && !shouldAvoidMacOSPrivacyTraversal(rootPath, entryPath, true)) {
        queue.push(entryPath);
      }

      const relativePath = path.relative(rootPath, entryPath) || entry.name;
      if (query && !relativePath.toLowerCase().includes(query)) {
        continue;
      }

      result.push({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: entryPath,
        extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase(),
        isIgnored: false
      });
    }
  }

  result.sort((a, b) => {
    if (a.type === b.type) {
      return a.path.localeCompare(b.path);
    }
    return a.type === 'directory' ? -1 : 1;
  });

  return result;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedPath = searchParams.get('path');
  const query = searchParams.get('q')?.trim().toLowerCase() || null;
  const indexMode = searchParams.get('index') === '1';
  const mentionsMode = searchParams.get('mentions') === '1';
  const ignoreGitignore = searchParams.get('ignore') !== '0' && searchParams.get('ignore') !== 'false';
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') || 120)));

  // Codex-style guardrail: indexed search should always be workspace-bounded.
  if (indexMode && !requestedPath) {
    return NextResponse.json(
      {
        error: 'Workspace path is required for indexed search',
        code: 'WORKSPACE_REQUIRED',
        hint: 'Please add/select a workspace before using @ file search.',
      },
      { status: 400 }
    );
  }

  // Default to current working directory if no path provided
  const targetPath = resolveTargetPath(requestedPath);

  try {
    // Basic security check: ensure we can access the path
    await fs.access(targetPath);

    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    let files: FileItem[] = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: path.join(targetPath, entry.name),
      extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase(),
      isIgnored: false
    }));

    let shouldIgnoreFile = (_filePath: string) => false;
    if (ignoreGitignore) {
      try {
        // Lazy-load CoreService so basic directory listing does not fail
        // when optional native dependencies are unavailable in current runtime.
        const { CoreService } = await import('@/lib/core-service');
        const core = CoreService.getInstance();
        const fileDiscovery = core.getFileDiscoveryService();
        shouldIgnoreFile = (filePath: string) => fileDiscovery.shouldIgnoreFile(filePath);
        files = files.filter(f => !fileDiscovery.shouldIgnoreFile(f.path));
      } catch (e) {
        console.warn('[FileAPI] FileDiscoveryService failed, falling back to all files', e);
      }
    }

    if (indexMode || query) {
      files = await walkFiles(targetPath, limit, query, shouldIgnoreFile);
    }

    if (mentionsMode) {
      files = files.filter(isMentionSupported);
    }

    // Sort: Directories first, then files
    files.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    return NextResponse.json({
      path: targetPath,
      files
    });

  } catch (error) {
    console.error('File API Error:', error);
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : null;

    if (code === 'ENOENT') {
      return NextResponse.json({ error: 'Path not found', code }, { status: 404 });
    }

    if (code === 'EACCES' || code === 'EPERM') {
      return NextResponse.json(
        {
          error: 'Permission denied for this directory',
          code,
          hint: 'Use folder picker to grant access, or allow Full Disk Access in macOS Privacy settings.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: 'Failed to read directory', code }, { status: 500 });
  }
}
