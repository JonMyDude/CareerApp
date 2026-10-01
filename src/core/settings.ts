import { createQueue } from '@shared/queue'
import { DEFAULT_REMINDER_TIME } from '@shared/reminder'
import type { SettingsInfo, SettingsPatch } from '@shared/types'
import { docs } from './docs'

/**
 * The settings every device shares: the Gemini key, the model and the token
 * budget. Device settings (reminder, tray, Start with Windows) stay on the
 * desktop, in its local config.json.
 *
 * The key is written here and read only by ai.ts. `getSettingsInfo` reports
 * whether one exists, never the key itself.
 */

export interface SharedSettings {
  geminiApiKey: string
  model: string
  /** Optional daily token ceiling, purely for the usage bar. null = no bar fill. */
  dailyTokenBudget: number | null
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

/** A key set as a Worker secret, used when none has been saved from Settings. */
let fallbackKey = ''

export function setFallbackApiKey(key: string | undefined): void {
  fallbackKey = typeof key === 'string' ? key.trim() : ''
}

async function readRaw(): Promise<Record<string, unknown>> {
  const raw = await docs().read('settings')
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

function validBudget(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BUDGET
}

export async function readSettings(): Promise<SharedSettings> {
  const raw = await readRaw()
  const model = typeof raw.model === 'string' ? raw.model.trim() : ''
  const saved = typeof raw.geminiApiKey === 'string' ? raw.geminiApiKey.trim() : ''
  return {
    geminiApiKey: saved || fallbackKey,
    // A stored name that isn't a plausible model id falls back rather than
    // being put into the URL.
    model: MODEL_PATTERN.test(model) ? model : DEFAULT_MODEL,
    dailyTokenBudget: validBudget(raw.dailyTokenBudget) ? raw.dailyTokenBudget : null
  }
}

function updateRaw(fn: (raw: Record<string, unknown>) => void): Promise<void> {
  return queue(async () => {
    const raw = await readRaw()
    fn(raw)
    await docs().write('settings', raw)
  })
}

export function writeApiKey(key: unknown): Promise<void> {
  const trimmed = typeof key === 'string' ? key.trim() : ''
  if (!trimmed) return Promise.reject(new Error('The API key cannot be empty.'))
  return updateRaw((raw) => {
    raw.geminiApiKey = trimmed
  })
}

/**
 * The shared part of a change from the Settings page. Everything is validated
 * before anything is written, so a bad value rejects with a readable message
 * and nothing is half-saved. Device fields are ignored here.
 */
export async function updateSettings(patch: SettingsPatch): Promise<void> {
  const changes: ((raw: Record<string, unknown>) => void)[] = []

  if (patch?.model !== undefined) {
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

  if (patch?.dailyTokenBudget !== undefined) {
    const budget = patch.dailyTokenBudget
    if (budget !== null && !validBudget(budget)) {
      throw new Error('The budget is a whole number of tokens, from 1 to 100,000,000.')
    }
    changes.push((raw) => {
      if (budget === null) delete raw.dailyTokenBudget
      else raw.dailyTokenBudget = budget
    })
  }

  if (changes.length === 0) return
  await updateRaw((raw) => changes.forEach((change) => change(raw)))
}

/**
 * What a client may know. Reports only WHETHER a key exists — never the key.
 * The device fields are neutral defaults; the desktop replaces them with its own.
 */
export async function getSettingsInfo(): Promise<SettingsInfo> {
  const { geminiApiKey, model, dailyTokenBudget } = await readSettings()
  return {
    hasApiKey: Boolean(geminiApiKey),
    model,
    defaultModel: DEFAULT_MODEL,
    dailyTokenBudget,
    reminder: { enabled: false, time: DEFAULT_REMINDER_TIME },
    closeToTray: false,
    openAtLogin: null
  }
}
