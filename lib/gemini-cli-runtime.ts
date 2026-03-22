import fs from 'fs';
import path from 'path';
import { createRequire, Module } from 'module';

type GeminiCliRuntime = {
  executablePath: string;
  executableRealPath: string;
  nodeModulesPath: string;
  corePackageJsonPath: string;
};

function isExecutable(candidatePath: string): boolean {
  try {
    fs.accessSync(candidatePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getPathCandidates(binaryName: string): string[] {
  const envPath = process.env.PATH || '';
  const entries = envPath.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .filter(Boolean)
      : [''];

  const candidates: string[] = [];
  for (const entry of entries) {
    for (const extension of extensions) {
      candidates.push(path.join(entry, `${binaryName}${extension}`));
    }
  }

  if (process.platform === 'darwin') {
    candidates.push('/opt/homebrew/bin/gemini');
    candidates.push('/usr/local/bin/gemini');
  }

  return candidates;
}

function findGeminiExecutable(): string | null {
  const explicitCandidates = [
    process.env.GGBOND_GEMINI_BIN,
    process.env.GEMINI_BIN,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of explicitCandidates) {
    if (fs.existsSync(candidate) && isExecutable(candidate)) {
      return candidate;
    }
  }

  const binaryName = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';
  for (const candidate of getPathCandidates(binaryName)) {
    if (fs.existsSync(candidate) && isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findNodeModulesRoot(startPath: string): string | null {
  let current = path.dirname(startPath);

  while (true) {
    if (path.basename(current) === 'node_modules') {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function resolveGeminiCliRuntime(): GeminiCliRuntime {
  const executablePath = findGeminiExecutable();
  if (!executablePath) {
    throw new Error('Gemini CLI is not installed. Install it first so GGBond can reuse the local runtime.');
  }

  const executableRealPath = fs.realpathSync(executablePath);
  const inferredNodeModulesRoot = findNodeModulesRoot(executableRealPath);

  const moduleSearchBases = [
    executableRealPath,
    executablePath,
    inferredNodeModulesRoot ? path.join(inferredNodeModulesRoot, '@google', 'gemini-cli', 'package.json') : null,
  ].filter((value): value is string => Boolean(value));

  let corePackageJsonPath: string | null = null;

  for (const base of moduleSearchBases) {
    try {
      const baseRequire = createRequire(base);
      corePackageJsonPath = baseRequire.resolve('@google/gemini-cli-core/package.json');
      break;
    } catch {
      continue;
    }
  }

  if (!corePackageJsonPath) {
    throw new Error(`Found Gemini CLI at ${executablePath}, but could not resolve @google/gemini-cli-core from that installation.`);
  }

  const nodeModulesPath = findNodeModulesRoot(corePackageJsonPath);
  if (!nodeModulesPath) {
    throw new Error(`Resolved gemini-cli-core from ${corePackageJsonPath}, but could not determine its node_modules root.`);
  }

  return {
    executablePath,
    executableRealPath,
    nodeModulesPath,
    corePackageJsonPath,
  };
}

export function configureGeminiCliRuntime(): GeminiCliRuntime {
  const runtime = resolveGeminiCliRuntime();
  const existingNodePath = process.env.NODE_PATH
    ? process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
    : [];

  if (!existingNodePath.includes(runtime.nodeModulesPath)) {
    process.env.NODE_PATH = [runtime.nodeModulesPath, ...existingNodePath].join(path.delimiter);
    (Module as typeof Module & { _initPaths: () => void })._initPaths();
  }

  process.env.GGBOND_GEMINI_BIN = runtime.executablePath;
  process.env.GGBOND_GEMINI_CLI_CORE = runtime.corePackageJsonPath;

  return runtime;
}
