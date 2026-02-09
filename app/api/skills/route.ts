import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getGeminiPath, getGeminiEnv } from '@/lib/gemini-utils';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface Skill {
  name: string;
  status: 'Enabled' | 'Disabled';
  isBuiltIn: boolean;
  description: string;
  location: string;
}

const SKILLS_DIR = path.join(process.env.HOME || os.homedir(), '.gemini/skills');

export async function GET() {
  try {
    // Check if directory exists
    try {
      await fs.access(SKILLS_DIR);
    } catch {
      return NextResponse.json([]);
    }

    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory());

    const skills = await Promise.all(skillDirs.map(async (dir) => {
      const skillPath = path.join(SKILLS_DIR, dir.name, 'SKILL.md');
      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        // Parse frontmatter
        const match = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
        let name = dir.name;
        let description = '';
        
        if (match) {
            const frontmatter = match[1];
            const nameMatch = frontmatter.match(/name:\s*(.*)/);
            const descMatch = frontmatter.match(/description:\s*(.*)/);
            if (nameMatch) name = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
        }
        
        return {
            name,
            status: 'Enabled', // Defaulting to Enabled as we verify existence
            isBuiltIn: false, // Assuming user skills are not built-in
            description,
            location: skillPath
        } as Skill;
      } catch (e) {
        return null; 
      }
    }));

    return NextResponse.json(skills.filter((s): s is Skill => s !== null));

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, name, source } = await req.json();
    const geminiPath = getGeminiPath();
    const env = getGeminiEnv();

    const NAME_REGEX = /^[a-zA-Z0-9-]+$/;

    let args: string[] = [];
    if (action === 'enable') {
      if (!name || !NAME_REGEX.test(name)) return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 });
      args = ['skills', 'enable', name];
    } else if (action === 'disable') {
      if (!name || !NAME_REGEX.test(name)) return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 });
      args = ['skills', 'disable', name];
    } else if (action === 'install') {
      if (!source) return NextResponse.json({ error: 'Source required' }, { status: 400 });
      args = ['skills', 'install', source];
    } else if (action === 'uninstall') {
        if (!name || !NAME_REGEX.test(name)) return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 });
        args = ['skills', 'uninstall', name];
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await new Promise<void>((resolve, reject) => {
      const gemini = spawn(process.execPath, [geminiPath, ...args], { env });
      let stderr = '';

      gemini.stderr.on('data', (data) => stderr += data.toString());

      gemini.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || 'Command failed'));
        } else {
          resolve();
        }
      });
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Operation failed' }, { status: 500 });
  }
}
