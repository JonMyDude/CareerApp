import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
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

/**
 * Storage layer: one JSON file in Electron's userData directory.
 * The renderer never touches this — everything goes through IPC.
 */

const FILE_NAME = 'interests.json'
const EMPTY: InterestsFile = { version: 1, interests: [] }

/** Serialises writes so two quick edits can't interleave and lose one. */
let writeQueue: Promise<unknown> = Promise.resolve()

export function dataFilePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

function isInterest(value: unknown): value is Interest {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.title === 'string' && typeof v.notes === 'string'
}

/** Reads the file, tolerating a missing or corrupt one rather than crashing the app. */
async function readFile(): Promise<InterestsFile> {
  let raw: string
  try {
    raw = await fs.readFile(dataFilePath(), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY }
    throw error
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InterestsFile>
    const interests = Array.isArray(parsed?.interests) ? parsed.interests.filter(isInterest) : []
    // Interests from before importance existed start at Medium; the next write saves it.
    for (const interest of interests) {
      if (!isImportance(interest.importance)) interest.importance = DEFAULT_IMPORTANCE
    }
    return { version: 1, interests }
  } catch {
    // Corrupt file: keep a copy so nothing is silently destroyed, then start clean.
    await fs.rename(dataFilePath(), `${dataFilePath()}.corrupt-${Date.now()}`).catch(() => {})
    return { ...EMPTY }
  }
}

/** Write to a temp file and rename, so a crash mid-write can't truncate the real one. */
async function writeFile(data: InterestsFile): Promise<void> {
  const target = dataFilePath()
  const tmp = `${target}.tmp`
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, target)
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
