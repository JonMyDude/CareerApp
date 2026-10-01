import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Preferences } from '@capacitor/preferences'
import { Share } from '@capacitor/share'
import { todayKey } from '@shared/date'
import { IPC } from '@shared/ipc'
import { DEFAULT_REMINDER_TIME, TIME_PATTERN } from '@shared/reminder'
import type { CloudConnection, CloudInfo, DailyView, ReminderSettings, SettingsInfo } from '@shared/types'
import type { AppApi } from '../../preload'
import { cloudMethods, exportFileName, makeCall } from './webApi'

/**
 * `window.api` in the Android app. The data calls are the browser's, sent to the
 * cloud's full address with the Cloudflare Access service token, as the
 * desktop's main process does (src/main/remote.ts). What belongs to the phone —
 * the connection, the reminder — lives in the app's private Preferences.
 */

const KEYS = { url: 'cloudUrl', clientId: 'accessClientId', clientSecret: 'accessClientSecret', reminder: 'reminder' }

async function pref(key: string): Promise<string> {
  return (await Preferences.get({ key })).value ?? ''
}

const call = makeCall({
  url: async (channel) => {
    const base = await pref(KEYS.url)
    if (!base) throw new Error('Not connected to the cloud yet. Open Settings → Cloud.')
    return `${base}/api/${encodeURIComponent(channel)}`
  },
  headers: async (): Promise<Record<string, string>> => {
    const [id, secret] = await Promise.all([pref(KEYS.clientId), pref(KEYS.clientSecret)])
    return id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {}
  },
  unreachable: "Couldn't reach the cloud. Check your internet connection."
})

/* ---------- Connection ---------- */

async function cloudInfo(): Promise<CloudInfo> {
  const [url, id, secret] = await Promise.all([pref(KEYS.url), pref(KEYS.clientId), pref(KEYS.clientSecret)])
  // Nothing to upload: the phone never kept data of its own.
  return { url, hasToken: Boolean(id && secret), canUpload: false }
}

/** Save the address and token, then prove they work — as src/main/cloud.ts does. */
async function setConnection(connection: CloudConnection): Promise<CloudInfo> {
  const url = (connection?.url ?? '').trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Enter the full address, like https://career-app.you.workers.dev.')
  }
  if (parsed.protocol !== 'https:') throw new Error('The address must start with https://.')
  await Preferences.set({ key: KEYS.url, value: parsed.origin })
  // An empty field keeps the saved value, so the secret needn't be retyped.
  if (connection.clientId?.trim()) await Preferences.set({ key: KEYS.clientId, value: connection.clientId.trim() })
  if (connection.clientSecret?.trim()) {
    await Preferences.set({ key: KEYS.clientSecret, value: connection.clientSecret.trim() })
  }
  await call<SettingsInfo>(IPC.settingsGet)
  return cloudInfo()
}

/* ---------- Reminder ---------- */

async function readReminder(): Promise<ReminderSettings> {
  try {
    const saved = JSON.parse(await pref(KEYS.reminder)) as Partial<ReminderSettings>
    if (typeof saved.enabled === 'boolean' && typeof saved.time === 'string' && TIME_PATTERN.test(saved.time)) {
      return { enabled: saved.enabled, time: saved.time }
    }
  } catch {
    // Nothing saved yet.
  }
  return { enabled: false, time: DEFAULT_REMINDER_TIME }
}

/** How many days ahead reminders are set; every visit to the app renews them. */
const DAYS_AHEAD = 14
const WAITING = { title: 'Your daily suggestion is waiting', body: 'Open Career App to see what to try today.' }

function textFor(view: DailyView | null): { title: string; body: string } {
  const today = view?.today?.suggestion ? view.today : null
  return today?.suggestion ? { title: `Today: ${today.interestTitle}`, body: today.suggestion } : WAITING
}

/**
 * Android can't ask the cloud at 9:00 what today's suggestion is, so the next
 * two weeks are set in advance: today with the real text when it is known, the
 * rest with the generic one. Ticking today off drops today's.
 */
async function schedule(view: DailyView | null): Promise<void> {
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length > 0) await LocalNotifications.cancel(pending)

  const reminder = await readReminder()
  if (!reminder.enabled) return
  const [hour, minute] = reminder.time.split(':').map(Number)
  const now = new Date()

  const notifications = []
  for (let day = 0; day < DAYS_AHEAD; day++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute)
    if (at <= now) continue
    const isToday = todayKey(at) === todayKey(now)
    if (isToday && view?.today?.done) continue
    notifications.push({
      id: day + 1,
      ...(isToday ? textFor(view) : WAITING),
      schedule: { at, allowWhileIdle: true },
      extra: { tab: 'daily' }
    })
  }
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
}

let lastView: DailyView | null = null

/** Every fresh view of today renews the reminders, so they carry today's text. */
async function withReminders(view: Promise<DailyView>): Promise<DailyView> {
  const result = await view
  lastView = result
  void schedule(result).catch(() => {})
  return result
}

async function allowNotifications(): Promise<boolean> {
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

/* ---------- The API ---------- */

const data = cloudMethods(call)

export const androidApi: AppApi = {
  platform: 'android',
  ...data,
  daily: {
    ...data.daily,
    get: () => withReminders(data.daily.get()),
    generate: () => withReminders(data.daily.generate()),
    reroll: () => withReminders(data.daily.reroll()),
    setDone: (id, done) => withReminders(data.daily.setDone(id, done))
  },
  settings: {
    ...data.settings,
    // The cloud's shared settings with this phone's reminder on top.
    get: async () => ({ ...(await data.settings.get()), reminder: await readReminder() }),
    update: async (patch) => {
      const { reminder, closeToTray: _tray, openAtLogin: _login, ...shared } = patch ?? {}
      void _tray
      void _login
      if (reminder !== undefined) {
        if (typeof reminder?.enabled !== 'boolean' || !TIME_PATTERN.test(reminder.time ?? '')) {
          throw new Error('Pick a reminder time like 09:00.')
        }
        if (reminder.enabled && !(await allowNotifications())) {
          throw new Error('Notifications are off for Career App. Allow them in Android settings.')
        }
        await Preferences.set({ key: KEYS.reminder, value: JSON.stringify(reminder) })
        await schedule(lastView)
      }
      const info = Object.keys(shared).length > 0 ? await data.settings.update(shared) : await data.settings.get()
      return { ...info, reminder: await readReminder() }
    }
  },
  cloud: {
    get: cloudInfo,
    set: setConnection,
    upload: async () => {
      throw new Error('Only the desktop app has old files to upload.')
    }
  },
  frame: { setTheme: async () => {} },
  export: {
    // Written to the app's cache, then handed to the share sheet: Drive, Files, mail…
    history: async () => {
      const fileName = exportFileName()
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: await call<string>(IPC.exportMarkdown),
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      })
      await Share.share({ title: 'Career App history', files: [uri] })
      return { saved: true, fileName }
    },
    reveal: async () => {}
  },
  reminder: {
    // Today's reminder as it would look, right now. Never generates.
    test: async () => {
      if (!(await allowNotifications())) return { shown: false }
      const view = lastView ?? (await data.daily.get())
      await LocalNotifications.schedule({
        notifications: [{ id: 999, ...textFor(view), schedule: { at: new Date(Date.now() + 1000) }, extra: { tab: 'daily' } }]
      })
      return { shown: true }
    }
  },
  on: {
    dailyChanged: () => () => {},
    // A tap on a reminder opens the Daily tab.
    navigate: (callback) => {
      const handle = LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const tab = (action.notification.extra as { tab?: unknown } | undefined)?.tab
        if (typeof tab === 'string') callback(tab)
      })
      return () => void handle.then((listener) => listener.remove())
    }
  }
}
