import { todayKey } from '@shared/date'
import type { DailyEntry } from '@shared/types'

/** A stored YYYY-MM-DD as a local date, not UTC, so it can't slip a day. */
export function localDay(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** "26. sep." — for places where the weekday would be noise. */
export function shortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * How a daily entry's date is shown. Several entries can share today's date
 * once you reroll, so those show the time instead — the date alone wouldn't
 * tell them apart.
 */
export function formatEntryDate(entry: DailyEntry): string {
  if (entry.date === todayKey()) {
    const stamp = entry.generatedAt ?? entry.createdAt
    return new Date(stamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return localDay(entry.date).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}
