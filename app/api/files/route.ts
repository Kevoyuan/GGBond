import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { CoreService } from '@/lib/core-service';

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

function isMentionSupported(item: FileItem) {
  if (item.type === 'directory') return true;
  return !!item.extension && MENTION_SUPPORTED_EXTENSIONS.has(item.extension);
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

      if (entry.isDirectory()) {
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
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') || 120)));

  // Default to current working directory if no path provided
  const targetPath = requestedPath || process.cwd();

  try {
    // Basic security check: ensure we can access the path
    await fs.access(targetPath);

    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    const core = CoreService.getInstance();
    let files: FileItem[] = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: path.join(targetPath, entry.name),
      extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase(),
      isIgnored: false
    }));

    let shouldIgnoreFile = (_filePath: string) => false;
    try {
      const fileDiscovery = core.getFileDiscoveryService();
      shouldIgnoreFile = (filePath: string) => fileDiscovery.shouldIgnoreFile(filePath);
      files = files.filter(f => !fileDiscovery.shouldIgnoreFile(f.path));
    } catch (e) {
      console.warn('[FileAPI] FileDiscoveryService failed, falling back to all files', e);
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
    return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
  }
}
