import { useEffect, useState } from 'react'
import type { DailyEntry } from '@shared/types'

/** What the Daily history is narrowed to. Today's card is never filtered. */
export interface HistoryFilterState {
  query: string
  /** An interest key (see interestKey), or '' for all. */
  interest: string
  status: 'all' | 'done' | 'open'
}

export const EMPTY_FILTER: HistoryFilterState = { query: '', interest: '', status: 'all' }

/**
 * Case- and accent-insensitive, so "sumniki" finds "šumniki" and "cafe" finds
 * "café" — the user writes Slovenian and English, often without carons.
 */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Grouped by id so a renamed interest stays one option; legacy rows fall back to the title. */
export function interestKey(entry: DailyEntry): string {
  return entry.interestId || entry.interestTitle
}

/** One option per interest in the history, labelled with its newest title. */
export function interestOptions(entries: DailyEntry[]): { value: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const entry of entries) {
    if (!seen.has(interestKey(entry))) seen.set(interestKey(entry), entry.interestTitle)
  }
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function isFiltering(filter: HistoryFilterState): boolean {
  return filter.query.trim() !== '' || filter.interest !== '' || filter.status !== 'all'
}

export function matchesFilter(entry: DailyEntry, filter: HistoryFilterState): boolean {
  if (filter.status === 'done' && !entry.done) return false
  if (filter.status === 'open' && entry.done) return false
  if (filter.interest && interestKey(entry) !== filter.interest) return false
  const query = fold(filter.query.trim())
  if (!query) return true
  // The note is searched too: it's often the most memorable part.
  return fold(`${entry.suggestion ?? ''} ${entry.interestTitle} ${entry.note}`).includes(query)
}

/** The value, once it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
