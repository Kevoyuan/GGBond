const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

function resolveCanonicalDataHome() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'ggbond', 'gemini-home');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'ggbond', 'gemini-home');
  }
  return path.join(home, '.local', 'share', 'ggbond', 'gemini-home');
}

const canonicalDataHome = resolveCanonicalDataHome();
const childEnv = {
  ...process.env,
  GGBOND_DATA_HOME: canonicalDataHome,
  GEMINI_CLI_HOME: canonicalDataHome,
};

console.log(`[desktop:dev] Using canonical data home: ${canonicalDataHome}`);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const ensureNative = spawnSync(process.execPath, [path.join(__dirname, 'ensure-node-native.cjs')], {
  stdio: 'inherit',
  env: childEnv,
});
if (ensureNative.status !== 0) {
  process.exit(ensureNative.status || 1);
}

const child = spawn(npmCmd, ['run', 'desktop:dev:raw'], {
  stdio: 'inherit',
  env: childEnv,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
