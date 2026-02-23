const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function checkBetterSqlite3() {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      [
        'try {',
        '  const fs = require("fs");',
        '  const os = require("os");',
        '  const path = require("path");',
        '  const BetterSqlite3 = require("better-sqlite3");',
        '  const dbPath = path.join(os.tmpdir(), "ggbond-native-check.db");',
        '  const db = new BetterSqlite3(dbPath);',
        '  db.pragma("journal_mode = WAL");',
        '  db.close();',
        '  process.exit(0);',
        '} catch (error) {',
        '  console.error(String(error && (error.stack || error.message || error)));',
        '  process.exit(1);',
        '}',
      ].join(' '),
    ],
    {
      cwd: projectRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return {
    ok: result.status === 0,
    output,
  };
}

function rebuildNodeNative() {
  const result = spawnSync(npmCmd, ['run', 'rebuild:node-native'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  return result.status === 0;
}

function rebuildBetterSqlite3FromSource() {
  const result = spawnSync(npmCmd, ['explore', 'better-sqlite3', '--', 'npm', 'run', 'build-release'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  return result.status === 0;
}

function main() {
  const initial = checkBetterSqlite3();
  if (initial.ok) {
    return;
  }

  const needsRebuild =
    initial.output.includes('better_sqlite3.node') ||
    initial.output.includes('NODE_MODULE_VERSION') ||
    initial.output.includes('was compiled against a different Node.js version') ||
    initial.output.includes('Could not locate the bindings file');

  if (!needsRebuild) {
    console.warn('[desktop:dev] better-sqlite3 failed to load, but not due to known ABI mismatch.');
    console.warn(initial.output);
    process.exit(1);
  }

  console.log('[desktop:dev] Detected better-sqlite3 ABI mismatch. Rebuilding for current Node runtime...');
  const rebuilt = rebuildNodeNative();
  if (!rebuilt) {
    console.error('[desktop:dev] Failed to rebuild better-sqlite3 for current Node runtime.');
    process.exit(1);
  }

  const after = checkBetterSqlite3();
  if (after.ok) {
    console.log('[desktop:dev] better-sqlite3 is ready.');
    return;
  }

  console.warn('[desktop:dev] npm rebuild did not produce a usable native binary. Trying source build...');
  const sourceBuilt = rebuildBetterSqlite3FromSource();
  if (!sourceBuilt) {
    console.error('[desktop:dev] Source build failed for better-sqlite3.');
    process.exit(1);
  }

  const afterSourceBuild = checkBetterSqlite3();
  if (!afterSourceBuild.ok) {
    console.error('[desktop:dev] better-sqlite3 still fails after source build.');
    console.error(afterSourceBuild.output);
    process.exit(1);
  }

  console.log('[desktop:dev] better-sqlite3 is ready (source build).');
}

main();
