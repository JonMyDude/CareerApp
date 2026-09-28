import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { todayKey } from '@shared/date'
import type { UsageSummary } from '@shared/types'
import { readConfig } from './config'

/**
 * Token accounting for the Gemini calls this app makes.
 *
 * Every response carries a `usageMetadata` block; this records it per calendar
 * day so the rail can show what today cost. Counts are what Google billed us
 * for, not an estimate.
 */

export type UsageFeature = 'daily' | 'quiz' | 'explain'

interface FeatureTotals {
  requests: number
  prompt: number
  output: number
  thoughts: number
  total: number
}

interface DayTotals extends FeatureTotals {
  features: Partial<Record<UsageFeature, FeatureTotals>>
}

interface UsageFile {
  version: 1
  days: Record<string, DayTotals>
}

/** Plenty of history for a usage meter without letting the file grow forever. */
const DAY_LIMIT = 60

/** Serialises writes so two calls finishing together can't lose one. */
let writeQueue: Promise<unknown> = Promise.resolve()

function filePath(): string {
  return join(app.getPath('userData'), 'usage.json')
}

const emptyTotals = (): FeatureTotals => ({
  requests: 0,
  prompt: 0,
  output: 0,
  thoughts: 0,
  total: 0
})

async function read(): Promise<UsageFile> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath(), 'utf-8')) as Partial<UsageFile>
    return { version: 1, days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {} }
  } catch {
    return { version: 1, days: {} }
  }
}

async function write(data: UsageFile): Promise<void> {
  // Trim to the newest DAY_LIMIT days.
  const keys = Object.keys(data.days).sort()
  for (const stale of keys.slice(0, Math.max(0, keys.length - DAY_LIMIT))) delete data.days[stale]

  const target = filePath()
  const tmp = `${target}.tmp`
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmp, target)
}

export interface UsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  thoughtsTokenCount?: number
  totalTokenCount?: number
}

function add(into: FeatureTotals, meta: UsageMetadata): void {
  into.requests += 1
  into.prompt += meta.promptTokenCount ?? 0
  into.output += meta.candidatesTokenCount ?? 0
  into.thoughts += meta.thoughtsTokenCount ?? 0
  // Google's total already includes thinking tokens, so trust it when present.
  into.total +=
    meta.totalTokenCount ??
    (meta.promptTokenCount ?? 0) + (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0)
}

/**
 * Record one call. Never throws — a failure to write the meter must not break
 * the feature the user was actually using.
 */
export function recordUsage(feature: UsageFeature, meta: UsageMetadata): Promise<void> {
  const next = writeQueue.then(async () => {
    const data = await read()
    const key = todayKey()
    const day = data.days[key] ?? { ...emptyTotals(), features: {} }
    const perFeature = day.features[feature] ?? emptyTotals()

    add(day, meta)
    add(perFeature, meta)
    day.features[feature] = perFeature
    data.days[key] = day

    await write(data)
  })

  writeQueue = next.catch(() => {})
  return next.catch((error) => {
    console.error('[usage] could not record:', error)
  })
}

export async function getUsage(): Promise<UsageSummary> {
  const [data, config] = await Promise.all([read(), readConfig()])
  const key = todayKey()
  const day = data.days[key] ?? { ...emptyTotals(), features: {} }

  return {
    date: key,
    requests: day.requests,
    promptTokens: day.prompt,
    outputTokens: day.output,
    thoughtTokens: day.thoughts,
    totalTokens: day.total,
    byFeature: {
      daily: day.features.daily?.total ?? 0,
      quiz: day.features.quiz?.total ?? 0,
      explain: day.features.explain?.total ?? 0
    },
    // Google exposes no per-key quota endpoint, so a "% used" bar is only
    // meaningful against a budget the user sets themselves, in Settings.
    budget: config.dailyTokenBudget ?? null
  }
}
