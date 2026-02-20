const fs = require('fs');
const path = require('path');

function removePath(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function shouldRemoveDir(name) {
  return (
    name === '__tests__' ||
    name === 'test' ||
    name === 'tests' ||
    name === 'docs' ||
    name === 'doc' ||
    name === 'examples' ||
    name === '.github'
  );
}

function shouldRemoveFile(nameLower) {
  if (nameLower === 'skill.md') {
    return false;
  }
  return (
    nameLower.endsWith('.map') ||
    nameLower.endsWith('.md') ||
    nameLower === 'license' ||
    nameLower.startsWith('license.') ||
    nameLower.startsWith('readme') ||
    nameLower.startsWith('changelog')
  );
}

function pruneTree(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return { removedDirs: 0, removedFiles: 0 };
  }

  let removedDirs = 0;
  let removedFiles = 0;
  const stack = [rootPath];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir || !fs.existsSync(currentDir)) continue;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const lowerName = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (shouldRemoveDir(lowerName) && removePath(fullPath)) {
          removedDirs += 1;
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && shouldRemoveFile(lowerName) && removePath(fullPath)) {
        removedFiles += 1;
      }
    }
  }

  return { removedDirs, removedFiles };
}

function resolveResourcesDir(context) {
  const candidates = [
    path.join(context.appOutDir, 'resources'),
    path.join(context.appOutDir, 'Contents', 'Resources'),
    path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app`,
      'Contents',
      'Resources'
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function pruneLocaleDirs(targetDir, keep) {
  if (!targetDir || !fs.existsSync(targetDir)) return 0;
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.endsWith('.lproj')) continue;
    if (keep.has(entry.name)) continue;
    if (removePath(path.join(targetDir, entry.name))) {
      removed += 1;
    }
  }
  return removed;
}

function prunePrebuildsToCurrentPlatform(prebuildsDir, keepDirNames) {
  if (!fs.existsSync(prebuildsDir)) return 0;
  const entries = fs.readdirSync(prebuildsDir, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (keepDirNames.has(entry.name)) continue;
    if (removePath(path.join(prebuildsDir, entry.name))) {
      removed += 1;
    }
  }
  return removed;
}

function pruneUnpackedArtifacts(resourcesDir) {
  const unpackedRoot = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules');
  if (!fs.existsSync(unpackedRoot)) {
    return { removedPaths: 0, removedPrebuildDirs: 0 };
  }

  let removedPaths = 0;
  let removedPrebuildDirs = 0;

  // Runtime build does not require Next SWC compiler binaries.
  if (removePath(path.join(unpackedRoot, '@next', 'swc-darwin-arm64'))) {
    removedPaths += 1;
  }
  if (removePath(path.join(unpackedRoot, '@next', 'swc-darwin-x64'))) {
    removedPaths += 1;
  }

  // Keep only current platform prebuilds.
  removedPrebuildDirs += prunePrebuildsToCurrentPlatform(
    path.join(unpackedRoot, 'node-pty', 'prebuilds'),
    new Set(['darwin-arm64'])
  );
  removedPrebuildDirs += prunePrebuildsToCurrentPlatform(
    path.join(unpackedRoot, 'tree-sitter-bash', 'prebuilds'),
    new Set(['darwin-arm64'])
  );

  // Remove heavy sources and intermediate objects not needed at runtime.
  if (removePath(path.join(unpackedRoot, 'better-sqlite3', 'deps'))) {
    removedPaths += 1;
  }
  if (removePath(path.join(unpackedRoot, 'better-sqlite3', 'src'))) {
    removedPaths += 1;
  }
  if (removePath(path.join(unpackedRoot, 'better-sqlite3', 'build', 'Release', 'obj'))) {
    removedPaths += 1;
  }
  if (removePath(path.join(unpackedRoot, 'tree-sitter-bash', 'src'))) {
    removedPaths += 1;
  }
  if (removePath(path.join(unpackedRoot, 'tree-sitter-bash', 'bin'))) {
    removedPaths += 1;
  }

  return { removedPaths, removedPrebuildDirs };
}

exports.default = async function afterPack(context) {
  const resourcesDir = resolveResourcesDir(context);
  if (!resourcesDir) {
    console.log('[afterPack] No resources directory found, skipping prune step.');
    return;
  }

  const unpackedResult = pruneTree(
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules')
  );

  const artifactPrune = pruneUnpackedArtifacts(resourcesDir);

  const contentsDir = path.resolve(resourcesDir, '..');
  const keepLocales = new Set(['en.lproj', 'zh_CN.lproj']);
  const removedResourceLocales = pruneLocaleDirs(resourcesDir, keepLocales);
  const frameworkResourcesDir = path.join(
    contentsDir,
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'A',
    'Resources'
  );
  const removedFrameworkLocales = pruneLocaleDirs(frameworkResourcesDir, keepLocales);

  console.log(
    `[afterPack] Pruned unpacked node_modules: removed ${unpackedResult.removedDirs} directories and ${unpackedResult.removedFiles} files.`
  );
  console.log(
    `[afterPack] Removed runtime artifacts: ${artifactPrune.removedPaths} paths, ${artifactPrune.removedPrebuildDirs} prebuild directories.`
  );
  console.log(
    `[afterPack] Removed locale directories: resources=${removedResourceLocales}, framework=${removedFrameworkLocales}.`
  );
};
