const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { createMetrics } = require('./metrics.cjs');
const { scanDirectory } = require('./storage.cjs');
const metrics = createMetrics();
const index = path.join(__dirname, '..', 'ui', 'index.html');
let window, inspection, selectedFolder;

function handle(name, callback) {
  ipcMain.handle(`orbit:${name}`, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== pathToFileURL(index).href) throw new Error('Untrusted request.');
    return callback(...args);
  });
}

function createWindow() {
  window = new BrowserWindow({ width: 1440, height: 960, minWidth: 880, minHeight: 650, show: false, frame: false, transparent: true, backgroundColor: '#00000000', title: 'Orbit', icon: path.join(__dirname, '..', 'assets', 'icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { inspection?.abort(); window = null; });
  window.loadFile(index);
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  handle('system', () => metrics.system());
  handle('snapshot', () => metrics.snapshot());
  handle('processes', () => metrics.processes());
  handle('health', () => metrics.health());
  handle('inspect', async () => {
    if (inspection) throw new Error('An inspection is already running.');
    inspection = new AbortController();
    try {
      const chosen = await dialog.showOpenDialog(window, { title: 'Choose a folder to understand', properties: ['openDirectory'] });
      if (chosen.canceled) return null;
      selectedFolder = chosen.filePaths[0];
      return await scanDirectory(selectedFolder, { signal: inspection.signal });
    } finally { inspection = null; }
  });
  handle('cancel-inspect', () => { inspection?.abort(); return true; });
  handle('reveal', async () => {
    if (!selectedFolder) throw new Error('Inspect a folder first.');
    const error = await shell.openPath(selectedFolder);
    if (error) throw new Error(error);
    return true;
  });
  handle('export', async () => {
    const report = await metrics.report();
    const chosen = await dialog.showSaveDialog(window, { title: 'Save a privacy-conscious health report', defaultPath: `Orbit-report-${new Date().toISOString().slice(0,10)}.json`, filters: [{ name: 'JSON report', extensions: ['json'] }] });
    if (chosen.canceled || !chosen.filePath) return null;
    await fs.writeFile(chosen.filePath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    return { saved: true };
  });
  handle('window', action => {
    if (action === 'minimize') window.minimize();
    else if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (action === 'close') window.close();
    else throw new Error('Unknown window action.');
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
