import { create } from 'zustand'
import { resolveSelection } from '@shared/curriculum'
import type { QuestionRequest, QuizAnswerMeta, QuizQuestion, ReviewQuestion } from '@shared/types'
import { ipcErrorMessage } from './ipcError'
import { refreshUsage } from './useUsageStore'
import { saveQuizSelection, type QuizSelection } from './quizPrefs'

/**
 * Quiz state. Independent of the other two tabs — this feature shares nothing
 * with interests or daily suggestions beyond the API key.
 *
 * Two shapes are kept deliberately:
 *   - `selection` is what the user picked, which may say RANDOM
 *   - `config`    is what was actually drawn for the round on screen
 *
 * Keeping both means a random selection draws a fresh subject every round
 * instead of locking to whatever came up first.
 *
 * ## Prefetch, and why it is not eager
 *
 * A batch costs ~1540 tokens and the input half is fixed overhead, so a
 * speculative fetch that is never used doubles the cost of a round. The spec
 * asks for a prefetch, but fetching during the FIRST round is a pure bet: most
 * of the time the user stops there. So the first "next round" is fetched on
 * demand, and only once the user has actually continued do we prefetch ahead.
 *
 * A batch that has been paid for is never thrown away either — if it is still
 * unused when the user restarts with the same settings, it is consumed instead
 * of buying another.
 */

type Status = 'setup' | 'loading' | 'playing' | 'finished' | 'error'

/**
 * 'new' rounds come from the model. 'review' rounds re-ask past mistakes from
 * quiz-history.json: no AI call, no prefetch, and nothing marked as seen.
 */
export type QuizMode = 'new' | 'review'

/** How far from the end of the batch to start fetching the next one. */
const PREFETCH_REMAINING = 2

interface QuizState {
  mode: QuizMode
  selection: QuizSelection | null
  config: QuestionRequest | null
  /** In review mode these are ReviewQuestions, each carrying its own subject and class. */
  questions: QuizQuestion[]
  index: number
  /** Chosen answer per question index; undefined until answered. */
  answers: Record<number, number>
  status: Status
  error: string | null
  prefetched: QuizQuestion[] | null
  prefetchedConfig: QuestionRequest | null
  /** The selection a prefetched batch belongs to, so it is only reused if valid. */
  prefetchedFor: QuizSelection | null
  prefetching: boolean
  /** Set once the user continues to a second round — the signal to prefetch. */
  continuedOnce: boolean

  start: (selection: QuizSelection) => Promise<void>
  /** A round of past mistakes for this selection (RANDOM = any). Never an AI call. */
  startReview: (selection: QuizSelection) => Promise<void>
  answer: (choice: number) => void
  next: () => void
  reset: () => void
  retry: () => Promise<void>
  continueRound: () => Promise<void>
  endRound: () => void
}

/** A concrete request for this round, drawing fresh values if RANDOM was picked. */
function resolveRequest(selection: QuizSelection): QuestionRequest {
  const { razred, predmet } = resolveSelection(selection.razred, selection.predmet)
  return { razred, predmet, tezavnost: selection.tezavnost, stevilo: selection.stevilo }
}

function sameSelection(a: QuizSelection | null, b: QuizSelection | null): boolean {
  if (!a || !b) return false
  return (
    a.razred === b.razred &&
    a.predmet === b.predmet &&
    a.tezavnost === b.tezavnost &&
    a.stevilo === b.stevilo
  )
}

/**
 * Log an answer to the quiz history. A wrong one is kept for review; a right
 * one clears it if it was an old mistake. Bookkeeping only — never blocks play.
 */
function recordAnswer(meta: QuizAnswerMeta | null, question: QuizQuestion, choice: number): void {
  if (!meta) return
  const { predmet, razred, tezavnost } = meta
  void window.api.questions
    .recordAnswer({ predmet, razred, tezavnost }, question, choice)
    .catch(() => {})
}

/** Commit the batch that is now on screen; unshown batches stay uncommitted. */
function markSeen(config: QuestionRequest | null, questions: QuizQuestion[]): void {
  if (!config || questions.length === 0) return
  void window.api.questions.markSeen(config.predmet, questions).catch(() => {
    // Bookkeeping only — a failure here must not interrupt the quiz.
  })
}

export const useQuizStore = create<QuizState>((set, get) => ({
  mode: 'new',
  selection: null,
  config: null,
  questions: [],
  index: 0,
  answers: {},
  status: 'setup',
  error: null,
  prefetched: null,
  prefetchedConfig: null,
  prefetchedFor: null,
  prefetching: false,
  continuedOnce: false,

  start: async (selection) => {
    saveQuizSelection(selection)
    const { prefetched, prefetchedConfig, prefetchedFor } = get()

    // Already bought a batch for these exact settings? Use it rather than
    // paying for another and letting this one rot.
    if (prefetched && prefetched.length > 0 && sameSelection(prefetchedFor, selection)) {
      const config = prefetchedConfig ?? resolveRequest(selection)
      set({
        mode: 'new',
        selection,
        config,
        questions: prefetched,
        prefetched: null,
        prefetchedConfig: null,
        prefetchedFor: null,
        index: 0,
        answers: {},
        error: null,
        status: 'playing'
      })
      markSeen(config, prefetched)
      return
    }

    const config = resolveRequest(selection)
    set({
      mode: 'new',
      selection,
      config,
      status: 'loading',
      error: null,
      questions: [],
      index: 0,
      answers: {},
      prefetched: null,
      prefetchedConfig: null,
      prefetchedFor: null
    })
    try {
      const questions = await window.api.questions.generate(config)
      set({ questions, status: 'playing' })
      markSeen(config, questions)
      refreshUsage()
    } catch (error) {
      set({ status: 'error', error: ipcErrorMessage(error) })
    }
  },

  answer: (choice) => {
    const { mode, config, index, answers, questions, selection, prefetched, prefetching, continuedOnce } =
      get()
    if (answers[index] !== undefined) return
    set({ answers: { ...answers, [index]: choice } })

    const question = questions[index]
    // A review question carries its own subject and class; a new one has the round's.
    if (question) recordAnswer(mode === 'review' ? (question as ReviewQuestion) : config, question, choice)

    // Reviews are local — there is nothing to fetch ahead.
    if (mode === 'review') return

    // Only fetch ahead once the user has shown they play more than one round.
    // Before that the fetch is a coin flip on ~1540 tokens.
    if (!continuedOnce || !selection || prefetched || prefetching) return

    const remaining = questions.length - (index + 1)
    if (remaining > PREFETCH_REMAINING) return

    const nextConfig = resolveRequest(selection)
    set({ prefetching: true })
    void window.api.questions
      .generate(nextConfig)
      .then((batch) => {
        set({
          prefetched: batch,
          prefetchedConfig: nextConfig,
          prefetchedFor: selection,
          prefetching: false
        })
        refreshUsage()
      })
      // A failed prefetch is not the user's problem — the next round is simply
      // fetched on demand instead.
      .catch(() => set({ prefetched: null, prefetchedConfig: null, prefetching: false }))
  },

  next: () => {
    const { index, questions } = get()
    if (index + 1 < questions.length) {
      set({ index: index + 1 })
      return
    }
    set({ status: 'finished' })
  },

  startReview: async (selection) => {
    saveQuizSelection(selection)
    set({ mode: 'review', selection, status: 'loading', error: null, questions: [], index: 0, answers: {} })
    try {
      const questions = await window.api.questions.mistakes(
        { predmet: selection.predmet, razred: selection.razred },
        selection.stevilo
      )
      // Cleared from another round in the meantime: back to setup, nothing to ask.
      if (questions.length === 0) {
        set({ status: 'setup', mode: 'new' })
        return
      }
      set({ questions, status: 'playing' })
    } catch (error) {
      set({ status: 'error', error: ipcErrorMessage(error) })
    }
  },

  reset: () =>
    set({ mode: 'new', status: 'setup', questions: [], index: 0, answers: {}, error: null }),

  /**
   * Stop part-way through and score what was actually answered.
   *
   * Answers are given in order, so the answered questions are always a prefix —
   * trimming to that length keeps the answer indices aligned and makes the
   * summary read "2 od 3" rather than "2 od 10". Any prefetched batch is left
   * alone: it is already paid for and can still be used.
   */
  endRound: () => {
    const { questions, answers } = get()
    const answered = questions.filter((_, position) => answers[position] !== undefined).length

    // Nothing answered yet, so there is no score worth showing.
    if (answered === 0) {
      set({ status: 'setup', questions: [], index: 0, answers: {}, error: null })
      return
    }

    set({ questions: questions.slice(0, answered), status: 'finished' })
  },

  retry: async () => {
    const { selection, mode } = get()
    if (!selection) return
    // A failed review retries the review — it must not quietly turn into an AI round.
    if (mode === 'review') await get().startReview(selection)
    else await get().start(selection)
  },

  /**
   * Play another round. Instant when a batch was prefetched; otherwise fetched
   * now — which is the case for the first "next round", by design.
   */
  continueRound: async () => {
    const { selection, prefetched, prefetchedConfig, prefetchedFor } = get()
    if (!selection) return

    if (prefetched && prefetched.length > 0 && sameSelection(prefetchedFor, selection)) {
      const config = prefetchedConfig ?? get().config
      set({
        mode: 'new',
        questions: prefetched,
        config,
        prefetched: null,
        prefetchedConfig: null,
        prefetchedFor: null,
        index: 0,
        answers: {},
        status: 'playing',
        continuedOnce: true
      })
      markSeen(config, prefetched)
      return
    }

    const config = resolveRequest(selection)
    set({ mode: 'new', status: 'loading', error: null, config, continuedOnce: true })
    try {
      const questions = await window.api.questions.generate(config)
      set({ questions, index: 0, answers: {}, status: 'playing' })
      markSeen(config, questions)
      refreshUsage()
    } catch (error) {
      set({ status: 'error', error: ipcErrorMessage(error) })
    }
  }
}))
