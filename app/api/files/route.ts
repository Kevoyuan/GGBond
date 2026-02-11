import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CoreService } from '@/lib/core-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedPath = searchParams.get('path');

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
    let files = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: path.join(targetPath, entry.name),
      extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase(),
      isIgnored: false
    }));

    try {
      const fileDiscovery = core.getFileDiscoveryService();
      files = files.filter(f => !fileDiscovery.shouldIgnoreFile(f.path));
    } catch (e) {
      console.warn('[FileAPI] FileDiscoveryService failed, falling back to all files', e);
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
