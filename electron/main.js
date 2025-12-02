const { app, BrowserWindow, dialog } = require('electron'); // Electron core modules
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow, backendProcess;
const isDev = !app.isPackaged;
const BACKEND_PORT = 8000;

function getBackendPath() { // Get path to Python backend executable
  if (isDev) return null; // Dev mode uses external backend
  const resourcesPath = process.resourcesPath;
  const platform = process.platform;
  const ext = platform === 'win32' ? '.exe' : '';
  return path.join(resourcesPath, 'backend', `canban-backend${ext}`);
}

async function startBackend() { // Spawn bundled Python backend
  if (isDev) { console.log('Dev mode: expecting backend at localhost:8000'); return true; }
  const backendPath = getBackendPath();
  if (!fs.existsSync(backendPath)) { dialog.showErrorBox('Error', `Backend not found: ${backendPath}`); return false; }
  return new Promise((resolve) => {
    backendProcess = spawn(backendPath, [], { env: { ...process.env, PORT: String(BACKEND_PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
    backendProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));
    backendProcess.on('error', (err) => { console.error('Failed to start backend:', err); resolve(false); });
    setTimeout(() => resolve(true), 2000); // Give backend time to start
  });
}

function stopBackend() { if (backendProcess) { backendProcess.kill(); backendProcess = null; } }

async function createWindow() {
  const backendStarted = await startBackend();
  if (!backendStarted && !isDev) { app.quit(); return; }
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 15, y: 15 },
    icon: path.join(__dirname, '../assets/icon.png'),
  });
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopBackend(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', stopBackend);

