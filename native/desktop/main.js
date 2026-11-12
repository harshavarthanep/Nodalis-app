// Nodalis for Windows - the app window.
// Loads the same Nodalis index.html as the website, from inside the app,
// so it works fully offline. Notes folder access, themes, canvas, graph,
// GitHub sync and exports all behave like they do in Chrome / Edge.
const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

const APP_ID = 'com.h24creationz.nodalis';
app.setAppUserModelId(APP_ID);       // proper name on Windows notifications

// One copy of the app at a time; a second launch focuses the first window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function isWebLink(url) {
  return /^(https?:|mailto:|tel:)/i.test(url);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 520,
    title: 'Nodalis',
    backgroundColor: '#f6f2e9',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  win.removeMenu();
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  // Links to websites open in the user's normal browser, not in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebLink(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isWebLink(url)) { event.preventDefault(); shell.openExternal(url); }
  });

  // Keyboard shortcuts that normally live in a menu bar.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const wc = win.webContents;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
    else if (ctrl && (input.key === '=' || input.key === '+')) { wc.setZoomLevel(wc.getZoomLevel() + 0.5); event.preventDefault(); }
    else if (ctrl && input.key === '-') { wc.setZoomLevel(wc.getZoomLevel() - 0.5); event.preventDefault(); }
    else if (ctrl && input.key === '0') { wc.setZoomLevel(0); event.preventDefault(); }
    else if (ctrl && input.shift && input.key.toLowerCase() === 'i') { wc.toggleDevTools(); event.preventDefault(); }
  });

  win.loadFile(path.join(__dirname, 'www', 'index.html'));
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // A local, single-user app: allow what Nodalis asks for
  // (folder access, notifications, clipboard).
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
