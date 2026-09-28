import { join } from 'node:path'
import { app, Menu, Tray, type BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { readConfig } from './config'

/**
 * What the app does while it isn't in front: the tray icon, hiding instead of
 * quitting, and starting with Windows. The daily reminder (reminder.ts) can
 * only fire while the app runs, which is what these are for.
 */

const isDev = !app.isPackaged
/** Passed by the Start-with-Windows entry, so a sign-in launch can stay in the tray. */
const HIDDEN_ARG = '--hidden'

let tray: Tray | null = null
let closeToTray = false
let quitting = false
let getWindow: () => BrowserWindow | null = () => null

// Any real quit — tray menu, Alt+F4 with the tray off, Windows shutting down —
// must get past the hide-on-close below.
app.on('before-quit', () => {
  quitting = true
})

/** The .ico: next to the app in packaged builds (extraResources), in build/ in dev. */
export function appIconPath(): string {
  return isDev ? join(__dirname, '../../build/icon.ico') : join(process.resourcesPath, 'icon.ico')
}

/** Send a main → renderer event on one of the fixed IPC event channels. */
export function notifyRenderer(channel: string, ...args: unknown[]): void {
  getWindow()?.webContents.send(channel, ...args)
}

/** Bring the window back — from the tray, a notification or a second launch — optionally on a tab. */
export function showMainWindow(tab?: string): void {
  const window = getWindow()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  if (tab) notifyRenderer(IPC.eventNavigate, tab)
}

function syncTray(): void {
  if (closeToTray && !tray) {
    tray = new Tray(appIconPath())
    tray.setToolTip('Career App')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Career App', click: () => showMainWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
    )
    tray.on('click', () => showMainWindow())
  } else if (!closeToTray && tray) {
    tray.destroy()
    tray = null
    // With the tray gone there'd be no way back to a hidden window.
    const window = getWindow()
    if (window && !window.isVisible()) showMainWindow()
  }
}

/** Re-read the tray setting from config.json — at startup and after every settings change. */
export async function refreshBackground(): Promise<void> {
  closeToTray = (await readConfig()).closeToTray
  syncTray()
}

/** Makes the close button hide to the tray when that's on. Call once, with the main window. */
export function attachWindow(window: BrowserWindow): void {
  getWindow = () => (window.isDestroyed() ? null : window)
  window.on('close', (event) => {
    if (quitting || !closeToTray) return
    event.preventDefault()
    window.hide()
  })
}

/** A Start-with-Windows launch stays in the tray — but only if there is a tray to find it in. */
export function startsHidden(): boolean {
  return process.argv.includes(HIDDEN_ARG) && closeToTray
}

/**
 * The .exe to register. The portable build runs from a temporary copy that
 * changes every launch, so it registers the real file instead.
 */
function loginPath(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

/** null in dev: registering would make Windows start a bare electron.exe at sign-in. */
export function getOpenAtLogin(): boolean | null {
  if (isDev) return null
  return app.getLoginItemSettings({ path: loginPath(), args: [HIDDEN_ARG] }).openAtLogin
}

export function setOpenAtLogin(enabled: boolean): void {
  if (isDev) throw new Error('Start with Windows is only available in the installed app.')
  app.setLoginItemSettings({ openAtLogin: enabled, path: loginPath(), args: [HIDDEN_ARG] })
}
