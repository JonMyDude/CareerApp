import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

export { createQueue } from '@shared/queue'

/**
 * The file pattern every store in main follows, in one place for new files.
 * (daily.ts, questions.ts, usage.ts and store.ts predate this and keep their
 * own copies — they are tested and there is nothing to gain by moving them.)
 */

/** Parsed JSON, or null when the file is missing or unreadable — both normal on first run. */
export async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf-8'))
  } catch {
    return null
  }
}

/** Temp file + rename, so a crash mid-write never leaves half a file behind. */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await fs.mkdir(dirname(path), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, path)
}
