#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
const publicDir = path.join(root, 'public');
const nextStaticDir = path.join(root, '.next', 'static');
const nextServerAppDir = path.join(root, '.next', 'server', 'app');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visit);
      continue;
    }
    if (entry.isFile()) {
      visit(fullPath);
    }
  }
}

function copyFilePreserveRelative(fromRoot, filePath, toRoot) {
  const rel = path.relative(fromRoot, filePath);
  const target = path.join(toRoot, rel);
  ensureDir(path.dirname(target));
  fs.copyFileSync(filePath, target);
}

if (!fs.existsSync(nextServerAppDir)) {
  throw new Error('Missing .next/server/app. Run `next build` before preparing Tauri dist.');
}

if (!fs.existsSync(nextStaticDir)) {
  throw new Error('Missing .next/static. Run `next build` before preparing Tauri dist.');
}

fs.rmSync(outDir, { recursive: true, force: true });
ensureDir(outDir);

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, outDir, { recursive: true });
}

const outNextStaticDir = path.join(outDir, '_next', 'static');
ensureDir(path.dirname(outNextStaticDir));
fs.cpSync(nextStaticDir, outNextStaticDir, { recursive: true });

walk(nextServerAppDir, (filePath) => {
  if (!filePath.endsWith('.html')) return;
  copyFilePreserveRelative(nextServerAppDir, filePath, outDir);
});

const indexPath = path.join(outDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error('Failed to produce out/index.html for Tauri bundle.');
}

console.log(`[tauri-dist] Prepared ${outDir}`);
