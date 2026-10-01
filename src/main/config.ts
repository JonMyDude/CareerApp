import { join } from 'node:path'
import { app } from 'electron'
import { DEFAULT_REMINDER_TIME, TIME_PATTERN } from '@shared/reminder'
import type { CloudConnection, ReminderSettings, SettingsPatch } from '@shared/types'
import { createQueue, readJson, writeJsonAtomic } from './jsonFile'

/**
 * This computer's own settings, in userData/config.json: the reminder, the
 * tray, and where the cloud is with the service token that gets past
 * Cloudflare Access. Everything shared (the Gemini key, model, budget) lives in
 * the cloud — see src/core/settings.ts.
 *
 * The file is meant to stay hand-editable, so writes change only the keys they
 * own and keep anything else in there.
 */

export interface LocalConfig {
  reminder: ReminderSettings
  closeToTray: boolean
  cloud: CloudConnection
  /** Set once this computer's old data files were uploaded. */
  uploadedAt: string | null
}

const queue = createQueue()

export function userDataPath(name: string): string {
  return join(app.getPath('userData'), name)
}

/** The file as an object; missing, unreadable or not-an-object all read as empty. */
export async function readRaw(): Promise<Record<string, unknown>> {
  const raw = await readJson(userDataPath('config.json'))
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

function validReminder(value: unknown): value is ReminderSettings {
  const reminder = value as Partial<ReminderSettings> | null
  return (
    typeof reminder?.enabled === 'boolean' &&
    typeof reminder.time === 'string' &&
    TIME_PATTERN.test(reminder.time)
  )
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export async function readConfig(): Promise<LocalConfig> {
  // Missing or unreadable config is normal on first run.
  const raw = await readRaw()
  return {
    reminder: validReminder(raw.reminder)
      ? { enabled: raw.reminder.enabled, time: raw.reminder.time }
      : { enabled: false, time: DEFAULT_REMINDER_TIME },
    closeToTray: raw.closeToTray === true,
    cloud: {
      url: text(raw.cloudUrl),
      clientId: text(raw.accessClientId),
      clientSecret: text(raw.accessClientSecret)
    },
    uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : null
  }
}

/** Change config.json one write at a time, keeping every key `fn` doesn't touch. */
export function updateRaw(fn: (raw: Record<string, unknown>) => void): Promise<void> {
  return queue(async () => {
    const raw = await readRaw()
    fn(raw)
    await writeJsonAtomic(userDataPath('config.json'), raw)
  })
}

/**
 * The device part of a change from the Settings page. Validated before the
 * file is touched, so a bad value rejects with a readable message.
 */
export async function updateLocalSettings(patch: Pick<SettingsPatch, 'reminder' | 'closeToTray'>): Promise<void> {
  const changes: ((raw: Record<string, unknown>) => void)[] = []

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
 * Where the cloud is. The address must be https (plain http only for a local
 * `wrangler dev`), since the service token travels with every request.
 */
export async function writeCloudConnection(connection: CloudConnection): Promise<void> {
  const url = text(connection?.url).replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Enter the full address, like https://career-app.you.workers.dev.')
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('The address must start with https://.')
  }
  const clientId = text(connection?.clientId)
  const clientSecret = text(connection?.clientSecret)
  await updateRaw((raw) => {
    raw.cloudUrl = parsed.origin
    // An empty field keeps the saved value, so the secret needn't be retyped.
    if (clientId) raw.accessClientId = clientId
    if (clientSecret) raw.accessClientSecret = clientSecret
  })
}
