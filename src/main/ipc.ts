import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  InterestInput,
  InterestPatch,
  QuestionRequest,
  QuizQuestion,
  SettingsPatch
} from '@shared/types'
import { getSettingsInfo, updateSettings, writeApiKey } from './config'
import {
  explainEntry,
  generateDaily,
  getDaily,
  removeEntry,
  rerollDaily,
  setEntryDone,
  setEntryNote
} from './daily'
import { generateQuestions, markQuestionsSeen } from './questions'
import { getMistakes, getQuizStats, recordAnswer } from './quizHistory'
import { getUsage } from './usage'
import {
  createInterest,
  dataFilePath,
  listInterests,
  removeInterest,
  updateInterest
} from './store'
import { getOpenAtLogin, refreshBackground, setOpenAtLogin } from './background'
import { exportHistory, revealLastExport } from './exportHistory'
import { testReminder } from './reminder'
import { applyWindowTheme } from './windowTheme'

/**
 * Every handler is a narrow, named operation — the renderer can never ask the
 * main process to read an arbitrary path or run arbitrary code.
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

export function registerIpcHandlers(): void {
  handle(IPC.interestsList, () => listInterests())
  handle(IPC.interestsCreate, (input: InterestInput) => createInterest(input))
  handle(IPC.interestsUpdate, (id: string, patch: InterestPatch) => updateInterest(id, patch))
  handle(IPC.interestsRemove, (id: string) => removeInterest(id))
  handle(IPC.systemDataPath, () => dataFilePath())

  handle(IPC.dailyGet, () => getDaily())
  handle(IPC.dailyGenerate, () => generateDaily())
  handle(IPC.dailyReroll, () => rerollDaily())
  handle(IPC.dailySetDone, (id: string, done: boolean) => setEntryDone(id, done))
  handle(IPC.dailyRemove, (id: string) => removeEntry(id))
  handle(IPC.dailyExplain, (id: string, force: boolean) => explainEntry(id, force === true))
  handle(IPC.dailySetNote, (id: string, note: string) => setEntryNote(id, note))

  handle(IPC.questionsGenerate, (request: QuestionRequest) => generateQuestions(request))
  handle(IPC.questionsMarkSeen, (predmet: string, questions: QuizQuestion[]) =>
    markQuestionsSeen(predmet, questions)
  )
  // Arguments are validated inside quizHistory; malformed ones are refused.
  handle(IPC.questionsRecordAnswer, (meta: unknown, question: unknown, chosen: unknown) =>
    recordAnswer(meta, question, chosen)
  )
  handle(IPC.questionsStats, () => getQuizStats())
  handle(IPC.questionsMistakes, (filter: unknown, limit: unknown) => getMistakes(filter, limit))

  handle(IPC.usageGet, () => getUsage())

  // Reports only WHETHER a key exists — the key itself never crosses the bridge.
  handle(IPC.settingsGet, () => getSettingsInfo(getOpenAtLogin()))
  handle(IPC.settingsSetApiKey, (key: string) => writeApiKey(key))
  // Hands back the settings as saved, so the page shows what's really on disk.
  handle(IPC.settingsUpdate, async (patch: SettingsPatch) => {
    const { openAtLogin, ...rest } = patch ?? {}
    if (openAtLogin !== undefined && typeof openAtLogin !== 'boolean') {
      throw new Error('Invalid Start with Windows setting.')
    }
    await updateSettings(rest)
    // Start with Windows is a Windows setting, not a line in config.json.
    if (openAtLogin !== undefined) setOpenAtLogin(openAtLogin)
    // The tray appears or goes the moment its setting changes.
    await refreshBackground()
    return getSettingsInfo(getOpenAtLogin())
  })
  handle(IPC.reminderTest, () => testReminder())

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
