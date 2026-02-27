#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targetDir = path.join(root, 'src-tauri', 'resources', 'node-runtime');
const targetLibDir = path.join(root, 'src-tauri', 'resources', 'lib');
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

  // Homebrew Node depends on @rpath/libnode.<abi>.dylib. Tauri app runtime
  // resolves this at Contents/Resources/resources/lib, so copy it there.
  if (process.platform === 'darwin') {
    const sourceLibRoot = path.resolve(path.dirname(sourceNode), '..', 'lib');
    if (fs.existsSync(sourceLibRoot)) {
      const libnodeName = fs
        .readdirSync(sourceLibRoot)
        .find((name) => /^libnode\.\d+\.dylib$/.test(name));
      if (libnodeName) {
        fs.mkdirSync(targetLibDir, { recursive: true });
        fs.copyFileSync(path.join(sourceLibRoot, libnodeName), path.join(targetLibDir, libnodeName));
        console.log(`[tauri-node] Bundled ${libnodeName} -> ${path.join(targetLibDir, libnodeName)}`);
      } else {
        console.warn(`[tauri-node] No libnode.<abi>.dylib found under ${sourceLibRoot}`);
      }
    } else {
      console.warn(`[tauri-node] Node lib directory not found: ${sourceLibRoot}`);
    }
  }
}

console.log(`[tauri-node] Bundled runtime from ${sourceNode} -> ${targetNode}`);
