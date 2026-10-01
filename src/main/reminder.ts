import { Notification } from 'electron'
import { todayKey } from '@shared/date'
import { IPC } from '@shared/ipc'
import { shouldFire } from '@shared/reminder'
import type { DailyView, TestReminderResult } from '@shared/types'
import { appIconPath, notifyRenderer, showMainWindow } from './background'
import { readConfig } from './config'
import { remote } from './remote'

const getDaily = (): Promise<DailyView> => remote<DailyView>(IPC.dailyGet)
const generateDaily = (): Promise<DailyView> => remote<DailyView>(IPC.dailyGenerate)

/**
 * The daily reminder: a Windows notification at the time set in Settings,
 * showing today's suggestion. When to fire is decided by shouldFire (see
 * shared/reminder.ts); this file only checks the clock and shows it.
 */

const CHECK_MS = 30_000
const BODY_LIMIT = 200

/** When the clock was last checked; starts at launch, so a launch after the time doesn't fire. */
let previous = new Date()
let firedOn: string | null = null
/**
 * Held on purpose: a notification that gets garbage-collected stops delivering
 * its click event, and the click is how the user gets to the suggestion.
 */
let current: Notification | null = null

function shorten(text: string): string {
  return text.length <= BODY_LIMIT ? text : `${text.slice(0, BODY_LIMIT - 1).trimEnd()}…`
}

function contentFor(view: DailyView): { title: string; body: string } {
  const today = view.today?.suggestion ? view.today : null
  return today?.suggestion
    ? { title: `Today: ${today.interestTitle}`, body: shorten(today.suggestion) }
    : { title: 'Your daily suggestion is waiting', body: 'Open Career App to see what to try today.' }
}

/** Resolves true if Windows showed it, false if it refused, null if it never said. */
function show({ title, body }: { title: string; body: string }): Promise<boolean | null> {
  if (!Notification.isSupported()) return Promise.resolve(false)
  return new Promise((resolve) => {
    const notification = new Notification({ title, body, icon: appIconPath() })
    const timeout = setTimeout(() => resolve(null), 5000)
    notification.on('show', () => {
      clearTimeout(timeout)
      resolve(true)
    })
    notification.on('failed', () => {
      clearTimeout(timeout)
      resolve(false)
    })
    notification.on('click', () => showMainWindow('daily'))
    // One reminder at a time: a new one replaces the last in the notification area.
    current?.close()
    current = notification
    notification.show()
  })
}

/**
 * The scheduled reminder. Nothing to remind about once today is ticked off.
 * If today isn't generated yet it is generated now — the same single call
 * opening the app would make, just earlier.
 */
async function fire(): Promise<void> {
  let view = await getDaily()
  if (view.state === 'no-interests' || view.today?.done) return
  if (view.state === 'pending') {
    try {
      view = await generateDaily()
      notifyRenderer(IPC.eventDailyChanged)
    } catch {
      // Offline or a bad key: the generic "waiting" message still gets them here.
    }
  }
  await show(contentFor(view))
}

async function check(): Promise<void> {
  const now = new Date()
  const { reminder } = await readConfig()
  if (reminder.enabled && shouldFire(previous, now, reminder.time, firedOn)) {
    firedOn = todayKey(now)
    void fire().catch((error) => console.error('[reminder] failed:', error))
  }
  previous = now
}

export function startReminders(): void {
  previous = new Date()
  setInterval(() => {
    void check().catch((error) => console.error('[reminder] check failed:', error))
  }, CHECK_MS)
}

/**
 * "Send a test notification": today's reminder as it would look, right now.
 * Never generates, so it never spends tokens.
 */
export async function testReminder(): Promise<TestReminderResult> {
  return { shown: await show(contentFor(await getDaily())) }
}
