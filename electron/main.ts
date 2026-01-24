import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

// Track repeating alarms by id
const repeaters = new Map<string, NodeJS.Timeout>();

function stopRepeater(id: string) {
  const t = repeaters.get(id);
  if (t) clearInterval(t);
  repeaters.delete(id);
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    webPreferences: {
      // IMPORTANT: this must point to the BUILT preload (vite-electron builds to preload.mjs)
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  // Helps Windows show notifications consistently
  app.setAppUserModelId("ffxi-clock");

  createWindow();
});

// Renderer -> Main: start repeating notifications (click toast to stop)
ipcMain.on(
  "ffxi:notify",
  (_event, payload: { id: string; title: string; body: string }) => {
    const { id, title, body } = payload;

    // already repeating? ignore
    if (repeaters.has(id)) return;

    const showToast = () => {
      try {
        const n = new Notification({ title, body });

        // Clicking the toast stops the spam
        n.on("click", () => {
          stopRepeater(id);
          BrowserWindow.getAllWindows()[0]?.webContents.send("ffxi:timerDismissed", { id });
        });

        n.show();
      } catch {
        // ignore
      }
    };

    // Show once immediately
    showToast();

    // Repeat every 20 seconds until dismissed
    const interval = setInterval(showToast, 20_000);
    repeaters.set(id, interval);
  }
);

// optional manual stop
ipcMain.on("ffxi:notifyStop", (_event, payload: { id: string }) => {
  stopRepeater(payload.id);
});
