import { randomUUID } from 'node:crypto'
import {
  DEFAULT_IMPORTANCE,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  type Importance,
  type Interest,
  type InterestInput,
  type InterestPatch,
  type InterestsFile
} from '@shared/types'
import { docs } from './docs'

/**
 * The interests list: one document. Clients never touch it directly —
 * everything goes through the named operations in ops.ts.
 */

/** Serialises writes so two quick edits can't interleave and lose one. */
let writeQueue: Promise<unknown> = Promise.resolve()

function isInterest(value: unknown): value is Interest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.title === 'string' && typeof v.notes === 'string'
}

/** Reads the document, tolerating a missing or malformed one rather than failing. */
async function readFile(): Promise<InterestsFile> {
  const parsed = (await docs().read('interests')) as Partial<InterestsFile> | null
  const interests = Array.isArray(parsed?.interests) ? parsed.interests.filter(isInterest) : []
  // Interests from before importance existed start at Medium; the next write saves it.
  for (const interest of interests) {
    if (!isImportance(interest.importance)) interest.importance = DEFAULT_IMPORTANCE
  }
  return { version: 1, interests }
}

function writeFile(data: InterestsFile): Promise<void> {
  return docs().write('interests', data)
}

function mutate<T>(fn: (data: InterestsFile) => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(async () => {
    const data = await readFile()
    const result = await fn(data)
    await writeFile(data)
    return result
  })
  // Keep the queue alive even if this operation rejects.
  writeQueue = next.catch(() => {})
  return next
}

function cleanTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : ''
  if (!title) throw new Error('An interest needs a title.')
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title is too long (max ${MAX_TITLE_LENGTH} characters).`)
  }
  return title
}

function isImportance(value: unknown): value is Importance {
  return value === 1 || value === 2 || value === 3
}

function cleanImportance(value: unknown): Importance {
  if (value === undefined) return DEFAULT_IMPORTANCE
  if (!isImportance(value)) throw new Error('Importance is Low, Medium or High.')
  return value
}

function cleanNotes(value: unknown): string {
  const notes = typeof value === 'string' ? value.trim() : ''
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes are too long (max ${MAX_NOTES_LENGTH} characters).`)
  }
  return notes
}

export async function listInterests(): Promise<Interest[]> {
  const { interests } = await readFile()
  return interests
}

export function createInterest(input: InterestInput): Promise<Interest> {
  return mutate((data) => {
    const now = new Date().toISOString()
    const interest: Interest = {
      id: randomUUID(),
      title: cleanTitle(input?.title),
      notes: cleanNotes(input?.notes),
      importance: cleanImportance(input?.importance),
      createdAt: now,
      updatedAt: now
    }
    data.interests.push(interest)
    return interest
  })
}

export function updateInterest(id: string, patch: InterestPatch): Promise<Interest> {
  return mutate((data) => {
    const interest = data.interests.find((item) => item.id === id)
    if (!interest) throw new Error('That interest no longer exists.')

    if (patch?.title !== undefined) interest.title = cleanTitle(patch.title)
    if (patch?.notes !== undefined) interest.notes = cleanNotes(patch.notes)
    if (patch?.importance !== undefined) interest.importance = cleanImportance(patch.importance)
    interest.updatedAt = new Date().toISOString()
    return interest
  })
}

export function removeInterest(id: string): Promise<void> {
  return mutate((data) => {
    const index = data.interests.findIndex((item) => item.id === id)
    if (index === -1) return
    data.interests.splice(index, 1)
  })
}
