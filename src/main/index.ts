import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import type { FrameColors } from '@shared/types'
import { attachWindow, refreshBackground, showMainWindow, startsHidden } from './background'
import { registerIpcHandlers } from './ipc'
import { startReminders } from './reminder'
import { loadWindowTheme, TITLE_BAR_HEIGHT } from './windowTheme'

const isDev = !app.isPackaged

function createWindow(theme: FrameColors): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    // Windows wants a real .ico for the window/taskbar icon — a PNG is accepted
    // by Electron but does not reliably reach the taskbar button. Packaged
    // builds get it from the .exe that electron-builder stamps.
    ...(isDev ? { icon: join(__dirname, '../../build/icon.ico') } : {}),
    // No native title bar: its icon and "Career App" text go, and Electron
    // draws just the three caption buttons over the top-right of the page, in
    // the app's theme colours. The in-app header is the drag handle.
    // See windowTheme.ts.
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: theme.background,
      symbolColor: theme.symbols,
      height: TITLE_BAR_HEIGHT
    },
    // The last theme's --app-bg, so the window doesn't flash light before paint.
    backgroundColor: theme.appBg,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The three settings that keep the renderer sandboxed from Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Close-to-tray and "Open" from the tray, notifications and second launches.
  attachWindow(window)
  // A Start-with-Windows launch waits in the tray instead of popping up.
  window.once('ready-to-show', () => {
    if (!startsHidden()) window.show()
  })

  // The app is local-only: any external link opens in the real browser instead.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = isDev ? process.env.ELECTRON_RENDERER_URL : undefined

  /**
   * In dev the window can open a moment before the Vite server is accepting
   * connections. Electron does not retry a failed load, and the result is a
   * silent blank window — so retry a few times before giving up.
   */
  const load = (attempt = 0): void => {
    if (!devUrl) {
      void window.loadFile(join(__dirname, '../renderer/index.html'))
      return
    }
    window.loadURL(devUrl).catch((error) => {
      if (attempt >= 10) {
        console.error(`[main] renderer failed to load from ${devUrl}:`, error)
        return
      }
      setTimeout(() => load(attempt + 1), 300)
    })
  }

  // Covers the case where the load starts but the server drops it mid-flight.
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // -3 is ERR_ABORTED, which a normal in-app navigation also produces.
    if (errorCode === -3) return
    console.error(`[main] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`)
    if (devUrl) setTimeout(() => load(), 300)
  })

  load()
}

// One instance only — two windows writing the same JSON file would fight.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Launching again brings the running window back, even from the tray.
  app.on('second-instance', () => showMainWindow())

  void app.whenReady().then(async () => {
    // Must match electron-builder's appId. Windows groups taskbar buttons by
    // this; without it a dev run is treated as electron.exe and shows its icon,
    // and notifications have no app to belong to.
    if (process.platform === 'win32') app.setAppUserModelId('com.jon.careerapp')

    registerIpcHandlers()
    // Before the window: whether to start hidden depends on the tray setting.
    await refreshBackground()
    createWindow(await loadWindowTheme())
    startReminders()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void loadWindowTheme().then(createWindow)
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
