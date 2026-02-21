import { ChildProcess } from 'child_process';
import { IPty } from 'node-pty';

interface TerminalProcessRecordBase {
  id: string;
  command: string;
  cwd: string;
  startedAt: number;
  stopRequested: boolean;
}

export interface ChildTerminalProcessRecord extends TerminalProcessRecordBase {
  kind: 'child_process';
  process: ChildProcess;
}

export interface PtyTerminalProcessRecord extends TerminalProcessRecordBase {
  kind: 'pty';
  process: IPty;
}

export type TerminalProcessRecord = ChildTerminalProcessRecord | PtyTerminalProcessRecord;

export type TerminalStopSignal = 'SIGINT' | 'SIGTERM';

type RegistryMap = Map<string, TerminalProcessRecord>;

type GlobalRegistry = typeof globalThis & {
  __gemUiTerminalRegistry?: RegistryMap;
};

const getRegistry = (): RegistryMap => {
  const globalWithRegistry = globalThis as GlobalRegistry;
  if (!globalWithRegistry.__gemUiTerminalRegistry) {
    globalWithRegistry.__gemUiTerminalRegistry = new Map<string, TerminalProcessRecord>();
  }
  return globalWithRegistry.__gemUiTerminalRegistry;
};

export const registerTerminalProcess = (record: TerminalProcessRecord) => {
  getRegistry().set(record.id, record);
};

export const getTerminalProcess = (id: string) => getRegistry().get(id);

export const removeTerminalProcess = (id: string) => {
  getRegistry().delete(id);
};

export const markTerminalProcessStopRequested = (id: string) => {
  const record = getRegistry().get(id);
  if (!record) return false;
  record.stopRequested = true;
  return true;
};

export const requestTerminalStop = (
  id: string,
  signal: TerminalStopSignal = 'SIGTERM'
) => {
  const record = getRegistry().get(id);
  if (!record) {
    return { found: false, signaled: false };
  }

  record.stopRequested = true;
  const signaled = killProcess(record, signal);
  if (signaled) {
    if (signal === 'SIGINT') {
      setTimeout(() => {
        const latest = getRegistry().get(id);
        if (latest) {
          killProcess(latest, 'SIGTERM');
          setTimeout(() => {
            const latestAfterTerm = getRegistry().get(id);
            if (latestAfterTerm) {
              killProcess(latestAfterTerm, 'SIGKILL');
            }
          }, 2000).unref();
        }
      }, 1200).unref();
      return { found: true, signaled };
    }

    setTimeout(() => {
      const latest = getRegistry().get(id);
      if (latest) {
        killProcess(latest, 'SIGKILL');
      }
    }, 2000).unref();
  }

  return { found: true, signaled };
};

export const writeTerminalInput = (id: string, data: string) => {
  const record = getRegistry().get(id);
  if (!record || typeof data !== 'string') return { found: false, written: false };

  if (record.kind === 'pty') {
    record.process.write(data);
    return { found: true, written: true };
  }

  const child = record.process;
  if (child.stdin && typeof child.stdin.write === 'function') {
    child.stdin.write(data);
    return { found: true, written: true };
  }

  return { found: true, written: false };
};

const killProcess = (record: TerminalProcessRecord, signal: TerminalStopSignal | 'SIGKILL') => {
  if (record.kind === 'pty') {
    // node-pty only supports SIGTERM and SIGKILL behavior via kill(), so SIGINT is emulated.
    if (signal === 'SIGINT') {
      record.process.write('\u0003');
      return true;
    }
    record.process.kill();
    return true;
  }

  return record.process.kill(signal);
};
