import { spawn, type ChildProcess } from 'node:child_process';
import process from 'node:process';

type OpenTarget = string | URL;

const toCommand = () => {
  if (process.platform === 'darwin') return 'open';
  if (process.platform === 'win32') return 'start';
  return 'xdg-open';
};

const toArgs = (target: OpenTarget) => {
  const url = String(target);
  if (process.platform === 'win32') {
    return ['/c', 'start', '', url];
  }
  return [url];
};

export default async function open(target: OpenTarget): Promise<ChildProcess> {
  const command = toCommand();
  const args = toArgs(target);

  const child = process.platform === 'win32'
    ? spawn('cmd', args, { stdio: 'ignore', windowsHide: true })
    : spawn(command, args, { stdio: 'ignore' });

  return child;
}
