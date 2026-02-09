import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export async function GET() {
  const paths = [
    join(homedir(), '.gemini', 'GEMINI.md'),          // Global
    join(process.cwd(), 'GEMINI.md'),                  // Project Root
    join(process.cwd(), '.gemini', 'GEMINI.md'),       // Project .gemini/
  ];

  const memories = paths
    .filter(p => existsSync(p))
    .map(p => ({ path: p, content: readFileSync(p, 'utf-8') }));

  return NextResponse.json(memories);
}

export async function POST(req: Request) {
  const { path, content } = await req.json();
  
  let targetPath = path;
  if (!targetPath) {
      // Default to project GEMINI.md
      targetPath = join(process.cwd(), 'GEMINI.md');
  }
  
  // Ensure we append if it exists? Or overwrite?
  // "addMemory" implies appending.
  // The user's code: writeFileSync(path, content, 'utf-8'); -> This overwrites!
  // But /memory add <text> implies appending.
  // I should probably append.
  
  let newContent = content;
  if (existsSync(targetPath)) {
      const existing = readFileSync(targetPath, 'utf-8');
      newContent = existing + '\n\n' + content;
  }
  
  writeFileSync(targetPath, newContent, 'utf-8');
  return NextResponse.json({ success: true });
}
