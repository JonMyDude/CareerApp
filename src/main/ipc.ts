import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { CloudConnection, SettingsInfo, SettingsPatch } from '@shared/types'
import { getOpenAtLogin, refreshBackground, setOpenAtLogin } from './background'
import { getCloudInfo, setCloudConnection, uploadLocalData } from './cloud'
import { readConfig, updateLocalSettings } from './config'
import { exportHistory, revealLastExport } from './exportFile'
import { remote } from './remote'
import { testReminder } from './reminder'
import { applyWindowTheme } from './windowTheme'

/**
 * Every handler is a narrow, named operation — the renderer can never ask the
 * main process to read an arbitrary path or run arbitrary code.
 *
 * The data lives in the cloud, so most channels are passed straight on to it
 * (src/core/ops.ts has the same names). What stays here is what belongs to this
 * computer: the window, the tray, the reminder, the save dialog.
 *
 * Errors thrown here cross the bridge as a rejected promise; we re-throw a
 * clean message so the UI shows something readable instead of a stack trace.
 */
function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...(args as TArgs))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      console.error(`[ipc] ${channel} failed:`, error)
      throw new Error(message)
    }
  })
}

/** Channels whose whole job happens in the cloud. */
const CLOUD_CHANNELS = [
  IPC.interestsList,
  IPC.interestsCreate,
  IPC.interestsUpdate,
  IPC.interestsRemove,
  IPC.dailyGet,
  IPC.dailyGenerate,
  IPC.dailyReroll,
  IPC.dailySetDone,
  IPC.dailyRemove,
  IPC.dailyExplain,
  IPC.dailySetNote,
  IPC.questionsGenerate,
  IPC.questionsMarkSeen,
  IPC.questionsRecordAnswer,
  IPC.questionsStats,
  IPC.questionsMistakes,
  IPC.usageGet,
  // Write-only: the key goes to the cloud and nothing ever reads it back.
  IPC.settingsSetApiKey
]

/** The cloud's shared settings with this computer's own on top. */
async function settingsInfo(): Promise<SettingsInfo> {
  const [shared, local] = await Promise.all([remote<SettingsInfo>(IPC.settingsGet), readConfig()])
  return { ...shared, reminder: local.reminder, closeToTray: local.closeToTray, openAtLogin: getOpenAtLogin() }
}

export function registerIpcHandlers(): void {
  for (const channel of CLOUD_CHANNELS) {
    handle(channel, (...args: unknown[]) => remote(channel, ...args))
  }

  // Reports only WHETHER a key exists — the key itself never crosses the bridge.
  handle(IPC.settingsGet, () => settingsInfo())
  // Hands back the settings as saved, so the page shows what's really stored.
  handle(IPC.settingsUpdate, async (patch: SettingsPatch) => {
    const { openAtLogin, reminder, closeToTray, ...shared } = patch ?? {}
    if (openAtLogin !== undefined && typeof openAtLogin !== 'boolean') {
      throw new Error('Invalid Start with Windows setting.')
    }
    if (Object.keys(shared).length > 0) await remote(IPC.settingsUpdate, shared)
    await updateLocalSettings({ reminder, closeToTray })
    // Start with Windows is a Windows setting, not a line in config.json.
    if (openAtLogin !== undefined) setOpenAtLogin(openAtLogin)
    // The tray appears or goes the moment its setting changes.
    await refreshBackground()
    return settingsInfo()
  })
  handle(IPC.reminderTest, () => testReminder())

  handle(IPC.cloudGet, () => getCloudInfo())
  handle(IPC.cloudSet, (connection: CloudConnection) => setCloudConnection(connection))
  handle(IPC.cloudUpload, () => uploadLocalData())

  // Needs the sender to find its window, so it skips the generic helper. The
  // colours are validated in applyWindowTheme; a bad set is simply ignored.
  ipcMain.handle(IPC.frameSetTheme, async (event, colors: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) await applyWindowTheme(window, colors)
  })

  // Also needs the sender: the save dialog is modal to its window. Errors go
  // through the same clean-message path as the generic helper.
  ipcMain.handle(IPC.exportHistory, async (event) => {
    try {
      return await exportHistory(BrowserWindow.fromWebContents(event.sender))
    } catch (error) {
      console.error(`[ipc] ${IPC.exportHistory} failed:`, error)
      throw new Error(error instanceof Error ? error.message : 'The export failed.')
    }
  })
  handle(IPC.exportReveal, () => revealLastExport())
}
