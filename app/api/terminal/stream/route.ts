import { spawn as spawnPty } from 'node-pty';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { isAbsolute, resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  getTerminalProcess,
  registerTerminalProcess,
  removeTerminalProcess,
} from '@/lib/terminal-registry';

export const runtime = 'nodejs';

const MAX_COMMAND_LENGTH = 2000;
const MAX_SHELL_LENGTH = 260;
const MAX_ENV_ENTRIES = 128;
const MAX_ENV_VALUE_LENGTH = 8000;
const COMMAND_TIMEOUT_MS = 60_000;

type TerminalStreamRequestBody = {
  command?: unknown;
  cwd?: unknown;
  shell?: unknown;
  env?: unknown;
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

export async function POST(req: NextRequest) {
  let body: TerminalStreamRequestBody;

  try {
    body = (await req.json()) as TerminalStreamRequestBody;
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
  const runId = randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const startedAt = Date.now();
      let settled = false;
      let timedOut = false;

      const emit = (payload: Record<string, unknown>) => {
        if (settled) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      const cleanupAndClose = () => {
        if (settled) return;
        settled = true;
        removeTerminalProcess(runId);
        controller.close();
      };

      const { shell, args } = getShellCommand(command, shellOverride);
      const pty = spawnPty(shell, args, {
        cwd,
        env: runtimeEnv,
        name: runtimeEnv.TERM || 'xterm-256color',
        cols: 120,
        rows: 30,
      });

      registerTerminalProcess({
        id: runId,
        process: pty,
        kind: 'pty',
        command,
        cwd,
        startedAt,
        stopRequested: false,
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        pty.kill();
        setTimeout(() => {
          pty.kill();
        }, 2000).unref();
      }, COMMAND_TIMEOUT_MS);
      timeout.unref();

      emit({
        type: 'init',
        runId,
        cwd,
        shell,
        command,
        startedAt,
      });

      pty.onData((text: string) => {
        emit({
          type: 'stdout',
          chunk: text,
          runId,
        });
      });

      pty.onExit(({ exitCode }) => {
        clearTimeout(timeout);
        const record = getTerminalProcess(runId);
        const stopped = Boolean(record?.stopRequested);

        emit({
          type: 'exit',
          runId,
          exitCode: timedOut ? 124 : exitCode ?? (stopped ? 130 : 1),
          signal: null,
          timedOut,
          stopped,
          durationMs: Date.now() - startedAt,
        });

        cleanupAndClose();
      });
    },
    cancel() {
      const record = getTerminalProcess(runId);
      if (record) {
        record.stopRequested = true;
        if (record.kind === 'pty') {
          record.process.kill();
        } else {
          record.process.kill('SIGTERM');
        }
        setTimeout(() => {
          const latest = getTerminalProcess(runId);
          if (latest) {
            if (latest.kind === 'pty') {
              latest.process.kill();
            } else {
              latest.process.kill('SIGKILL');
            }
          }
        }, 2000).unref();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
