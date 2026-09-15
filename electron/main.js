'use strict';

/**
 * Electron shell around the Next.js overlay server.
 *
 * The server runs as a child process on 127.0.0.1 so that Streamlabs/OBS can
 * use `http://127.0.0.1:<port>/overlay` as a browser source, while this window
 * shows the control panel. Closing the window keeps the server alive in the
 * tray — the overlay must survive as long as the stream does.
 */

const { app, BrowserWindow, Menu, Tray, clipboard, dialog, nativeImage, shell } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const APP_NAME = 'League Overlay';
const HOST = '127.0.0.1';
const FIRST_PORT = 3000;
const LAST_PORT = 3020;
const STARTUP_TIMEOUT_MS = 60_000;

app.setName(APP_NAME);
app.setAppUserModelId('de.muggabatschr.league-overlay');

let serverProcess = null;
let mainWindow = null;
let tray = null;
let baseUrl = '';
let isQuitting = false;

const logFile = () => path.join(app.getPath('userData'), 'overlay-server.log');
const flagFile = () => path.join(app.getPath('userData'), 'shell-state.json');

function iconPath() {
  return path.join(__dirname, '..', 'build', 'icon.ico');
}

function appIcon() {
  const icon = nativeImage.createFromPath(iconPath());
  return icon.isEmpty() ? undefined : icon;
}

/** Path to the Next.js standalone server produced by `pnpm run build:server`. */
function serverEntry() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app-server', 'server.js')
    : path.join(__dirname, '..', 'electron-dist', 'server', 'server.js');
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, HOST);
  });
}

async function findFreePort() {
  for (let port = FIRST_PORT; port <= LAST_PORT; port += 1) {
    if (await portIsFree(port)) return port;
  }
  throw new Error(`Kein freier Port zwischen ${FIRST_PORT} und ${LAST_PORT} gefunden.`);
}

function startServer(port) {
  const entry = serverEntry();
  if (!fs.existsSync(entry)) {
    throw new Error(
      `Server-Dateien nicht gefunden (${entry}).\nBitte die Installation wiederholen.`
    );
  }

  const log = fs.createWriteStream(logFile(), { flags: 'a' });
  log.write(`\n--- ${new Date().toISOString()} · Start auf Port ${port} ---\n`);

  serverProcess = fork(entry, [], {
    cwd: path.dirname(entry),
    // Reuse Electron's own Node runtime — no separate Node installation needed.
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: HOST,
      // Program Files is read-only, so config and API key live in AppData.
      LEAGUE_OVERLAY_DATA_DIR: app.getPath('userData'),
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  serverProcess.stdout.pipe(log);
  serverProcess.stderr.pipe(log);

  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (isQuitting) return;
    dialog.showErrorBox(
      APP_NAME,
      `Der Overlay-Dienst wurde unerwartet beendet (Code ${code}).\n\nDetails: ${logFile()}`
    );
    app.quit();
  });
}

/** Resolves once the server accepts connections, rejects on timeout. */
function waitForServer(port) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (!serverProcess) {
        reject(new Error('Der Overlay-Dienst konnte nicht gestartet werden.'));
        return;
      }
      const socket = net.connect(port, HOST);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Der Overlay-Dienst hat nicht innerhalb von ${STARTUP_TIMEOUT_MS / 1000} Sekunden geantwortet.`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function stopServer() {
  if (!serverProcess) return;
  serverProcess.kill();
  serverProcess = null;
}

function readFlags() {
  try {
    return JSON.parse(fs.readFileSync(flagFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeFlags(flags) {
  try {
    fs.writeFileSync(flagFile(), JSON.stringify(flags, null, 2), 'utf-8');
  } catch {
    // A missing hint on the next start is not worth failing over.
  }
}

function openOverlayPreview() {
  const preview = new BrowserWindow({
    width: 900,
    height: 360,
    title: `${APP_NAME} — Overlay-Vorschau`,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    icon: appIcon(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  preview.loadURL(`${baseUrl}/overlay`);
}

function buildMenu() {
  const overlayUrl = `${baseUrl}/overlay`;

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Datei',
        submenu: [
          {
            label: 'Control-Panel neu laden',
            accelerator: 'CmdOrCtrl+R',
            click: () => mainWindow?.reload(),
          },
          { type: 'separator' },
          { label: 'Beenden', accelerator: 'CmdOrCtrl+Q', click: () => quitApp() },
        ],
      },
      {
        label: 'Overlay',
        submenu: [
          { label: 'Vorschau öffnen', click: openOverlayPreview },
          { label: 'URL für OBS/Streamlabs kopieren', click: () => clipboard.writeText(overlayUrl) },
          { label: 'Im Standardbrowser öffnen', click: () => shell.openExternal(overlayUrl) },
        ],
      },
      {
        label: 'Ansicht',
        submenu: [
          { role: 'zoomIn', label: 'Vergrößern' },
          { role: 'zoomOut', label: 'Verkleinern' },
          { role: 'resetZoom', label: 'Originalgröße' },
          { type: 'separator' },
          { role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' },
        ],
      },
      {
        label: 'Hilfe',
        submenu: [
          {
            label: 'Riot Developer Portal (API-Key)',
            click: () => shell.openExternal('https://developer.riotgames.com'),
          },
          { label: 'Log-Datei öffnen', click: () => shell.openPath(logFile()) },
          { type: 'separator' },
          {
            label: `Über ${APP_NAME}`,
            click: () =>
              dialog.showMessageBox({
                type: 'info',
                title: `Über ${APP_NAME}`,
                message: `${APP_NAME} ${app.getVersion()}`,
                detail: `Overlay-URL: ${overlayUrl}\nDaten: ${app.getPath('userData')}`,
                buttons: ['OK'],
              }),
          },
        ],
      },
    ])
  );
}

function createTray() {
  const icon = appIcon();
  if (!icon) return;

  tray = new Tray(icon);
  tray.setToolTip(`${APP_NAME} — läuft auf ${baseUrl}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Control-Panel öffnen', click: showMainWindow },
      { label: 'Overlay-URL kopieren', click: () => clipboard.writeText(`${baseUrl}/overlay`) },
      { label: 'Overlay-Vorschau öffnen', click: openOverlayPreview },
      { type: 'separator' },
      { label: 'Beenden', click: () => quitApp() },
    ])
  );
  tray.on('double-click', showMainWindow);
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 920,
    minWidth: 760,
    minHeight: 560,
    // Replaced by the page's own <title> once loaded; shown while it loads.
    title: `${APP_NAME} — Control-Panel`,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    icon: appIcon(),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`${baseUrl}/admin`);

  // Keep the app inside localhost; anything else belongs in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl)) {
      openOverlayPreview();
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(baseUrl)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    // Hide instead of quit: OBS keeps pulling the overlay from this server.
    event.preventDefault();
    mainWindow.hide();

    const flags = readFlags();
    if (!flags.trayHintShown) {
      writeFlags({ ...flags, trayHintShown: true });
      dialog.showMessageBox({
        type: 'info',
        title: APP_NAME,
        message: 'Das Overlay läuft weiter.',
        detail:
          'Der Overlay-Dienst bleibt im Hintergrund aktiv, damit die Browser-Quelle in OBS/Streamlabs nicht ausfällt.\n\n' +
          'Über das Symbol im Infobereich (Taskleiste, rechts unten) lässt sich das Control-Panel wieder öffnen oder die App vollständig beenden.',
        buttons: ['Verstanden'],
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function quitApp() {
  isQuitting = true;
  stopServer();
  app.quit();
}

async function bootstrap() {
  try {
    const port = await findFreePort();
    baseUrl = `http://${HOST}:${port}`;
    startServer(port);
    await waitForServer(port);
    buildMenu();
    createTray();
    createMainWindow();
  } catch (error) {
    isQuitting = true;
    stopServer();
    dialog.showErrorBox(APP_NAME, `Start fehlgeschlagen.\n\n${error.message}`);
    app.exit(1);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.whenReady().then(bootstrap);

  // The tray keeps the app alive after the window is closed.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    isQuitting = true;
    stopServer();
  });
  app.on('will-quit', stopServer);
}
