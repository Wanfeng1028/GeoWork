import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { join } from "node:path";
import {
  startRuntime,
  stopRuntime,
  checkHealth,
  getRuntimeStatus,
} from "./runtime";
import { registerDesktopIPC } from "./ipc/desktopIpc";
import { registerRuntimeIPC } from "./ipc/runtimeIpc";
import { registerSystemIPC } from "./ipc/systemIpc";
import { registerClipboardIPC } from "./ipc/clipboardIpc";
import { registerNotificationIPC } from "./ipc/notificationIpc";
import registerWindows from "./ipc/windows";
import { registerPermissionForwarder } from "./security/permission-forwarder";
import { initTray } from "./local/tray";
import { registerLoggingIPC, writeLog } from "./local/logging";
import { cleanupShortcuts } from "./local/shortcuts";
import { cleanupSystemIPC } from "./ipc/systemIpc";

let mainWindow: BrowserWindow | null = null;
let isAppReady = false;

async function createWindow() {
  await startRuntime();

  // Hide native menu bar
  Menu.setApplicationMenu(null);

  const preloadPath = join(__dirname, "../preload/preload.cjs");
  console.log("[main] preload path:", preloadPath);
  console.log("[main] __dirname:", __dirname);
  console.log("[main] ELECTRON_RENDERER_URL:", process.env.ELECTRON_RENDERER_URL);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: false,
    backgroundColor: "#171716",
    icon: join(__dirname, "../../assets/app-icon.png"),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const win = mainWindow;

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
    // Open DevTools in dev mode
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Initialize local modules after window is ready
  registerDesktopIPC(win);
  registerRuntimeIPC();
  registerSystemIPC(win);
  registerClipboardIPC();
  registerNotificationIPC();
  registerWindows(win);
  registerPermissionForwarder(win);
  registerLoggingIPC();

  // Initialize tray
  initTray(win);

  // Register runtime status IPC
  ipcMain.handle("runtime:status", async () => {
    return getRuntimeStatus();
  });

  ipcMain.handle("runtime:health", async () => {
    return await checkHealth();
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  isAppReady = true;
  writeLog("main", "GeoWork main window created and initialized");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopRuntime();
  cleanupSystemIPC();
  cleanupShortcuts();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  stopRuntime();
  cleanupSystemIPC();
  cleanupShortcuts();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle renderer crash — graceful recovery
app.on("web-contents-created", (_event, webContents) => {
  webContents.on("render-process-gone", (_e, details) => {
    writeLog("error", `Renderer process gone: ${details.reason}`);

    const win = mainWindow;
    if (win && !win.isDestroyed()) {
      win.webContents.reload();
    }
  });
});