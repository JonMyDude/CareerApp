import { todayKey } from './date'
import type { DailyEntry } from './types'

/**
 * Progress over the daily suggestions: streaks, done rates, recent activity.
 * Pure, and computed from entries the renderer already has — no IPC, no tokens.
 *
 * A streak counts days on which something was *ticked off* (doneAt), not the
 * days suggestions were made: finishing Tuesday's suggestion on Wednesday is
 * Wednesday's work.
 */

export interface InterestProgress {
  /** The interest's id, or its title for entries saved before ids were. */
  key: string
  title: string
  done: number
  total: number
  /** Local day of its newest suggestion. */
  lastDate: string
}

export interface Progress {
  /** Days in a row with a completion, ending today — or yesterday, if today has none yet. */
  currentStreak: number
  /** Whether today already counts. If not, the streak is alive but needs today. */
  doneToday: boolean
  longestStreak: number
  done: number
  total: number
  /** Most suggestions first. */
  byInterest: InterestProgress[]
  /** The interest with the most unfinished suggestions (at least 2), or null. */
  mostSkipped: InterestProgress | null
  /** Completions per local day, oldest first, ending today. */
  lastDays: { date: string; count: number }[]
}

/** A local calendar day `delta` days from `key`. Month ends and DST are handled by Date. */
export function shiftDay(key: string, delta: number): string {
  const [year, month, day] = key.split('-').map(Number)
  return todayKey(new Date(year, month - 1, day + delta))
}

export function computeProgress(entries: DailyEntry[], now = new Date(), windowDays = 30): Progress {
  const counted = entries.filter((entry) => entry.suggestion)
  const today = todayKey(now)

  const perDay = new Map<string, number>()
  for (const entry of counted) {
    if (!entry.done || !entry.doneAt) continue
    const day = todayKey(new Date(entry.doneAt))
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }

  const doneToday = perDay.has(today)
  let currentStreak = 0
  for (let day = doneToday ? today : shiftDay(today, -1); perDay.has(day); day = shiftDay(day, -1)) {
    currentStreak++
  }

  let longestStreak = 0
  let run = 0
  let previous: string | null = null
  for (const day of [...perDay.keys()].sort()) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    previous = day
  }

  // Grouped by interest id, so renaming an interest doesn't split its history.
  // Entries arrive newest first, so the first title and date seen are the current ones.
  const groups = new Map<string, InterestProgress>()
  for (const entry of counted) {
    const key = entry.interestId || entry.interestTitle
    const group = groups.get(key) ?? {
      key,
      title: entry.interestTitle,
      done: 0,
      total: 0,
      lastDate: entry.date
    }
    group.total++
    if (entry.done) group.done++
    groups.set(key, group)
  }
  const byInterest = [...groups.values()].sort(
    (a, b) => b.total - a.total || a.title.localeCompare(b.title)
  )
  const open = (group: InterestProgress): number => group.total - group.done
  const mostSkipped =
    byInterest
      .filter((group) => open(group) >= 2)
      .sort((a, b) => open(b) - open(a) || a.done / a.total - b.done / b.total)[0] ?? null

  const lastDays = Array.from({ length: windowDays }, (_, index) => {
    const date = shiftDay(today, index - windowDays + 1)
    return { date, count: perDay.get(date) ?? 0 }
  })

  return {
    currentStreak,
    doneToday,
    longestStreak,
    done: counted.filter((entry) => entry.done).length,
    total: counted.length,
    byInterest,
    mostSkipped,
    lastDays
  }
}
