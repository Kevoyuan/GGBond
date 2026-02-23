/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const os = require('os');
const { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage, ipcMain, shell, dialog } = require('electron');

// Check for headless mode
const isHeadless = process.argv.includes('--headless') || process.env.GEMINI_HEADLESS === '1' || process.env.GEMINI_HEADLESS === 'true';
const DEFAULT_SERVER_PORT = Number(process.env.GGBOND_SERVER_PORT || 3456);
const MAX_PORT_ATTEMPTS = 20;
const DEV_SERVER_PORT_START = 3000;
const DEV_SERVER_PORT_END = 3010;
const DEV_SERVER_WAIT_ATTEMPTS = 120;
const DEV_SERVER_WAIT_INTERVAL_MS = 500;

// Prevent multiple desktop instances from fighting for the same local server/DB.
const gotSingleInstanceLock = isHeadless ? true : app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

// Performance: Enable hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// app.commandLine.appendSwitch('no-sandbox');
// app.commandLine.appendSwitch('disable-gpu-sandbox');
// app.disableHardwareAcceleration();

// Detect if running in development
const isDev = !app.isPackaged;
let START_URL = isDev
  ? (process.env.ELECTRON_START_URL || 'http://localhost:3000')
  : `file://${path.join(__dirname, '../.next/start.html')}`;
const WINDOW_TITLE = 'GGBond';
const TOGGLE_SHORTCUT = process.env.ELECTRON_TOGGLE_SHORTCUT || 'CommandOrControl+Shift+Space';

function getStableDataHome() {
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

function migrateLegacyUserDataHome(legacyHome, targetHome) {
  if (!legacyHome || !targetHome) return;
  const resolvedLegacy = path.resolve(legacyHome);
  const resolvedTarget = path.resolve(targetHome);
  if (resolvedLegacy === resolvedTarget) return;
  if (!fs.existsSync(resolvedLegacy)) return;

  try {
    fs.mkdirSync(resolvedTarget, { recursive: true });

    const legacyDbPath = path.join(resolvedLegacy, 'ggbond.db');
    const targetDbPath = path.join(resolvedTarget, 'ggbond.db');
    if (fs.existsSync(legacyDbPath) && !fs.existsSync(targetDbPath)) {
      fs.copyFileSync(legacyDbPath, targetDbPath);
      console.log(`[Electron] Migrated DB from legacy userData home: ${legacyDbPath} -> ${targetDbPath}`);
    }

    const legacyGeminiDir = path.join(resolvedLegacy, '.gemini');
    const targetGeminiDir = path.join(resolvedTarget, '.gemini');
    if (fs.existsSync(legacyGeminiDir) && !fs.existsSync(targetGeminiDir)) {
      fs.cpSync(legacyGeminiDir, targetGeminiDir, { recursive: true });
      console.log(`[Electron] Migrated .gemini from legacy userData home: ${legacyGeminiDir} -> ${targetGeminiDir}`);
    }
  } catch (error) {
    console.warn('[Electron] Failed to migrate legacy userData home:', error);
  }
}

// Set headless env var for child processes
if (isHeadless) {
  process.env.GEMINI_HEADLESS = '1';
  console.log('[GGBond] Running in headless mode');
}

let mainWindow = null;
let tray = null;
let allowQuit = false;
let nextServer = null;
let nextHttpServer = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUrlReachable(url, timeoutMs = 400) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.destroy();
      resolve(true);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function fetchText(url, timeoutMs = 600) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          ok: response.statusCode && response.statusCode >= 200 && response.statusCode < 400,
          body,
        });
      });
    });

    request.on('error', () => resolve({ ok: false, body: '' }));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve({ ok: false, body: '' });
    });
  });
}

async function isGGBondDevServer(baseUrl) {
  const index = await fetchText(baseUrl);
  if (!index.ok) return false;
  const html = index.body || '';
  return html.includes('<title>GGBond</title>') || html.includes('A pixel-perfect AI IDE interface for gemini-cli');
}

async function resolveDevStartUrl() {
  const explicitUrl = process.env.ELECTRON_START_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  for (let attempt = 0; attempt < DEV_SERVER_WAIT_ATTEMPTS; attempt += 1) {
    let fallbackReachableUrl = null;

    for (let port = DEV_SERVER_PORT_START; port <= DEV_SERVER_PORT_END; port += 1) {
      const candidateUrl = `http://localhost:${port}`;
      if (!(await isUrlReachable(candidateUrl))) {
        continue;
      }

      if (!fallbackReachableUrl) {
        fallbackReachableUrl = candidateUrl;
      }

      if (await isGGBondDevServer(candidateUrl)) {
        console.log(`[Electron] Detected Next.js dev server at ${candidateUrl}`);
        return candidateUrl;
      }
    }

    // Keep backward compatibility when marker probing fails (e.g. custom page title)
    if (fallbackReachableUrl) {
      console.warn(`[Electron] Found reachable dev server at ${fallbackReachableUrl}, but could not verify it as GGBond yet. Retrying...`);
    }
    await delay(DEV_SERVER_WAIT_INTERVAL_MS);
  }

  throw new Error(
    `Unable to detect Next.js dev server on ports ${DEV_SERVER_PORT_START}-${DEV_SERVER_PORT_END}`
  );
}

// Start Next.js server in production
function startNextServer() {
  return new Promise(async (resolve, reject) => {
    const appRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');

    try {
      const next = require('next');
      const nextApp = next({
        dev: false,
        dir: appRoot,
      });
      const handle = nextApp.getRequestHandler();

      await nextApp.prepare();
      let lastError = null;

      for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
        const port = DEFAULT_SERVER_PORT + attempt;
        const candidateServer = http.createServer((req, res) => handle(req, res));

        try {
          await new Promise((listenResolve, listenReject) => {
            candidateServer.once('error', listenReject);
            candidateServer.listen(port, '127.0.0.1', () => {
              candidateServer.removeAllListeners('error');
              listenResolve();
            });
          });

          nextHttpServer = candidateServer;
          const url = `http://127.0.0.1:${port}`;
          console.log('[Next.js] Ready on', url);
          resolve(url);
          return;
        } catch (error) {
          lastError = error;
          if (error && error.code === 'EADDRINUSE') {
            console.warn(`[Next.js] Port ${port} in use, trying next port...`);
            try {
              candidateServer.close();
            } catch {
              // ignore close errors on failed server.
            }
            continue;
          }
          reject(error);
          return;
        }
      }

      reject(lastError || new Error('Unable to allocate port for local server'));
    } catch (error) {
      console.error('[Next.js Error]', error);
      reject(error);
    }
  });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: WINDOW_TITLE,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 18, y: 19 },
    autoHideMenuBar: true,
    show: false,
    // Performance optimizations
    backgroundColor: '#000000',
    transparent: false,
    // Set window icon (Linux/Windows)
    icon: path.join(__dirname, '..', 'public', 'gemini-pro.svg'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Enable web security in production
      webSecurity: !isDev,
      // Enable hardware acceleration for webgl
      webgl: true,
      // Faster rendering
      enableBlinkFeatures: 'CSSColorSchemeUARendering',
    },
  });

  // Performance: Preload scripts
  if (isDev) {
    window.webContents.openDevTools();
  }

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault();
      window.hide();
    }
  });

  // Load the app - now START_URL will be the local server in production
  window.loadURL(START_URL).catch((err) => {
    console.error('[Electron] Failed to load URL:', START_URL, err);
    window.loadURL('about:blank');
  });

  // Native context menu for inputs and text selection
  window.webContents.on('context-menu', (event, params) => {
    const template = [];
    if (params.isEditable) {
      template.push(
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Select All' }
      );
    } else if (params.selectionText) {
      template.push({ role: 'copy', label: 'Copy' });
    }

    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window });
    }
  });

  return window;
}

function toggleMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const candidateIcons = [
    path.join(__dirname, '..', 'public', 'gemini-pro.png'),
    path.join(__dirname, '..', 'public', 'gemini-pro.svg'),
    path.join(__dirname, '..', 'public', 'next.svg'),
    path.join(__dirname, '..', 'public', 'window.svg'),
  ];

  const trayIcon = candidateIcons
    .map((candidate) => nativeImage.createFromPath(candidate))
    .find((image) => !image.isEmpty());

  if (!trayIcon) {
    return;
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip(WINDOW_TITLE);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle Window',
      click: () => toggleMainWindow(),
    },
    {
      label: 'Quit',
      click: () => {
        allowQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(trayMenu);
  tray.on('click', () => toggleMainWindow());
}

// IPC Handlers
ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('system:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('system:getPath', (event, name) => {
  return app.getPath(name);
});

ipcMain.handle('system:openPrivacySettings', async () => {
  if (process.platform !== 'darwin') {
    return false;
  }
  return shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('dialog:validateDirectory', async (event, rawPath) => {
  try {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Path is empty', code: 'EINVAL' };
    }

    const input = rawPath.trim();
    const resolvedPath = input === '~'
      ? os.homedir()
      : input.startsWith('~/')
        ? path.join(os.homedir(), input.slice(2))
        : input;

    if (resolvedPath === os.homedir()) {
      return {
        ok: false,
        error: 'Please choose a specific project folder, not your Home directory (~).',
        code: 'EWORKSPACE_TOO_BROAD',
        hint: 'Selecting Home can trigger many macOS privacy prompts (Desktop/Music/Documents).'
      };
    }

    await fsp.access(resolvedPath);
    const stats = await fsp.stat(resolvedPath);
    if (!stats.isDirectory()) {
      return { ok: false, error: 'Path is not a directory', code: 'ENOTDIR', path: resolvedPath };
    }

    return { ok: true, path: resolvedPath };
  } catch (error) {
    const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : 'UNKNOWN';
    if (code === 'EACCES' || code === 'EPERM') {
      return {
        ok: false,
        error: 'Permission denied for this directory',
        code,
        hint: 'Use folder picker to grant access, or allow Full Disk Access in macOS Privacy settings.'
      };
    }
    if (code === 'ENOENT') {
      return { ok: false, error: 'Path not found', code };
    }
    return { ok: false, error: 'Cannot access directory', code };
  }
});

// Track maximize/unmaximize events
function setupMaximizeListener() {
  if (!mainWindow) return;
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximizeChange', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximizeChange', false);
  });
}

app.whenReady().then(async () => {
  // Ensure a stable writable data home for local app state (SQLite, auth, skills).
  // Avoid app-name/casing dependent userData paths to keep history/quota consistent.
  const configuredHome = process.env.GGBOND_DATA_HOME && process.env.GGBOND_DATA_HOME.trim();
  const stableHome = getStableDataHome();
  const selectedDataHome = configuredHome || stableHome;
  if (!configuredHome) {
    process.env.GGBOND_DATA_HOME = selectedDataHome;
  }
  if (!process.env.GEMINI_CLI_HOME) {
    process.env.GEMINI_CLI_HOME = selectedDataHome;
  }

  const legacyUserDataHome = path.join(app.getPath('userData'), 'gemini-home');
  migrateLegacyUserDataHome(legacyUserDataHome, selectedDataHome);

  try {
    fs.mkdirSync(selectedDataHome, { recursive: true });
  } catch (error) {
    console.warn('[Electron] Failed to create GGBOND_DATA_HOME:', selectedDataHome, error);
  }

  if (isDev) {
    START_URL = await resolveDevStartUrl();
  } else {
    // In production, start the Next.js server first
    console.log('[Electron] Starting Next.js server...');
    const serverUrl = await startNextServer();
    console.log('[Electron] Next.js server started at:', serverUrl);
    // Override START_URL to use local server
    START_URL = serverUrl;
  }

  // In headless mode, skip window creation and tray
  // The server will run in background for API calls
  if (isHeadless) {
    console.log('[Electron] Headless mode: skipping window and tray creation');
    console.log('[Electron] Server available at:', START_URL);
    return;
  }

  mainWindow = createMainWindow();

  // Set macOS Dock Icon
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  }

  setupMaximizeListener();
  createTray();
  globalShortcut.register(TOGGLE_SHORTCUT, () => toggleMainWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      return;
    }
    toggleMainWindow();
  });

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });
});

app.on('before-quit', () => {
  allowQuit = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  // Kill the Next.js server if running
  if (nextServer) {
    nextServer.kill();
    console.log('[Electron] Next.js server killed');
  }
  if (nextHttpServer) {
    nextHttpServer.close();
    nextHttpServer = null;
    console.log('[Electron] Next.js HTTP server closed');
  }
});
