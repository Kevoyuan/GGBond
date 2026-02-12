import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { isAbsolute, resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_COMMAND_LENGTH = 2000;
const MAX_SHELL_LENGTH = 260;
const MAX_ENV_ENTRIES = 128;
const MAX_ENV_VALUE_LENGTH = 8000;
const MAX_OUTPUT_LENGTH = 200_000;
const COMMAND_TIMEOUT_MS = 60_000;

type TerminalRequestBody = {
  command?: unknown;
  cwd?: unknown;
  shell?: unknown;
  env?: unknown;
};

type OutputBuffer = {
  value: string;
  truncated: boolean;
};

const appendChunk = (buffer: OutputBuffer, chunk: string): OutputBuffer => {
  if (buffer.truncated || chunk.length === 0) {
    return buffer;
  }

  const remaining = MAX_OUTPUT_LENGTH - buffer.value.length;
  if (remaining <= 0) {
    return { ...buffer, truncated: true };
  }

  if (chunk.length <= remaining) {
    return { value: buffer.value + chunk, truncated: false };
  }

  return {
    value: buffer.value + chunk.slice(0, remaining),
    truncated: true,
  };
};

const finalizeOutput = (buffer: OutputBuffer, label: string) => {
  if (!buffer.truncated) return buffer.value;
  return `${buffer.value}\n...[${label} truncated]`;
};

const resolveWorkingDirectory = async (rawCwd: unknown) => {
  const fallback = process.cwd();
  if (typeof rawCwd !== 'string' || !rawCwd.trim()) return fallback;

  const candidate = rawCwd.trim();
  const absolutePath = isAbsolute(candidate) ? candidate : resolve(fallback, candidate);

  try {
    const stat = await fs.stat(absolutePath);
    return stat.isDirectory() ? absolutePath : fallback;
  } catch {
    return fallback;
  }
};

const sanitizeShell = (rawShell: unknown) => {
  if (typeof rawShell !== 'string') return null;
  const shell = rawShell.trim();
  if (!shell || shell.length > MAX_SHELL_LENGTH || shell.includes('\u0000')) {
    return null;
  }
  return shell;
};

const buildRuntimeEnv = (rawEnv: unknown) => {
  const runtimeEnv: NodeJS.ProcessEnv = { ...process.env };

  if (rawEnv && typeof rawEnv === 'object' && !Array.isArray(rawEnv)) {
    const entries = Object.entries(rawEnv).slice(0, MAX_ENV_ENTRIES);
    for (const [key, value] of entries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (typeof value !== 'string') continue;
      if (value.includes('\u0000') || value.length > MAX_ENV_VALUE_LENGTH) continue;
      runtimeEnv[key] = value;
    }
  }

  if (!runtimeEnv.FORCE_COLOR) runtimeEnv.FORCE_COLOR = '1';
  if (!runtimeEnv.CLICOLOR_FORCE) runtimeEnv.CLICOLOR_FORCE = '1';
  if (!runtimeEnv.TERM) runtimeEnv.TERM = 'xterm-256color';

  return runtimeEnv;
};

const getShellCommand = (command: string, shellOverride: string | null) => {
  const resolvedShell = shellOverride || (process.platform === 'win32'
    ? process.env.ComSpec || 'cmd.exe'
    : process.env.SHELL || '/bin/zsh');

  if (process.platform === 'win32') {
    return {
      shell: resolvedShell,
      args: ['/d', '/s', '/c', command],
    };
  }

  return {
    shell: resolvedShell,
    args: ['-lc', command],
  };
};

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

const executeCommand = (
  command: string,
  cwd: string,
  shellOverride: string | null,
  runtimeEnv: NodeJS.ProcessEnv
) =>
  new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const { shell, args } = getShellCommand(command, shellOverride);
    const child = spawn(shell, args, {
      cwd,
      env: runtimeEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout: OutputBuffer = { value: '', truncated: false };
    let stderr: OutputBuffer = { value: '', truncated: false };
    let timedOut = false;
    let settled = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        child.kill('SIGKILL');
      }, 2000).unref();
    }, COMMAND_TIMEOUT_MS);
    timeout.unref();

    child.stdout?.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      stdout = appendChunk(stdout, text);
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      stderr = appendChunk(stderr, text);
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      rejectPromise(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;

      if (timedOut) {
        stderr = appendChunk(stderr, '\n[terminated after timeout]');
      }

      resolvePromise({
        stdout: finalizeOutput(stdout, 'stdout'),
        stderr: finalizeOutput(stderr, 'stderr'),
        exitCode: timedOut ? 124 : code ?? 1,
        timedOut,
      });
    });
  });

export async function POST(req: NextRequest) {
  let body: TerminalRequestBody;

  try {
    body = (await req.json()) as TerminalRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const command = typeof body.command === 'string' ? body.command.trim() : '';
  if (!command) {
    return NextResponse.json({ error: 'command is required' }, { status: 400 });
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    return NextResponse.json(
      { error: `command exceeds max length (${MAX_COMMAND_LENGTH})` },
      { status: 400 }
    );
  }

  const cwd = await resolveWorkingDirectory(body.cwd);
  const shellOverride = sanitizeShell(body.shell);
  const runtimeEnv = buildRuntimeEnv(body.env);
  const startedAt = Date.now();

  try {
    const result = await executeCommand(command, cwd, shellOverride, runtimeEnv);
    return NextResponse.json({
      ...result,
      cwd,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute command';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
