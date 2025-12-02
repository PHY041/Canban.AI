const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow, backendProcess;
const isDev = !app.isPackaged;
const BACKEND_PORT = 51723;

function getBackendPath() {
  if (isDev) return null;
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(process.resourcesPath, 'backend', `canban-backend${ext}`);
}

function startBackend() { // Start backend in background (don't wait)
  if (isDev) { console.log('Dev mode: start backend manually'); return; }
  const backendPath = getBackendPath();
  if (!fs.existsSync(backendPath)) { console.error('Backend not found:', backendPath); return; }
  console.log('Starting backend:', backendPath);
  backendProcess = spawn(backendPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
  backendProcess.stdout.on('data', (d) => console.log('Backend:', d.toString()));
  backendProcess.stderr.on('data', (d) => console.log('Backend:', d.toString()));
  backendProcess.on('error', (e) => console.error('Backend error:', e));
  backendProcess.on('exit', (code) => console.log('Backend exited:', code));
}

function stopBackend() { if (backendProcess) { backendProcess.kill(); backendProcess = null; } }

function createWindow() {
  startBackend(); // Start backend but don't wait
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    title: 'CanBan.AI',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false, // Don't show until ready
  });
  mainWindow.once('ready-to-show', () => mainWindow.show()); // Show when content loaded
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopBackend(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', stopBackend);
