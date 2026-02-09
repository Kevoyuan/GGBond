import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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
    
    const files = entries.map(entry => {
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(targetPath, entry.name),
        // Add basic extension info for icons later
        extension: entry.isDirectory() ? null : path.extname(entry.name).toLowerCase()
      };
    });

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
