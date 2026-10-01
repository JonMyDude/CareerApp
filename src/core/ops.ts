import { IPC } from '@shared/ipc'
import type {
  InterestInput,
  InterestPatch,
  QuestionRequest,
  QuizQuestion,
  SettingsPatch
} from '@shared/types'
import {
  explainEntry,
  generateDaily,
  getDaily,
  removeEntry,
  rerollDaily,
  setEntryDone,
  setEntryNote
} from './daily'
import { DOC_NAMES, docs } from './docs'
import { createInterest, listInterests, removeInterest, updateInterest } from './interests'
import { exportMarkdown } from './markdown'
import { generateQuestions, markQuestionsSeen } from './questions'
import { getMistakes, getQuizStats, recordAnswer } from './quizHistory'
import { getSettingsInfo, updateSettings, writeApiKey } from './settings'
import { getUsage } from './usage'

/**
 * Every operation a client may ask for, by channel name. Each is a narrow,
 * named operation — no client can read an arbitrary document or run code.
 * Arguments arrive as JSON, so every function validates what it takes.
 */
type Op = (...args: never[]) => Promise<unknown>

const OPS: Record<string, Op> = {
  [IPC.interestsList]: () => listInterests(),
  [IPC.interestsCreate]: (input: InterestInput) => createInterest(input),
  [IPC.interestsUpdate]: (id: string, patch: InterestPatch) => updateInterest(id, patch),
  [IPC.interestsRemove]: (id: string) => removeInterest(id),

  [IPC.dailyGet]: () => getDaily(),
  [IPC.dailyGenerate]: () => generateDaily(),
  [IPC.dailyReroll]: () => rerollDaily(),
  [IPC.dailySetDone]: (id: string, done: boolean) => setEntryDone(id, done === true),
  [IPC.dailyRemove]: (id: string) => removeEntry(id),
  [IPC.dailyExplain]: (id: string, force: boolean) => explainEntry(id, force === true),
  [IPC.dailySetNote]: (id: string, note: string) => setEntryNote(id, note),

  [IPC.questionsGenerate]: (request: QuestionRequest) => generateQuestions(request),
  [IPC.questionsMarkSeen]: (predmet: string, questions: QuizQuestion[]) =>
    markQuestionsSeen(predmet, Array.isArray(questions) ? questions : []),
  // Arguments are validated inside quizHistory; malformed ones are refused.
  [IPC.questionsRecordAnswer]: (meta: unknown, question: unknown, chosen: unknown) =>
    recordAnswer(meta, question, chosen),
  [IPC.questionsStats]: () => getQuizStats(),
  [IPC.questionsMistakes]: (filter: unknown, limit: unknown) => getMistakes(filter, limit),

  [IPC.usageGet]: () => getUsage(),

  // Reports only WHETHER a key exists — the key itself never leaves the cloud.
  [IPC.settingsGet]: () => getSettingsInfo(),
  [IPC.settingsSetApiKey]: (key: string) => writeApiKey(key),
  [IPC.settingsUpdate]: async (patch: SettingsPatch) => {
    await updateSettings(patch)
    return getSettingsInfo()
  },

  [IPC.exportMarkdown]: () => exportMarkdown(),
  [IPC.dataStatus]: () => dataStatus(),
  [IPC.dataImport]: (files: unknown) => importData(files)
}

export async function runOp(channel: string, args: unknown[]): Promise<unknown> {
  const op = OPS[channel]
  if (!op) throw new Error(`Unknown operation: ${channel}`)
  return (op as (...args: unknown[]) => Promise<unknown>)(...(Array.isArray(args) ? args : []))
}

/** The documents that make up "your data" — settings alone don't count. */
const DATA_DOCS = DOC_NAMES.filter((name) => name !== 'settings')

async function dataStatus(): Promise<{ hasData: boolean }> {
  const present = await Promise.all(DATA_DOCS.map((name) => docs().read(name)))
  return { hasData: present.some((doc) => doc !== null) }
}

/**
 * The one-time upload of a desktop's JSON files. Refused once the cloud holds
 * any data, so it can never overwrite what is already there. Settings are
 * merged: a key or model already saved in the cloud wins.
 */
async function importData(files: unknown): Promise<{ imported: string[] }> {
  if (!files || typeof files !== 'object') throw new Error('Nothing to import.')
  if ((await dataStatus()).hasData) {
    throw new Error('The cloud already has data, so nothing was uploaded.')
  }

  const source = files as Record<string, unknown>
  const imported: string[] = []
  for (const name of DOC_NAMES) {
    const doc = source[name]
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) continue
    if (name === 'settings') {
      const current = ((await docs().read('settings')) ?? {}) as Record<string, unknown>
      const merged = { ...current }
      for (const key of ['geminiApiKey', 'model', 'dailyTokenBudget']) {
        const value = (doc as Record<string, unknown>)[key]
        if (merged[key] === undefined && value !== undefined) merged[key] = value
      }
      await docs().write('settings', merged)
    } else {
      await docs().write(name, doc)
    }
    imported.push(name)
  }
  return { imported }
}
