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

exports.default = async function afterPack(context) {
  const resourcesDir = resolveResourcesDir(context);
  if (!resourcesDir) {
    console.log('[afterPack] No resources directory found, skipping prune step.');
    return;
  }

  const unpackedResult = pruneTree(
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules')
  );

  console.log(
    `[afterPack] Pruned unpacked node_modules: removed ${unpackedResult.removedDirs} directories and ${unpackedResult.removedFiles} files.`
  );
};
