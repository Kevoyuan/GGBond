/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage, ipcMain, shell } = require('electron');

// Performance: Enable hardware acceleration
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Detect if running in development
const isDev = !app.isPackaged;
const START_URL = isDev
  ? (process.env.ELECTRON_START_URL || 'http://localhost:3000')
  : `file://${path.join(__dirname, '../.next/start.html')}`;
const WINDOW_TITLE = 'GG-Bond';
const TOGGLE_SHORTCUT = process.env.ELECTRON_TOGGLE_SHORTCUT || 'CommandOrControl+Shift+Space';

let mainWindow = null;
let tray = null;
let allowQuit = false;

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: WINDOW_TITLE,
    autoHideMenuBar: true,
    show: false,
    // Performance optimizations
    backgroundColor: '#000000',
    transparent: false,
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
  window.webContents.session.setCacheEnabled(true);

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

  // Load the app
  if (isDev) {
    window.loadURL(START_URL);
  } else {
    // In production, load the pre-built HTML from Next.js output
    const indexPath = path.join(__dirname, '../.next/server/app/index.html');
    window.loadFile(indexPath).catch((err) => {
      console.error('[Electron] Failed to load index.html:', err);
      // Fallback - try alternative path
      window.loadFile(path.join(__dirname, '../.next/index.html')).catch(() => {
        // Last resort: show error
        window.loadURL('about:blank');
      });
    });
  }

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

app.whenReady().then(() => {
  mainWindow = createMainWindow();
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
});
