import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getGeminiPath, getGeminiEnv } from '@/lib/gemini-utils';
import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import os from 'os';

export interface Skill {
  id: string;
  name: string;
  status: 'Enabled' | 'Disabled';
  isBuiltIn: boolean;
  description: string;
  location: string;
  scope: 'global' | 'project';
}

class UserInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'UserInputError';
    this.status = status;
  }
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

function getPrimarySkillsDir(geminiHome: string) {
  return path.join(resolveGeminiConfigRoot(geminiHome), 'skills');
}

function isSameOrChildPath(candidatePath: string, parentPath: string) {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

const PROJECT_SKILL_ROOTS = [
  path.resolve(path.join(process.cwd(), '.gemini', 'skills')),
  path.resolve(path.join(process.cwd(), '.agent', 'skills')),
  path.resolve(path.join(process.cwd(), '.agents', 'skills')),
];

function isPathWithin(basePath: string, candidatePath: string) {
  const normalizedBase = path.resolve(basePath);
  const normalizedCandidate = path.resolve(candidatePath);
  return (
    normalizedCandidate === normalizedBase ||
    normalizedCandidate.startsWith(`${normalizedBase}${path.sep}`)
  );
}

function inferSkillScope(skillPath: string, resolvedSkillPath?: string | null): 'global' | 'project' {
  const checkDirs = [path.dirname(skillPath)];
  if (resolvedSkillPath) {
    checkDirs.push(path.dirname(resolvedSkillPath));
  }

  for (const dir of checkDirs) {
    if (PROJECT_SKILL_ROOTS.some((projectRoot) => isPathWithin(projectRoot, dir))) {
      return 'project';
    }
  }

  return 'global';
}

function expandHome(inputPath: string) {
  const value = String(inputPath || '').trim();
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
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

async function listSkillDirectories(sourceDir: string): Promise<string[]> {
  const result: string[] = [];
  const directSkillFile = path.join(sourceDir, 'SKILL.md');
  try {
    await fs.access(directSkillFile);
    result.push(sourceDir);
    return result;
  } catch {
    // ignore
  }

  let entries: Dirent[];
  try {
    entries = await fs.readdir(sourceDir, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const candidate = path.join(sourceDir, entry.name);
    try {
      const candidateStat = await fs.stat(candidate);
      if (!candidateStat.isDirectory()) continue;
      await fs.access(path.join(candidate, 'SKILL.md'));
      result.push(candidate);
    } catch {
      // not a skill directory
    }
  }

  return result;
}

async function linkExternalSkillDirectory(geminiHome: string, source: string) {
  const expandedSource = expandHome(source);
  if (!expandedSource || !path.isAbsolute(expandedSource)) {
    throw new UserInputError('Please provide an absolute path (or ~/path).');
  }

  const resolvedSource = await fs.realpath(expandedSource).catch(() => null);
  if (!resolvedSource) {
    throw new UserInputError(`Source path not found: ${expandedSource}`);
  }
  const sourceStat = await fs.lstat(resolvedSource);
  if (!sourceStat.isDirectory()) {
    throw new UserInputError('Source must be a directory.');
  }

  const targetSkillsDir = getPrimarySkillsDir(geminiHome);
  await fs.mkdir(targetSkillsDir, { recursive: true });

  const sourceSkillDirs = await listSkillDirectories(resolvedSource);
  if (sourceSkillDirs.length === 0) {
    throw new UserInputError('No skill directories found at source path.');
  }

  let linked = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const sourceSkillDir of sourceSkillDirs) {
    const name = path.basename(sourceSkillDir);
    const linkPath = path.join(targetSkillsDir, name);
    const resolvedSourceSkillDir = await fs.realpath(sourceSkillDir).catch(() => sourceSkillDir);

    let exists = false;
    try {
      const existingStat = await fs.lstat(linkPath);
      exists = true;
      if (existingStat.isSymbolicLink()) {
        const resolvedExisting = await fs.realpath(linkPath).catch(() => null);
        if (resolvedExisting && path.resolve(resolvedExisting) === path.resolve(resolvedSourceSkillDir)) {
          skipped += 1;
          continue;
        }
      }
    } catch {
      exists = false;
    }

    if (exists) {
      conflicts.push(name);
      continue;
    }

    try {
      await fs.symlink(sourceSkillDir, linkPath, 'dir');
      linked += 1;
    } catch {
      conflicts.push(name);
    }
  }

  return {
    source: resolvedSource,
    targetSkillsDir,
    scanned: sourceSkillDirs.length,
    linked,
    skipped,
    conflicts,
  };
}

async function unlinkExternalSkillDirectory(geminiHome: string, source: string) {
  const expandedSource = expandHome(source);
  if (!expandedSource || !path.isAbsolute(expandedSource)) {
    throw new UserInputError('Please provide an absolute path (or ~/path).');
  }

  const resolvedSource = await fs.realpath(expandedSource).catch(() => null);
  if (!resolvedSource) {
    throw new UserInputError(`Source path not found: ${expandedSource}`);
  }
  const targetSkillsDir = getPrimarySkillsDir(geminiHome);

  // Case 1: the skills root itself is a symlink to this source.
  const targetStat = await fs.lstat(targetSkillsDir).catch(() => null);
  if (targetStat?.isSymbolicLink()) {
    const resolvedRootTarget = await fs.realpath(targetSkillsDir).catch(() => null);
    if (resolvedRootTarget && isSameOrChildPath(resolvedRootTarget, resolvedSource)) {
      await fs.unlink(targetSkillsDir);

      const fallbackSource = path.join(os.homedir(), '.gemini', 'skills');
      const fallbackExists = await fs.access(fallbackSource).then(() => true).catch(() => false);

      if (fallbackExists && !isSameOrChildPath(fallbackSource, resolvedSource)) {
        try {
          await fs.symlink(fallbackSource, targetSkillsDir, 'dir');
        } catch {
          await fs.mkdir(targetSkillsDir, { recursive: true });
        }
      } else {
        await fs.mkdir(targetSkillsDir, { recursive: true });
      }

      return {
        source: resolvedSource,
        targetSkillsDir,
        removed: 1,
        kept: [],
        removedRootSymlink: true,
      };
    }
  }

  const entries = await fs.readdir(targetSkillsDir, { withFileTypes: true }).catch(() => []);

  let removed = 0;
  const kept: string[] = [];
  for (const entry of entries) {
    if (!entry.isSymbolicLink()) continue;
    const linkPath = path.join(targetSkillsDir, entry.name);
    const resolvedLinkTarget = await fs.realpath(linkPath).catch(() => null);
    if (!resolvedLinkTarget) continue;
    if (
      path.resolve(resolvedLinkTarget) === path.resolve(resolvedSource) ||
      path.resolve(resolvedLinkTarget).startsWith(`${path.resolve(resolvedSource)}${path.sep}`)
    ) {
      await fs.unlink(linkPath).catch(() => undefined);
      removed += 1;
    } else {
      kept.push(entry.name);
    }
  }

  return { source: resolvedSource, targetSkillsDir, removed, kept };
}

export async function GET(req: Request) {
  try {
    const env = getGeminiEnv();
    const geminiHome = env.GEMINI_CLI_HOME || path.join(os.homedir(), '.gemini');
    const { searchParams } = new URL(req.url);
    const queryName = searchParams.get('name');
    const includeContent = searchParams.get('content') === '1';
    const includeMeta = searchParams.get('meta') === '1';

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
      // Include symlinked skill folders; many external skills are mounted this way.
      const directories = entries.filter((entry) => entry.isDirectory() || entry.isSymbolicLink());
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
              location: skillPath,
              scope: inferSkillScope(
                skillPath,
                await fs.realpath(skillPath).catch(() => null)
              )
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

    const sortedSkills = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));

    if (includeMeta) {
      const sources = await Promise.all(
        skillDirs.map(async (configuredPath) => {
          let exists = false;
          let resolvedPath: string | null = null;
          try {
            await fs.access(configuredPath);
            exists = true;
            resolvedPath = await fs.realpath(configuredPath).catch(() => configuredPath);
          } catch {
            exists = false;
          }
          return { configuredPath, resolvedPath, exists };
        })
      );
      return NextResponse.json({ skills: sortedSkills, sources });
    }

    return NextResponse.json(sortedSkills);

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

    if (action === 'link_dir') {
      if (!source) return NextResponse.json({ error: 'Source path required' }, { status: 400 });
      const summary = await linkExternalSkillDirectory(geminiHome, source);
      const conflictSuffix = summary.conflicts.length > 0
        ? ` conflicts: ${summary.conflicts.slice(0, 5).join(', ')}${summary.conflicts.length > 5 ? '...' : ''}.`
        : '';
      return NextResponse.json({
        success: true,
        summary,
        message: `Linked ${summary.linked}/${summary.scanned} skills into ${summary.targetSkillsDir} (skipped ${summary.skipped}, conflicts ${summary.conflicts.length}).${conflictSuffix}`,
      });
    }

    if (action === 'unlink_dir') {
      if (!source) return NextResponse.json({ error: 'Source path required' }, { status: 400 });
      const summary = await unlinkExternalSkillDirectory(geminiHome, source);
      const rootNote = (summary as { removedRootSymlink?: boolean }).removedRootSymlink
        ? ' (removed root skills symlink)'
        : '';
      return NextResponse.json({
        success: true,
        summary,
        message: `Removed ${summary.removed} linked skills in ${summary.targetSkillsDir} for source ${summary.source}${rootNote}.`,
      });
    }

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
    if (error instanceof UserInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operation failed' },
      { status: 500 }
    );
  }
}
