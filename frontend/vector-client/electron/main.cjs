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

function createDevServerUnavailableHtml(devServerUrl) {
  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>Vector Messenger</title>
        <style>
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            background: #111214;
            color: #f4f4f5;
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .card {
            max-width: 520px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 32px;
            background: rgba(255, 255, 255, 0.04);
            padding: 34px;
            box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
          }

          h1 {
            margin: 0 0 12px;
            font-size: 26px;
          }

          p {
            margin: 0 0 16px;
            color: #a1a1aa;
            line-height: 1.6;
          }

          code {
            display: block;
            border-radius: 18px;
            background: rgba(0, 0, 0, 0.32);
            padding: 14px 16px;
            color: #ddd6fe;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <h1>Vite dev-server не запущен</h1>
          <p>Electron пытается открыть ${devServerUrl}, но сервер React-приложения не отвечает.</p>
          <p>Запусти в отдельном терминале:</p>
          <code>npm run dev</code>
        </main>
      </body>
    </html>
  `;
}

async function clearHttpCache(mainWindow) {
  try {
    await mainWindow.webContents.session.clearCache();
  }
  catch (error) {
    console.warn('Failed to clear Electron HTTP cache.', error);
  }
}

async function loadApplication(mainWindow) {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  await clearHttpCache(mainWindow);

  if (devServerUrl) {
    try {
      await mainWindow.loadURL(devServerUrl);
    }
    catch (error) {
      console.error('Failed to load Vite dev server.', error);
      await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createDevServerUnavailableHtml(devServerUrl))}`);
    }

    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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

  void loadApplication(mainWindow);
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
