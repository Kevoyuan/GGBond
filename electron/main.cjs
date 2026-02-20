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
  // Ensure a writable data home for local app state (SQLite, etc.).
  if (!process.env.GGBOND_DATA_HOME) {
    process.env.GGBOND_DATA_HOME = path.join(app.getPath('userData'), 'gemini-home');
  }
  try {
    fs.mkdirSync(process.env.GGBOND_DATA_HOME, { recursive: true });
  } catch (error) {
    console.warn('[Electron] Failed to create GGBOND_DATA_HOME:', process.env.GGBOND_DATA_HOME, error);
  }

  // In production, start the Next.js server first
  if (!isDev) {
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
