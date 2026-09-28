import { todayKey } from './date'

/**
 * When the daily reminder fires. Pure, so it can be tested without a clock.
 *
 * The rule: fire when today's reminder moment falls between the previous check
 * and this one, at most once per day. That gives the behaviour you'd expect
 * without special cases:
 *   - starting the app after the time doesn't fire — the moment was before the first check
 *   - waking from sleep past the time fires once, late rather than never
 *   - moving the time earlier than now doesn't fire until tomorrow
 */

/** 24-hour "HH:MM". */
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export const DEFAULT_REMINDER_TIME = '09:00'

/** The reminder moment on the local day of `day`. */
export function momentOn(day: Date, time: string): Date | null {
  const match = TIME_PATTERN.exec(time)
  if (!match) return null
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]))
}

export function shouldFire(previous: Date, now: Date, time: string, firedOn: string | null): boolean {
  if (firedOn === todayKey(now)) return false
  const moment = momentOn(now, time)
  return moment !== null && previous < moment && moment <= now
}
