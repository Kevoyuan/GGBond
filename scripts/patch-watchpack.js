#!/usr/bin/env node
/**
 * patch-watchpack.js
 *
 * Patches Next.js 15's bundled Watchpack to fix EIO errors from ghost DMG volumes.
 *
 * Root cause: Watchpack's doScan() method calls fs.lstat() on every entry
 * in a watched directory WITHOUT checking the `ignored` function first.
 * On macOS, when the project is inside /Volumes/, Watchpack creates a parent
 * watcher chain that eventually scans /Volumes/ itself. Ghost entries from
 * unmounted DMG files exist in the directory listing but fail lstat with EIO.
 *
 * Fix: Add `this.ignored(path)` check before lstat in doScan.
 * The same check already exists in setFileTime(), setDirectory(), and
 * onWatchEvent() — it was only missing from doScan().
 */

const fs = require('fs');
const path = require('path');

const watchpackPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'next',
  'dist',
  'compiled',
  'watchpack',
  'watchpack.js'
);

try {
  const code = fs.readFileSync(watchpackPath, 'utf8');

  // The target pattern: lstat loop in doScan without ignored check
  const target = 'for(const t of s){r.lstat(t,((i,s)=>{';
  const replacement = 'for(const t of s){if(this.ignored(t)){c();continue}r.lstat(t,((i,s)=>';

  if (code.includes(replacement)) {
    console.log('[watchpack-patch] Already applied, skipping.');
    process.exit(0);
  }

  if (!code.includes(target)) {
    console.error('[watchpack-patch] ERROR: Could not find target pattern in Watchpack.');
    console.error('[watchpack-patch] The bundled Watchpack may have been updated. Please check manually.');
    process.exit(1);
  }

  const newCode = code.replace(target, replacement);
  fs.writeFileSync(watchpackPath, newCode, 'utf8');
  console.log('[watchpack-patch] Successfully patched Watchpack doScan to check ignored() before lstat().');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('[watchpack-patch] Watchpack file not found at:', watchpackPath);
    console.error('[watchpack-patch] Did you run npm install?');
    process.exit(1);
  }
  console.error('[watchpack-patch] Error:', err.message);
  process.exit(1);
}
