import { createHash, randomInt, randomUUID } from 'node:crypto'
import { MAX_QUESTIONS, MIN_QUESTIONS } from '@shared/curriculum'
import type { QuestionRequest, QuizQuestion } from '@shared/types'
import { generateQuizQuestions, type RawQuizQuestion } from './ai'
import { docs } from './docs'

/**
 * Question generator: prompt, validate, remember.
 *
 * The spec is written client/server; here the "server" half is the cloud. Its `seen_topics` table carries a `user_id` — dropped, because this
 * app is single-user and local, so every row would hold the same value.
 *
 * Two things are remembered per subject:
 *   - `topics`  feeds `izogni_se`, so the model spreads across the syllabus
 *   - `hashes`  of questions already shown, so a repeat is caught even when the
 *               model ignores izogni_se and rewords an old question
 */

interface SeenTopic {
  predmet: string
  tema: string
  createdAt: string
}

interface SeenQuestion {
  predmet: string
  hash: string
  createdAt: string
}

interface QuestionsFile {
  version: 1
  topics: SeenTopic[]
  hashes: SeenQuestion[]
}

/** Spec: "Server prebere zadnjih 30 vrstic iz seen_topics". */
const TOPIC_WINDOW = 30
/** Keep the dedup memory bounded; far more than a user will ever cycle through. */
const HASH_LIMIT = 2000
/** Spec: re-call for the shortfall. Bounded so a bad subject can't spin forever. */
const MAX_ATTEMPTS = 3

/**
 * Hashes handed to the renderer this run but not yet confirmed as shown.
 *
 * Generation no longer writes to disk, because a prefetched batch the user
 * never reaches would otherwise burn those questions forever. This in-memory
 * set still stops a prefetch from duplicating the batch on screen, and is
 * dropped on restart so unseen questions can come back.
 */
const issuedHashes = new Set<string>()

/** Serialises the read-modify-write in markQuestionsSeen. */
let writeQueue: Promise<unknown> = Promise.resolve()

async function read(): Promise<QuestionsFile> {
  const parsed = (await docs().read('questions')) as Partial<QuestionsFile> | null
  return {
    version: 1,
    topics: Array.isArray(parsed?.topics) ? parsed.topics : [],
    hashes: Array.isArray(parsed?.hashes) ? parsed.hashes : []
  }
}

function write(data: QuestionsFile): Promise<void> {
  return docs().write('questions', data)
}

/**
 * Spec: "hash normaliziranega vprašanja (lowercase, brez ločil, brez šumnikov)".
 * Stripping the carons means "Kdo je napisal Krst pri Savici?" and a version
 * typed without diacritics collapse to the same hash.
 */
export function normaliseQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')
    // Strip any remaining diacritics, then everything that isn't alphanumeric.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function hashQuestion(text: string): string {
  return createHash('sha256').update(normaliseQuestion(text)).digest('hex').slice(0, 32)
}

/**
 * Every condition from the spec's Validacija section. An element failing any of
 * them is discarded silently — the user is never shown a validation error.
 */
function validate(raw: RawQuizQuestion, seenHashes: Set<string>): QuizQuestion | null {
  const vprasanje = typeof raw.vprasanje === 'string' ? raw.vprasanje.trim() : ''
  const razlaga = typeof raw.razlaga === 'string' ? raw.razlaga.trim() : ''
  const tema = typeof raw.tema === 'string' ? raw.tema.trim() : ''
  const odgovori = Array.isArray(raw.odgovori) ? raw.odgovori : []
  const pravilen = raw.pravilen

  if (!vprasanje || !razlaga) return null
  if (odgovori.length !== 4) return null
  if (
    !odgovori.every(
      (answer): answer is string => typeof answer === 'string' && answer.trim().length > 0
    )
  ) {
    return null
  }
  if (!Number.isInteger(pravilen) || (pravilen as number) < 0 || (pravilen as number) > 3) {
    return null
  }

  // All four answers distinct, compared lowercase and trimmed.
  const normalised = odgovori.map((answer) => answer.trim().toLowerCase())
  if (new Set(normalised).size !== 4) return null

  if (seenHashes.has(hashQuestion(vprasanje))) return null

  return {
    id: randomUUID(),
    vprasanje,
    odgovori: odgovori.map((answer) => answer.trim()),
    pravilen: pravilen as number,
    razlaga,
    tema: tema || 'Splošno'
  }
}

/**
 * Shuffle the four answers and follow the correct one to its new index.
 *
 * The model puts the right answer first almost every time — measured at 29 of
 * 30 — which makes the quiz trivially gameable by always picking A. The spec
 * doesn't cover this (its own example has "pravilen":0), so we fix it here
 * rather than hoping a prompt tweak sticks.
 */
export function shuffleAnswers<T extends QuizQuestion>(question: T): T {
  const correct = question.odgovori[question.pravilen]
  const odgovori = [...question.odgovori]

  for (let i = odgovori.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[odgovori[i], odgovori[j]] = [odgovori[j], odgovori[i]]
  }

  return { ...question, odgovori, pravilen: odgovori.indexOf(correct) }
}

function clampRequest(request: QuestionRequest): QuestionRequest {
  const stevilo = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Math.round(request.stevilo)))
  const tezavnost = Math.max(1, Math.min(3, Math.round(request.tezavnost)))
  return { ...request, stevilo, tezavnost }
}

/**
 * Generate a batch. Validates, discards silently, and re-calls for the
 * shortfall — the user only ever sees questions that passed every check.
 */
export async function generateQuestions(input: QuestionRequest): Promise<QuizQuestion[]> {
  const request = clampRequest(input)
  if (!request.predmet || !request.razred) {
    throw new Error('Pick a class and a subject first.')
  }

  const data = await read()

  // Newest 30 topics for this subject become izogni_se.
  const izogniSe = [
    ...new Set(
      data.topics
        .filter((topic) => topic.predmet === request.predmet)
        .slice(-TOPIC_WINDOW)
        .map((topic) => topic.tema)
    )
  ]

  const seenHashes = new Set([
    ...data.hashes.filter((row) => row.predmet === request.predmet).map((row) => row.hash),
    ...issuedHashes
  ])

  const accepted: QuizQuestion[] = []
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS && accepted.length < request.stevilo; attempt++) {
    const missing = request.stevilo - accepted.length
    try {
      const batch = await generateQuizQuestions({ ...request, stevilo: missing }, izogniSe)
      for (const candidate of batch) {
        if (accepted.length >= request.stevilo) break
        const question = validate(candidate, seenHashes)
        if (!question) continue
        // Guard against duplicates inside a single response too.
        seenHashes.add(hashQuestion(question.vprasanje))
        accepted.push(shuffleAnswers(question))
      }
    } catch (error) {
      lastError = error as Error
      break
    }
  }

  // Only surface an error if we got nothing at all; a short batch is still usable.
  if (accepted.length === 0) {
    throw lastError ?? new Error('The AI did not return any usable questions. Try again.')
  }

  // Deliberately NOT written to disk here — see markQuestionsSeen.
  for (const question of accepted) issuedHashes.add(hashQuestion(question.vprasanje))

  return accepted
}

/**
 * Commit a batch to the long-term memory, once it is actually on screen.
 *
 * Called by the renderer when a batch becomes the active round. A prefetched
 * batch that is never reached is never committed, so its questions stay in the
 * pool and its topics stay out of izogni_se.
 */
export function markQuestionsSeen(predmet: string, questions: QuizQuestion[]): Promise<void> {
  const next = writeQueue.then(async () => {
    if (!predmet || questions.length === 0) return

    const data = await read()
    const now = new Date().toISOString()
    const known = new Set(data.hashes.filter((row) => row.predmet === predmet).map((row) => row.hash))

    for (const question of questions) {
      const hash = hashQuestion(question.vprasanje)
      if (known.has(hash)) continue
      known.add(hash)
      data.topics.push({ predmet, tema: question.tema, createdAt: now })
      data.hashes.push({ predmet, hash, createdAt: now })
    }

    // Keep both lists bounded — oldest first, so slicing from the end keeps recent.
    data.topics = data.topics.slice(-TOPIC_WINDOW * 20)
    data.hashes = data.hashes.slice(-HASH_LIMIT)
    await write(data)
  })

  writeQueue = next.catch(() => {})
  return next
}
