/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage, ipcMain, shell, dialog } = require('electron');
// Performance: Enable hardware acceleration
// app.commandLine.appendSwitch('enable-gpu-rasterization');
// app.commandLine.appendSwitch('enable-zero-copy');
// app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.disableHardwareAcceleration();

// Detect if running in development
const isDev = !app.isPackaged;
let START_URL = isDev
  ? (process.env.ELECTRON_START_URL || 'http://localhost:3000')
  : `file://${path.join(__dirname, '../.next/start.html')}`;
const WINDOW_TITLE = 'GGBond';
const TOGGLE_SHORTCUT = process.env.ELECTRON_TOGGLE_SHORTCUT || 'CommandOrControl+Shift+Space';

let mainWindow = null;
let tray = null;
let allowQuit = false;
let nextServer = null;

// Start Next.js server in production
function startNextServer() {
  return new Promise((resolve) => {
    const port = 3456;
    nextServer = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', port.toString()], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: port.toString() },
    });

    nextServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Next.js]', output);
      if (output.includes('Ready') || output.includes('started server')) {
        resolve(`http://localhost:${port}`);
      }
    });

    nextServer.stderr.on('data', (data) => {
      console.error('[Next.js Error]', data.toString());
    });

    nextServer.on('close', (code) => {
      console.log('[Next.js] Server closed with code:', code);
    });
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

  // Performance: Enable caching
  // window.webContents.session.setCacheEnabled(true);

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

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
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
  // In production, start the Next.js server first
  if (!isDev) {
    console.log('[Electron] Starting Next.js server...');
    const serverUrl = await startNextServer();
    console.log('[Electron] Next.js server started at:', serverUrl);
    // Override START_URL to use local server
    START_URL = serverUrl;
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
});
