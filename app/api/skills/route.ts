import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getGeminiPath, getGeminiEnv } from '@/lib/gemini-utils';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface Skill {
  id: string;
  name: string;
  status: 'Enabled' | 'Disabled';
  isBuiltIn: boolean;
  description: string;
  location: string;
}

function resolveGeminiConfigRoot(homePath: string) {
  return path.basename(homePath) === '.gemini' ? homePath : path.join(homePath, '.gemini');
}

function getSkillDirs(envHome: string) {
  const candidates = [
    envHome,
    path.join(process.cwd(), 'gemini-home'),
    path.join(os.homedir(), '.gemini'),
  ].filter(Boolean);

  const uniqueHomes = Array.from(new Set(candidates));
  return uniqueHomes.map((home) => path.join(resolveGeminiConfigRoot(home), 'skills'));
}

async function getDisabledSkills(geminiHome: string): Promise<Set<string>> {
  const settingsPath = path.join(resolveGeminiConfigRoot(geminiHome), 'settings.json');

  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const parsed = JSON.parse(content);
    const disabled = Array.isArray(parsed?.skills?.disabled) ? parsed.skills.disabled : [];
    return new Set(disabled.map((v: string) => String(v).trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function resolveSkillFile(geminiHome: string, skillNameOrId: string): Promise<string | null> {
  const safeName = String(skillNameOrId || '').trim();
  if (!safeName || safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
    return null;
  }
  const skillDirs = getSkillDirs(geminiHome);
  for (const skillsDir of skillDirs) {
    const skillPath = path.join(skillsDir, safeName, 'SKILL.md');
    try {
      await fs.access(skillPath);
      return skillPath;
    } catch {
      // continue
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const env = getGeminiEnv();
    const geminiHome = env.GEMINI_CLI_HOME || path.join(os.homedir(), '.gemini');
    const { searchParams } = new URL(req.url);
    const queryName = searchParams.get('name');
    const includeContent = searchParams.get('content') === '1';

    if (queryName && includeContent) {
      const skillPath = await resolveSkillFile(geminiHome, queryName);
      if (!skillPath) {
        return NextResponse.json({ error: `Skill not found: ${queryName}` }, { status: 404 });
      }
      const content = await fs.readFile(skillPath, 'utf-8');
      return NextResponse.json({ id: queryName, location: skillPath, content });
    }

    const disabledSkills = await getDisabledSkills(geminiHome);
    const skillDirs = getSkillDirs(geminiHome);
    const merged = new Map<string, Skill>();

    for (const skillsDir of skillDirs) {
      try {
        await fs.access(skillsDir);
      } catch {
        continue;
      }

      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      const directories = entries.filter((entry) => entry.isDirectory());
      const parsed = await Promise.all(
        directories.map(async (dir) => {
          const skillPath = path.join(skillsDir, dir.name, 'SKILL.md');
          try {
            const content = await fs.readFile(skillPath, 'utf-8');
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
              id: dir.name,
              name,
              status: (disabledSkills.has(name) || disabledSkills.has(dir.name)) ? 'Disabled' : 'Enabled',
              isBuiltIn: false,
              description,
              location: skillPath
            } as Skill;
          } catch {
            return null;
          }
        })
      );

      for (const skill of parsed) {
        if (!skill) continue;
        if (!merged.has(skill.id)) {
          merged.set(skill.id, skill);
        }
      }
    }

    return NextResponse.json(
      Array.from(merged.values())
        .sort((a, b) => a.name.localeCompare(b.name))
    );

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, name, source, content } = await req.json();
    const geminiPath = getGeminiPath();
    const env = getGeminiEnv();
    const geminiHome = env.GEMINI_CLI_HOME || path.join(os.homedir(), '.gemini');

    let args: string[] = [];
    if (action === 'enable') {
      args = ['skills', 'enable', name];
    } else if (action === 'disable') {
      args = ['skills', 'disable', name];
    } else if (action === 'install') {
      if (!source) return NextResponse.json({ error: 'Source required' }, { status: 400 });
      args = ['skills', 'install', source];
    } else if (action === 'uninstall') {
        args = ['skills', 'uninstall', name];
    } else if (action === 'update') {
      if (!name) return NextResponse.json({ error: 'Skill name required' }, { status: 400 });
      if (typeof content !== 'string') return NextResponse.json({ error: 'Skill content required' }, { status: 400 });
      const skillPath = await resolveSkillFile(geminiHome, name);
      if (!skillPath) return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
      await fs.writeFile(skillPath, content, 'utf-8');
      return NextResponse.json({ success: true });
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
