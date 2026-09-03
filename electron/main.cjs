/* ============================================================
   JM@Santé — coquille Electron (version Windows)
   Charge le même cœur applicatif www/ que l'APK Android.
   - Données : IndexedDB persistée dans %APPDATA%/jmsante
   - Exports/relèves : téléchargements natifs vers Téléchargements
   - Aucun accès Node côté page (contextIsolation)
============================================================ */
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");

let win = null;

function createWindow(){
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 420,
    minHeight: 640,
    backgroundColor: "#04100A",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "resources", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "..", "www", "index.html"));

  // Les téléchargements (relèves, sauvegardes) vont dans Téléchargements
  win.webContents.session.on("will-download", (e, item) => {
    const target = path.join(app.getPath("downloads"), item.getFilename());
    item.setSavePath(target);
    item.once("done", (_e, state) => {
      if (state === "completed") shell.showItemInFolder(target);
    });
  });

  // Liens externes → navigateur système
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });

  // Raccourcis utiles : zoom, plein écran, rechargement
  win.webContents.on("before-input-event", (e, input) => {
    if (input.control && input.key === "+"){ win.webContents.setZoomLevel(win.webContents.getZoomLevel()+0.5); e.preventDefault(); }
    if (input.control && input.key === "-"){ win.webContents.setZoomLevel(win.webContents.getZoomLevel()-0.5); e.preventDefault(); }
    if (input.control && input.key === "0"){ win.webContents.setZoomLevel(0); e.preventDefault(); }
    if (input.key === "F11"){ win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === "F5"){ win.webContents.reload(); e.preventDefault(); }
  });
}

// Instance unique (double-clic sur l'icône ne rouvre pas une 2e fenêtre)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock){ app.quit(); }
else {
  app.on("second-instance", () => { if (win){ if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
