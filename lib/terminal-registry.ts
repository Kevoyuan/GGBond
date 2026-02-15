import { ChildProcess } from 'child_process';

export interface TerminalProcessRecord {
  id: string;
  child: ChildProcess;
  command: string;
  cwd: string;
  startedAt: number;
  stopRequested: boolean;
}

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
  const signaled = record.child.kill(signal);
  if (signaled) {
    if (signal === 'SIGINT') {
      setTimeout(() => {
        const latest = getRegistry().get(id);
        if (latest) {
          latest.child.kill('SIGTERM');
          setTimeout(() => {
            const latestAfterTerm = getRegistry().get(id);
            if (latestAfterTerm) {
              latestAfterTerm.child.kill('SIGKILL');
            }
          }, 2000).unref();
        }
      }, 1200).unref();
      return { found: true, signaled };
    }

    setTimeout(() => {
      const latest = getRegistry().get(id);
      if (latest) {
        latest.child.kill('SIGKILL');
      }
    }, 2000).unref();
  }

  return { found: true, signaled };
};
