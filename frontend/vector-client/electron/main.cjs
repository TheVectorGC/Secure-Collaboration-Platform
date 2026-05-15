const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { registerVectorCryptoIpc } = require('./crypto/vectorCryptoIpc.cjs');

const vectorProfile = process.env.VECTOR_PROFILE;

if (vectorProfile) {
  const safeProfileName = vectorProfile.replace(/[^a-zA-Z0-9_-]/g, '_');
  app.setPath(
    'userData',
    path.join(app.getPath('appData'), `vector-client-${safeProfileName}`)
  );
}

function renderDevServerUnavailablePage(mainWindow, devServerUrl) {
  const escapedDevServerUrl = devServerUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Vector Messenger</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #111214;
            color: #f4f4f5;
            font-family: Inter, Segoe UI, Arial, sans-serif;
          }

          .card {
            width: min(560px, calc(100vw - 48px));
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 28px;
            background: rgba(255, 255, 255, 0.045);
            padding: 32px;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
          }

          h1 {
            margin: 0 0 12px;
            font-size: 24px;
          }

          p {
            margin: 0 0 18px;
            color: #a1a1aa;
            line-height: 1.55;
          }

          code {
            display: block;
            margin-top: 12px;
            padding: 14px 16px;
            border-radius: 16px;
            background: rgba(0, 0, 0, 0.35);
            color: #ddd6fe;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <h1>Vite dev-server не запущен</h1>
          <p>Electron пытается открыть ${escapedDevServerUrl}, но сервер разработки не отвечает.</p>
          <p>Открой отдельный терминал в папке vector-client и запусти:</p>
          <code>npm run dev</code>
          <p>После появления строки Local: http://localhost:5173 перезапусти Electron-профиль.</p>
        </main>
      </body>
    </html>
  `)}`);
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#111214',
    title: 'Vector Messenger',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.webContents.on('did-fail-load', (_event, errorCode) => {
      if (errorCode === -102) {
        renderDevServerUnavailablePage(mainWindow, devServerUrl);
      }
    });

    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};

app.whenReady().then(() => {
  registerVectorCryptoIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});