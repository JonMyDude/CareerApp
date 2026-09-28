/**
 * Fixed option lists for the question generator, straight from the spec.
 * Free text is deliberately not allowed — the model is prompted against the
 * Slovenian curriculum, so the subject and class have to be ones it knows.
 */

export const OSNOVNA_SOLA = ['6. razred', '7. razred', '8. razred', '9. razred'] as const

export const GIMNAZIJA = [
  '1. letnik gimnazije',
  '2. letnik gimnazije',
  '3. letnik gimnazije',
  '4. letnik gimnazije'
] as const

/** Every class, in the order they are offered. */
export const RAZREDI: string[] = [...OSNOVNA_SOLA, ...GIMNAZIJA]

const OS_PREDMETI = [
  'Slovenščina',
  'Matematika',
  'Zgodovina',
  'Geografija',
  'Biologija',
  'Kemija',
  'Fizika',
  'Domovinska in državljanska kultura in etika',
  'Angleščina',
  // Not in GEMINI_PROMPT_SPEC.md's list — added on request. The Slovenian
  // curriculum names it differently per level: an elective called
  // Računalništvo in primary school, the subject Informatika in gimnazija.
  // Using the real name for each level keeps the generated questions on
  // syllabus, which is what the system prompt asks the model to follow.
  'Računalništvo'
]

const GIMNAZIJA_PREDMETI = [
  'Slovenščina',
  'Matematika',
  'Zgodovina',
  'Geografija',
  'Biologija',
  'Kemija',
  'Fizika',
  'Sociologija',
  'Psihologija',
  'Filozofija',
  'Angleščina',
  'Informatika'
]

/** The subject list differs between primary school and gimnazija. */
export function subjectsFor(razred: string): string[] {
  return (OSNOVNA_SOLA as readonly string[]).includes(razred) ? OS_PREDMETI : GIMNAZIJA_PREDMETI
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Osnovno — dejstvo, ki ga zna skoraj vsak',
  2: 'Šolski test — tipično vprašanje',
  3: 'Detajl — le za tiste, ki so snov res predelali'
}

export const MIN_QUESTIONS = 1
export const MAX_QUESTIONS = 10

/** Sentinel value for the "random" entry in either dropdown. */
export const RANDOM = '__random__'

/** Every subject across both levels, for when the class itself is random. */
export function allSubjects(): string[] {
  return [...new Set([...subjectsFor('6. razred'), ...subjectsFor('1. letnik gimnazije')])]
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * Turn a selection that may contain RANDOM into a concrete (razred, predmet).
 *
 * Subject wins over class: some subjects only exist at one level (Sociologija
 * is gimnazija-only, DKE is primary-only), so when the subject is fixed and the
 * class is random we draw only from classes that actually teach it.
 */
export function resolveSelection(
  razred: string,
  predmet: string
): { razred: string; predmet: string } {
  if (predmet !== RANDOM) {
    const classesTeachingIt = RAZREDI.filter((option) => subjectsFor(option).includes(predmet))
    const resolved = razred === RANDOM ? pick(classesTeachingIt) : razred
    return { razred: resolved, predmet }
  }

  const resolvedRazred = razred === RANDOM ? pick(RAZREDI) : razred
  return { razred: resolvedRazred, predmet: pick(subjectsFor(resolvedRazred)) }
}
