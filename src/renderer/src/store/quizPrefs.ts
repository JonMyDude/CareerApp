import type { QuestionRequest } from '@shared/types'

/**
 * The setup screen's last selection, so the app comes back where you left it.
 *
 * localStorage rather than a JSON file in the main process: this is a UI
 * preference, not data, and it matches how the colour mode is stored. Electron
 * persists it under userData, so it survives a restart.
 */

const STORAGE_KEY = 'career-app:quiz-setup'

/** May hold RANDOM in either field — that is a real, persistable choice. */
export type QuizSelection = QuestionRequest

// 10 rather than 5: input tokens are fixed per call, so a bigger batch costs
// ~240 tokens per question instead of ~308.
const FALLBACK: QuizSelection = { razred: '', predmet: '', tezavnost: 2, stevilo: 10 }

export function loadQuizSelection(): QuizSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...FALLBACK }
    const parsed = JSON.parse(raw) as Partial<QuizSelection>
    return {
      razred: typeof parsed.razred === 'string' ? parsed.razred : '',
      predmet: typeof parsed.predmet === 'string' ? parsed.predmet : '',
      tezavnost: Number.isInteger(parsed.tezavnost) ? (parsed.tezavnost as number) : 2,
      stevilo: Number.isInteger(parsed.stevilo) ? (parsed.stevilo as number) : 10
    }
  } catch {
    return { ...FALLBACK }
  }
}

export function saveQuizSelection(selection: QuizSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // A full or blocked localStorage must not break starting a quiz.
  }
}
