#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nextStandaloneDir = path.join(root, '.next', 'standalone');
const nextStaticDir = path.join(root, '.next', 'static');
const publicDir = path.join(root, 'public');
const targetDir = path.join(root, 'src-tauri', 'resources', 'next-standalone');
const BLOCKED_ENTRIES = [
  'gemini-home',
  '.gemini',
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

if (!fs.existsSync(nextStandaloneDir)) {
  throw new Error('Missing .next/standalone. Ensure next.config.js uses output=\"standalone\" and run `next build`.');
}

if (!fs.existsSync(nextStaticDir)) {
  throw new Error('Missing .next/static. Run `next build` first.');
}

fs.rmSync(targetDir, { recursive: true, force: true });
ensureDir(path.dirname(targetDir));
fs.cpSync(nextStandaloneDir, targetDir, { recursive: true });

// Remove accidental sensitive/runtime data that may be traced into standalone output.
for (const entry of BLOCKED_ENTRIES) {
  const candidate = path.join(targetDir, entry);
  fs.rmSync(candidate, { recursive: true, force: true });
}

// Next standalone server expects ".next/static" and "public" in known locations.
const targetNextStatic = path.join(targetDir, '.next', 'static');
ensureDir(path.dirname(targetNextStatic));
fs.cpSync(nextStaticDir, targetNextStatic, { recursive: true });

if (fs.existsSync(publicDir)) {
  const targetPublic = path.join(targetDir, 'public');
  fs.cpSync(publicDir, targetPublic, { recursive: true });
}

const serverEntry = path.join(targetDir, 'server.js');
if (!fs.existsSync(serverEntry)) {
  throw new Error(`Missing standalone server entry: ${serverEntry}`);
}

console.log(`[tauri-server] Prepared ${targetDir}`);
