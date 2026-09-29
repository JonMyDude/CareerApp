import { RANDOM } from '@shared/curriculum'
import type { QuizStats } from '@shared/types'

/** Open mistakes matching a class and subject; RANDOM or '' matches anything. */
export function countMistakes(stats: QuizStats | null, razred: string, predmet: string): number {
  if (!stats) return 0
  const any = (value: string): boolean => !value || value === RANDOM
  return stats.mistakes
    .filter((row) => (any(predmet) || row.predmet === predmet) && (any(razred) || row.razred === razred))
    .reduce((total, row) => total + row.count, 0)
}

/** "83 %" — Slovenian puts a space before the sign. */
export function percent(correct: number, answered: number): string {
  return answered === 0 ? '–' : `${Math.round((correct / answered) * 100)} %`
}

/** "napaka" is feminine: 1 odprta, 2 odprti, 3–4 odprte, 5+ odprtih. */
export function odprtih(count: number): string {
  const tail = count % 100
  if (tail === 1) return 'odprta'
  if (tail === 2) return 'odprti'
  if (tail === 3 || tail === 4) return 'odprte'
  return 'odprtih'
}

/** The noun that goes with odprtih(): 1 napaka, 2 napaki, 3–4 napake, 5+ napak. */
export function napak(count: number): string {
  const tail = count % 100
  if (tail === 1) return 'napaka'
  if (tail === 2) return 'napaki'
  if (tail === 3 || tail === 4) return 'napake'
  return 'napak'
}

/** 1 odgovor, 2 odgovora, 3–4 odgovori, 5+ odgovorov (by the last two digits). */
export function odgovorov(count: number): string {
  const tail = count % 100
  if (tail === 1) return 'odgovor'
  if (tail === 2) return 'odgovora'
  if (tail === 3 || tail === 4) return 'odgovori'
  return 'odgovorov'
}
