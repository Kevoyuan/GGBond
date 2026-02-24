#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targetDir = path.join(root, 'src-tauri', 'resources', 'node-runtime');
const isWindows = process.platform === 'win32';
const targetName = isWindows ? 'node.exe' : 'node';
const sourceNode = process.execPath;
const targetNode = path.join(targetDir, targetName);

if (!fs.existsSync(sourceNode)) {
  throw new Error(`Cannot find current Node runtime: ${sourceNode}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceNode, targetNode);

if (!isWindows) {
  fs.chmodSync(targetNode, 0o755);
}

console.log(`[tauri-node] Bundled runtime from ${sourceNode} -> ${targetNode}`);
