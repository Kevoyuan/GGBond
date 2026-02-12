/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { app, BrowserWindow, globalShortcut, Menu, Tray, nativeImage } = require('electron');

const START_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';
const WINDOW_TITLE = 'Gemini CodePilot';
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
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault();
      window.hide();
    }
  });

  window.loadURL(START_URL);
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

app.whenReady().then(() => {
  mainWindow = createMainWindow();
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
