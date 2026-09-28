import { join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_REMINDER_TIME, TIME_PATTERN } from '@shared/reminder'
import type { ReminderSettings, SettingsInfo, SettingsPatch } from '@shared/types'
import { createQueue, readJson, writeJsonAtomic } from './jsonFile'

/**
 * Local settings, including the AI API key.
 *
 * Lives in userData, NOT in the repo and NOT in the app bundle, so the key is
 * never committed or shipped. It is read only here in the main process; the
 * renderer is told whether a key exists, never what it is.
 *
 * The file is also meant to be hand-editable, so writes change only the keys
 * they own and keep anything else that is in there.
 */

export interface AppConfig {
  geminiApiKey: string
  model: string
  /** Optional daily token ceiling, purely for the usage bar. null = no bar fill. */
  dailyTokenBudget: number | null
  reminder: ReminderSettings
  closeToTray: boolean
}

/** Fast, no thinking overhead — this is one short suggestion once a day. */
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

/**
 * The model name is interpolated into the request URL in ai.ts, so it is held
 * to the shape real model ids have: no slashes, query strings or spaces.
 */
const MODEL_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/i
const MAX_BUDGET = 100_000_000

const queue = createQueue()

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

/** The file as an object; missing, unreadable or not-an-object all read as empty. */
async function readRaw(): Promise<Record<string, unknown>> {
  const raw = await readJson(configPath())
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}
}

function validBudget(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BUDGET
}

function validReminder(value: unknown): value is ReminderSettings {
  const reminder = value as Partial<ReminderSettings> | null
  return (
    typeof reminder?.enabled === 'boolean' &&
    typeof reminder.time === 'string' &&
    TIME_PATTERN.test(reminder.time)
  )
}

export async function readConfig(): Promise<AppConfig> {
  // Missing or unreadable config is normal on first run.
  const raw = await readRaw()
  const model = typeof raw.model === 'string' ? raw.model.trim() : ''
  return {
    geminiApiKey: typeof raw.geminiApiKey === 'string' ? raw.geminiApiKey.trim() : '',
    // A hand-edited name that isn't a plausible model id falls back rather
    // than being put into the URL.
    model: MODEL_PATTERN.test(model) ? model : DEFAULT_MODEL,
    dailyTokenBudget: validBudget(raw.dailyTokenBudget) ? raw.dailyTokenBudget : null,
    reminder: validReminder(raw.reminder)
      ? { enabled: raw.reminder.enabled, time: raw.reminder.time }
      : { enabled: false, time: DEFAULT_REMINDER_TIME },
    closeToTray: raw.closeToTray === true
  }
}

/** Change config.json one write at a time, keeping every key `fn` doesn't touch. */
function updateRaw(fn: (raw: Record<string, unknown>) => void): Promise<void> {
  return queue(async () => {
    const raw = await readRaw()
    fn(raw)
    await writeJsonAtomic(configPath(), raw)
  })
}

export function writeApiKey(key: string): Promise<void> {
  const trimmed = typeof key === 'string' ? key.trim() : ''
  if (!trimmed) return Promise.reject(new Error('The API key cannot be empty.'))
  return updateRaw((raw) => {
    raw.geminiApiKey = trimmed
  })
}

/**
 * Apply a change from the Settings page. Everything is validated before the
 * file is touched, so a bad value rejects with a readable message and nothing
 * is half-written.
 */
export async function updateSettings(patch: SettingsPatch): Promise<void> {
  const changes: ((raw: Record<string, unknown>) => void)[] = []

  if (patch.model !== undefined) {
    const model = typeof patch.model === 'string' ? patch.model.trim() : ''
    if (model && !MODEL_PATTERN.test(model)) {
      throw new Error('A model name uses letters, digits, dots and dashes, like gemini-3.5-flash-lite.')
    }
    // Empty, or the default spelled out, means "use the default".
    changes.push((raw) => {
      if (model && model !== DEFAULT_MODEL) raw.model = model
      else delete raw.model
    })
  }

  if (patch.dailyTokenBudget !== undefined) {
    const budget = patch.dailyTokenBudget
    if (budget !== null && !validBudget(budget)) {
      throw new Error('The budget is a whole number of tokens, from 1 to 100,000,000.')
    }
    changes.push((raw) => {
      if (budget === null) delete raw.dailyTokenBudget
      else raw.dailyTokenBudget = budget
    })
  }

  if (patch.reminder !== undefined) {
    if (!validReminder(patch.reminder)) throw new Error('Pick a reminder time like 09:00.')
    const { enabled, time } = patch.reminder
    changes.push((raw) => {
      raw.reminder = { enabled, time }
    })
  }

  if (patch.closeToTray !== undefined) {
    if (typeof patch.closeToTray !== 'boolean') throw new Error('Invalid tray setting.')
    const closeToTray = patch.closeToTray
    changes.push((raw) => {
      raw.closeToTray = closeToTray
    })
  }

  if (changes.length === 0) return
  await updateRaw((raw) => changes.forEach((change) => change(raw)))
}

/**
 * What the renderer may know. Reports only WHETHER a key exists — never the key.
 * `openAtLogin` lives in Windows, not in this file, so the caller supplies it.
 */
export async function getSettingsInfo(openAtLogin: boolean | null): Promise<SettingsInfo> {
  const { geminiApiKey, model, dailyTokenBudget, reminder, closeToTray } = await readConfig()
  return {
    hasApiKey: Boolean(geminiApiKey),
    model,
    defaultModel: DEFAULT_MODEL,
    dailyTokenBudget,
    reminder,
    closeToTray,
    openAtLogin
  }
}
