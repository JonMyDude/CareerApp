import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { todayKey } from '@shared/date'
import { drawFromBag, emptyBag, type ShuffleBag } from '@shared/shuffleBag'
import { MAX_REFLECTION_LENGTH, type DailyEntry, type DailyView, type Explanation } from '@shared/types'
import { generateDailySuggestion, generateExplanation, type PriorSuggestion } from './ai'
import { readConfig } from './config'
import { listInterests } from './store'

/**
 * Every suggestion ever generated, newest first.
 *
 * A day can hold more than one entry: rerolling keeps the suggestion you
 * skipped and adds a new one above it, so nothing is thrown away. The newest
 * entry for today is what the tab features; everything else is history.
 *
 * The pick is persisted BEFORE the AI call, so a failed or offline call is
 * retried against the same topic instead of burning a draw.
 *
 * ## Writes go through `mutate`, and never span an AI call
 *
 * An AI call takes seconds, and the user keeps using the list meanwhile. The
 * old shape — read, await the model, write the in-memory copy back — silently
 * undid anything that happened during the wait: tick a history row while a
 * reroll was generating and the reroll's final write un-ticked it.
 *
 * So each AI-backed operation is split in two: decide and persist under the
 * lock, call the model with no lock held, then commit in a second `mutate` that
 * re-reads the file and applies only its own change.
 */

interface DailyFile {
  version: 6
  bag: ShuffleBag
  /** Newest first, ordered by createdAt. */
  entries: DailyEntry[]
}

/**
 * v1: single `today`. v2: one entry per date. v3: added id/createdAt.
 * v4: added done. v5: added explanation. v6: added note and doneAt.
 */
interface LegacyFile {
  version?: number
  bag?: ShuffleBag
  today?: Partial<DailyEntry> | null
  entries?: Partial<DailyEntry>[]
}

function filePath(): string {
  return join(app.getPath('userData'), 'daily.json')
}

/** A cached explanation, if it has the shape we wrote; otherwise treated as absent. */
function normaliseExplanation(raw: unknown): Explanation | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>

  const steps = (Array.isArray(candidate.steps) ? candidate.steps : []).filter(
    (step): step is string => typeof step === 'string' && step.trim().length > 0
  )
  const concepts = (Array.isArray(candidate.concepts) ? candidate.concepts : [])
    .filter((item): item is { term: string; definition: string } => {
      const value = item as Record<string, unknown> | null
      return typeof value?.term === 'string' && typeof value?.definition === 'string'
    })
    .map(({ term, definition }) => ({ term, definition }))

  if (steps.length === 0) return null
  return {
    steps,
    concepts,
    generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : ''
  }
}

/** Fills in fields for entries written by older versions. */
function normalise(raw: Partial<DailyEntry>): DailyEntry | null {
  if (typeof raw?.date !== 'string' || typeof raw?.interestTitle !== 'string') return null

  const createdAt =
    typeof raw.createdAt === 'string'
      ? raw.createdAt
      : typeof raw.generatedAt === 'string'
        ? raw.generatedAt
        : `${raw.date}T00:00:00.000Z`

  return {
    // Derived, not random: normalise() runs on every read, and a fresh uuid each
    // time would give one entry a different identity on every call — breaking
    // "is this the same entry?" comparisons until the first write persisted it.
    id: typeof raw.id === 'string' ? raw.id : `legacy-${raw.date}-${raw.generatedAt ?? 'pending'}`,
    date: raw.date,
    interestId: typeof raw.interestId === 'string' ? raw.interestId : '',
    interestTitle: raw.interestTitle,
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : null,
    done: raw.done === true,
    // Entries ticked before v6 never recorded when; the day they were generated
    // is the best guess, and keeps an old streak roughly where it was.
    doneAt:
      raw.done === true
        ? typeof raw.doneAt === 'string'
          ? raw.doneAt
          : (raw.generatedAt ?? createdAt)
        : null,
    note: typeof raw.note === 'string' ? raw.note.slice(0, MAX_REFLECTION_LENGTH) : '',
    explanation: normaliseExplanation(raw.explanation),
    createdAt,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null
  }
}

function sortNewestFirst(entries: DailyEntry[]): DailyEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function read(): Promise<DailyFile> {
  let parsed: LegacyFile | null = null
  try {
    parsed = JSON.parse(await fs.readFile(filePath(), 'utf-8'))
  } catch {
    return { version: 6, bag: emptyBag(), entries: [] }
  }
  if (!parsed) return { version: 6, bag: emptyBag(), entries: [] }

  const bag = Array.isArray(parsed.bag?.drawn) ? { drawn: parsed.bag.drawn } : emptyBag()

  const source = Array.isArray(parsed.entries)
    ? parsed.entries
    : parsed.today
      ? [parsed.today]
      : []

  const entries = source.map(normalise).filter((entry): entry is DailyEntry => entry !== null)

  // De-duplicate on id, not date — a date legitimately holds several entries now.
  const byId = new Map<string, DailyEntry>()
  for (const entry of entries) byId.set(entry.id, entry)

  return { version: 6, bag, entries: sortNewestFirst([...byId.values()]) }
}

async function write(data: DailyFile): Promise<void> {
  const target = filePath()
  const tmp = `${target}.tmp`
  data.entries = sortNewestFirst(data.entries)
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, target)
}

/** Serialises every read-modify-write, so two changes can't interleave and lose one. */
let writeQueue: Promise<unknown> = Promise.resolve()

/**
 * Re-read the file, apply `fn`, write it back — one at a time.
 *
 * `fn` is synchronous on purpose: an AI call inside it would hold the lock for
 * seconds and make every tick wait. If `fn` throws, nothing is written.
 */
function mutate<T>(fn: (data: DailyFile) => T): Promise<T> {
  const next = writeQueue.then(async () => {
    const data = await read()
    const result = fn(data)
    await write(data)
    return result
  })
  // Keep the queue alive even if this operation rejects.
  writeQueue = next.catch(() => {})
  return next
}

/** The newest entry for today, which is the one the tab features. */
function currentEntry(data: DailyFile): DailyEntry | undefined {
  return sortNewestFirst(data.entries).find((entry) => entry.date === todayKey())
}

function toView(data: DailyFile, state: DailyView['state']): DailyView {
  const sorted = sortNewestFirst(data.entries)
  const todays = sorted.filter((entry) => entry.date === todayKey())
  // Feature the newest entry that actually has a suggestion. A reroll whose API
  // call failed leaves a null entry on top; featuring that would blank the card
  // and demote the last good suggestion into history.
  const today = todays.find((entry) => entry.suggestion) ?? todays[0] ?? null
  // Everything else that produced a suggestion — including earlier attempts
  // from today that were rerolled away.
  const history = sorted.filter((entry) => entry.id !== today?.id && entry.suggestion)
  return { state, today, history, drawn: data.bag.drawn }
}

/** The view to hand back after a plain edit (tick, delete, explanation). */
function viewAfterEdit(data: DailyFile): DailyView {
  return toView(data, currentEntry(data)?.suggestion ? 'ready' : 'pending')
}

/** How many earlier suggestions to show the model so it doesn't repeat itself. */
const AVOID_WINDOW = 5

/**
 * What this interest has already been suggested, and whether the user actually
 * did it. Completed ones are something to build on; skipped ones evidently
 * didn't land, so the model should try a different angle.
 */
function priorSuggestions(data: DailyFile, interestId: string): PriorSuggestion[] {
  const seen = new Set<string>()
  const previous: PriorSuggestion[] = []

  for (const entry of sortNewestFirst(data.entries)) {
    if (entry.interestId !== interestId || !entry.suggestion) continue
    if (seen.has(entry.suggestion)) continue
    seen.add(entry.suggestion)
    previous.push({ text: entry.suggestion, done: entry.done, note: entry.note })
    if (previous.length === AVOID_WINDOW) break
  }

  return previous
}

function newEntry(interestId: string, interestTitle: string): DailyEntry {
  return {
    id: randomUUID(),
    date: todayKey(),
    interestId,
    interestTitle,
    suggestion: null,
    done: false,
    doneAt: null,
    note: '',
    explanation: null,
    createdAt: new Date().toISOString(),
    generatedAt: null
  }
}

/** What an AI-backed operation needs once the lock is released. */
interface Drawn {
  id: string
  interestTitle: string
  prior: PriorSuggestion[]
}

/**
 * The second half of generate and reroll: attach the suggestion to the entry
 * it was generated for, as it is on disk *now*. If that entry was deleted while
 * the model was writing, there is nothing to attach it to, and nothing changes.
 */
function commitSuggestion(id: string, suggestion: string): Promise<DailyView> {
  return mutate((data) => {
    const entry = data.entries.find((item) => item.id === id)
    if (entry) {
      entry.suggestion = suggestion
      entry.generatedAt = new Date().toISOString()
    }
    return viewAfterEdit(data)
  })
}

/** Read-only: what do we already have? Never makes a network call. */
export async function getDaily(): Promise<DailyView> {
  const [data, interests, config] = await Promise.all([read(), listInterests(), readConfig()])

  if (currentEntry(data)?.suggestion) return toView(data, 'ready')
  if (interests.length === 0) return toView(data, 'no-interests')
  if (!config.geminiApiKey) return toView(data, 'no-api-key')
  return toView(data, 'pending')
}

/**
 * One generation at a time. The reminder can fire while the Daily tab is
 * loading; without this both would draw the same pick, both would call the
 * model, and the second answer would overwrite the first.
 */
let generating: Promise<DailyView> | null = null

/**
 * Returns today's suggestion, generating it if needed.
 * Safe to call repeatedly — once generated it is cached for the rest of the day,
 * and concurrent calls share the one in flight.
 */
export function generateDaily(): Promise<DailyView> {
  generating ??= generateDailyOnce().finally(() => {
    generating = null
  })
  return generating
}

async function generateDailyOnce(): Promise<DailyView> {
  // Fast path — no lock and no write: today is already generated.
  const snapshot = await read()
  if (currentEntry(snapshot)?.suggestion) return toView(snapshot, 'ready')

  const interests = await listInterests()
  if (interests.length === 0) return toView(snapshot, 'no-interests')

  const { geminiApiKey } = await readConfig()
  if (!geminiApiKey) return toView(snapshot, 'no-api-key')

  // Draw, or reuse today's pick if one is waiting, and persist it before calling
  // out, so a failure retries this same topic.
  const drawn = await mutate<Drawn | null>((data) => {
    let entry = currentEntry(data)
    // Another call finished generating while this one waited for the lock.
    if (entry?.suggestion) return null
    // No pick for today yet, or the picked interest has since been deleted.
    if (!entry || !interests.some((interest) => interest.id === entry?.interestId)) {
      const { pick, bag } = drawFromBag(interests, data.bag, (interest) => interest.importance)
      if (!pick) return null
      data.bag = bag
      entry = newEntry(pick.id, pick.title)
      data.entries = [entry, ...data.entries]
    }
    return {
      id: entry.id,
      interestTitle: entry.interestTitle,
      prior: priorSuggestions(data, entry.interestId)
    }
  })
  if (!drawn) return getDaily()

  const suggestion = await generateDailySuggestion(drawn.interestTitle, drawn.prior)
  return commitSuggestion(drawn.id, suggestion)
}

/**
 * Draw a different interest and generate an additional suggestion for today.
 *
 * The one you skipped is KEPT — it drops into the feed below rather than being
 * overwritten. The previous pick also stays marked as drawn in the bag, so
 * rerolling moves forward through the cycle instead of re-offering it.
 */
export async function rerollDaily(): Promise<DailyView> {
  const interests = await listInterests()
  if (interests.length === 0) return toView(await read(), 'no-interests')

  const { geminiApiKey } = await readConfig()
  if (!geminiApiKey) return toView(await read(), 'no-api-key')

  const drawn = await mutate<Drawn | null>((data) => {
    // Drop a pick that never produced anything, so failed attempts don't pile up.
    const previous = currentEntry(data)
    if (previous && !previous.suggestion) {
      data.entries = data.entries.filter((item) => item.id !== previous.id)
    }

    const { pick, bag } = drawFromBag(interests, data.bag, (interest) => interest.importance)
    if (!pick) return null

    data.bag = bag
    const entry = newEntry(pick.id, pick.title)
    data.entries = [entry, ...data.entries]
    return {
      id: entry.id,
      interestTitle: entry.interestTitle,
      prior: priorSuggestions(data, entry.interestId)
    }
  })
  if (!drawn) return getDaily()

  const suggestion = await generateDailySuggestion(drawn.interestTitle, drawn.prior)
  return commitSuggestion(drawn.id, suggestion)
}

/**
 * The full walkthrough for one suggestion, generated only because the user
 * asked. Cached on the entry: asking again costs nothing unless `force`.
 */
export async function explainEntry(id: string, force = false): Promise<DailyView> {
  const snapshot = await read()
  const entry = snapshot.entries.find((item) => item.id === id)
  if (!entry?.suggestion) throw new Error('That suggestion was deleted.')

  // Already explained: no network call.
  if (entry.explanation && !force) return viewAfterEdit(snapshot)

  const explanation = await generateExplanation(entry.interestTitle, entry.suggestion)

  return mutate((data) => {
    const target = data.entries.find((item) => item.id === id)
    // Deleted while the explanation was being written. Throwing inside mutate
    // skips the write, so nothing is put back.
    if (!target) throw new Error('That suggestion was deleted.')
    target.explanation = explanation
    return viewAfterEdit(data)
  })
}

/** Tick a suggestion off, or un-tick it. */
export function setEntryDone(id: string, done: boolean): Promise<DailyView> {
  return mutate((data) => {
    const entry = data.entries.find((item) => item.id === id)
    if (!entry) throw new Error('That suggestion no longer exists.')
    entry.done = done
    // Ticking an already-ticked entry keeps the day it was really done.
    entry.doneAt = done ? (entry.doneAt ?? new Date().toISOString()) : null
    return viewAfterEdit(data)
  })
}

/**
 * The user's one-line reflection on a suggestion; '' clears it. Kept to a
 * single short line because it is sent to the model with the suggestion.
 */
export function setEntryNote(id: string, note: string): Promise<DailyView> {
  const clean = (typeof note === 'string' ? note : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REFLECTION_LENGTH)
  return mutate((data) => {
    const entry = data.entries.find((item) => item.id === id)
    if (!entry) throw new Error('That suggestion no longer exists.')
    entry.note = clean
    return viewAfterEdit(data)
  })
}

/** Remove a suggestion from the history for good. */
export function removeEntry(id: string): Promise<DailyView> {
  return mutate((data) => {
    data.entries = data.entries.filter((item) => item.id !== id)
    return viewAfterEdit(data)
  })
}
