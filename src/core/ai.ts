import type { Explanation, QuestionRequest } from '@shared/types'
import { readSettings } from './settings'
import { recordUsage, type UsageFeature } from './usage'

/**
 * Every call to Gemini.
 *
 * Runs in the cloud, so the API key never reaches a client, per the hard
 * constraint in CLAUDE.md. Only generated content is sent back.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 45_000
/** Server-side failures worth another go, and the waits before each retry. */
const TRANSIENT = new Set([500, 502, 503, 504])
const RETRY_DELAYS_MS = [1000, 3000]

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    totalTokenCount?: number
  }
  error?: { message?: string }
}

/** Turns provider/network failures into something worth showing a user. */
function describeFailure(status: number, message?: string): string {
  if (status === 400 || status === 401 || status === 403) {
    return 'The API key was rejected. Check it in the settings.'
  }
  if (status === 404) {
    return `The model is unavailable${message ? `: ${message}` : '.'}`
  }
  if (status === 429) return 'Rate limit reached. Try again in a little while.'
  // Status and Google's own words, so a report says what actually came back.
  if (status >= 500) {
    const detail = message ? `: ${message.trim().replace(/\.$/, '')}` : ''
    return `The AI service is having trouble (${status}${detail}). Try again shortly.`
  }
  return message ? `Request failed: ${message}` : `Request failed (HTTP ${status}).`
}

/**
 * One request/response cycle, shared by both features. Returns the raw text.
 * `feature` only tags the token accounting.
 */
async function callGemini(feature: UsageFeature, body: Record<string, unknown>): Promise<string> {
  const { geminiApiKey, model } = await readSettings()
  if (!geminiApiKey) throw new Error('No API key configured.')

  let response: Response
  let parsed: GeminiResponse
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-goog-api-key': geminiApiKey, 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (error) {
      // No response at all: offline, DNS failure, or our own timeout.
      if ((error as Error).name === 'AbortError') {
        throw new Error('The request timed out. Check your connection and try again.')
      }
      throw new Error("Couldn't reach the AI service. Are you online?")
    } finally {
      clearTimeout(timer)
    }

    parsed = (await response.json().catch(() => ({}))) as GeminiResponse

    // Record before the ok-check: a 200 that yields unusable text still cost tokens.
    if (parsed.usageMetadata) void recordUsage(feature, parsed.usageMetadata)

    // Gemini's 5xx are mostly "model overloaded" and clear within seconds, so
    // retry those. 4xx (key, model, rate limit) would fail the same way again.
    if (!TRANSIENT.has(response.status) || attempt >= RETRY_DELAYS_MS.length) break
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
  }

  if (!response.ok) throw new Error(describeFailure(response.status, parsed.error?.message))

  const text = (parsed.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text)
    .filter((part): part is string => Boolean(part))
    .join('')
    .trim()

  if (!text) throw new Error('The AI returned an empty response. Try again.')
  return text
}

/* ---------- Daily Suggestion ---------- */

const DAILY_SYSTEM_PROMPT = [
  'You suggest ONE small, concrete thing someone can do today to explore a topic they are learning.',
  'Rules: it must fit in 15-30 minutes; be specific, not generic advice;',
  'name a real resource, exercise, or experiment where possible;',
  'do not use markdown, headings, or bullet points; reply in 2-3 plain sentences.',
  'If earlier suggestions are listed, yours must be meaningfully different from all of them —',
  'a different tool, resource, or angle, not a reworded version of the same task.'
].join(' ')

export interface PriorSuggestion {
  text: string
  /** Whether the user ticked it off as actually done. */
  done: boolean
  /** The user's own one-line reflection on it, '' for none. */
  note?: string
}

/**
 * The model has no memory between calls, so anything it should know has to be
 * sent explicitly. Without this, the same topic yields near-identical
 * suggestions day after day (and every reroll returns a reworded duplicate).
 *
 * Completed and skipped items are listed separately: what the user finished is
 * ground to build on, what they skipped evidently didn't land. A note the user
 * left goes under its item in either list — "too hard" on a skipped one says
 * as much as "loved it" on a finished one.
 */
export function buildDailyPrompt(topic: string, prior: PriorSuggestion[]): string {
  if (prior.length === 0) return `Topic: ${topic}`

  const lines = [`Topic: ${topic}`, '']
  const finished = prior.filter((item) => item.done)
  const skipped = prior.filter((item) => !item.done)
  const describe = (item: PriorSuggestion, index: number): string =>
    item.note ? `${index + 1}. ${item.text}\n   Their note: "${item.note}"` : `${index + 1}. ${item.text}`

  if (finished.length > 0) {
    lines.push('The user already COMPLETED these, so build on them and go a step further:')
    lines.push(...finished.map(describe))
    lines.push('')
  }
  if (skipped.length > 0) {
    lines.push('Suggested before but NOT done — try a different angle, do not re-offer these:')
    lines.push(...skipped.map(describe))
    lines.push('')
  }
  if (prior.some((item) => item.note)) {
    lines.push("Take the user's notes into account.")
  }
  lines.push('Your suggestion must not repeat or reword anything listed above.')
  return lines.join('\n')
}

export async function generateDailySuggestion(
  topic: string,
  prior: PriorSuggestion[] = []
): Promise<string> {
  return callGemini('daily', {
    systemInstruction: { parts: [{ text: DAILY_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildDailyPrompt(topic, prior) }] }],
    generationConfig: { temperature: 1.0, maxOutputTokens: 2000 }
  })
}

/* ---------- Explanation ---------- */

const EXPLAIN_SYSTEM_PROMPT = `You explain how to carry out one small learning task, for an adult learner.

You are given a topic and a suggested task. Return:
- steps: 4 to 8 concrete steps for actually doing the task, in order. Name the exact commands, menus, settings or actions where they matter. If a step needs a tool the learner may not have, say how to get it.
- concepts: 3 to 6 key terms the learner will meet while doing it, each defined in one or two plain sentences.

Rules:
- Stick to the task as written. Do not add unrelated extras or swap in a different task.
- Wrap code, commands, file paths, keyboard shortcuts and symbols in single backticks, written exactly as they are typed, for example \`git status\`, \`Ctrl+Shift+P\` or \`x != 0\`. Never spell a symbol out as a word.
- Code must be exactly what the learner would type into the editor, character for character, so \`println!("{}", x);\` stays exactly that: no doubled braces, and no quotes or brackets left out. Keep each code span short, one line or statement.
- No other formatting: no bold, no headings, no bullet characters, and no step numbers - the app numbers the steps.
- Never invent URLs, file names or product names you are not sure exist. If unsure, describe what to look for instead.`

const EXPLAIN_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    steps: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 3, maxItems: 10 },
    concepts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { term: { type: 'STRING' }, definition: { type: 'STRING' } },
        required: ['term', 'definition']
      },
      minItems: 2,
      maxItems: 8
    }
  },
  required: ['steps', 'concepts']
}

/**
 * "1. Open…", "Step 2: Run…", "- Click…" — numbering the prompt asked it to leave
 * out. The trailing space is required so "3-4 times" or "-O2" keep their start.
 */
const LEADING_MARKER = /^\s*(?:step\s*\d+\s*[.):-]?|\d+\s*[.):-]|[-*•])\s+/i

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(LEADING_MARKER, '').trim() : ''
}

/**
 * The full walkthrough behind one suggestion. Only ever called because the user
 * pressed Explain; the result is cached on the entry by daily.ts.
 */
export async function generateExplanation(topic: string, task: string): Promise<Explanation> {
  const text = await callGemini('explain', {
    systemInstruction: { parts: [{ text: EXPLAIN_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: `Topic: ${topic}\nTask: ${task}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXPLAIN_RESPONSE_SCHEMA,
      // Lower than the daily call: an explanation should be dependable, not varied.
      temperature: 0.7,
      maxOutputTokens: 3000
    }
  })

  let parsed: { steps?: unknown; concepts?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned an unreadable explanation. Try again.')
  }

  const steps = (Array.isArray(parsed.steps) ? parsed.steps : []).map(cleanText).filter(Boolean)
  const concepts = (Array.isArray(parsed.concepts) ? parsed.concepts : [])
    .map((item: { term?: unknown; definition?: unknown }) => ({
      term: cleanText(item?.term).replace(/:$/, ''),
      definition: cleanText(item?.definition)
    }))
    .filter((item) => item.term && item.definition)

  if (steps.length < 2 || concepts.length < 1) {
    throw new Error('The AI returned an incomplete explanation. Try again.')
  }

  return { steps, concepts, generatedAt: new Date().toISOString() }
}

/* ---------- Question Generator ---------- */

/** Verbatim from GEMINI_PROMPT_SPEC.md. Do not paraphrase — it is tuned. */
const QUIZ_SYSTEM_PROMPT = `Si generator vprašanj za obnavljanje snovi slovenske osnovne in srednje šole.
Uporabnik je odrasla oseba, ki ponavlja šolsko snov, NE otrok. Ton je odrasel in jedrnat.

Iz vhodnih parametrov (predmet, razred, tezavnost, stevilo, izogni_se) ustvari
nova vprašanja izbirnega tipa iz slovenskega učnega načrta.

PRAVILA
- Snov mora ustrezati slovenskemu učnemu načrtu za ta predmet in razred.
  Vključi slovensko snov, kjer je relevantna (slovenščina: Prešeren, Cankar,
  Kosovel, Jenko; zgodovina: tudi slovenska; geografija: tudi Slovenija).
- Eno dejstvo na vprašanje. Brez "kaj od naštetega NI" in brez "vse našteto".
- 4 odgovori, točno eden pravilen. Napačni morajo biti verjetni in iste vrste
  (letnice z letnicami, pesniki s pesniki, organeli z organeli). Nikoli šaljivi
  ali očitno napačni.
- Razlaga: 1 do 2 stavka. Zakaj je pravilen, in po možnosti zakaj je najbolj
  mamljiv napačen odgovor napačen.
- Ne generiraj vprašanj o temah iz "izogni_se". Razporedi vprašanja po
  različnih temah predmeta, ne vseh iz istega poglavja.
- Če v dejstvo nisi prepričan, ga ne uporabi. Nikoli si ne izmišljuj letnic,
  imen ali naslovov del.
- Vse v slovenščini. Brez emojijev.

TEŽAVNOST
1 = osnovno dejstvo, ki ga zna skoraj vsak
2 = tipično vprašanje iz šolskega testa
3 = detajl, ki si ga zapomni le, kdor je snov res predelal

PRIMER (predmet: Biologija, razred: 8, tezavnost: 2)
[{"vprasanje":"Kateri celični organel proizvede največ ATP?","odgovori":["Mitohondrij","Ribosom","Golgijev aparat","Lizosom"],"pravilen":0,"razlaga":"V mitohondriju poteka celično dihanje, kjer nastane večina ATP. Ribosomi ne pridobivajo energije, ampak sestavljajo beljakovine.","tema":"Celica"}]`

/** The response shape the model is constrained to, per the spec. */
const QUIZ_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      vprasanje: { type: 'STRING' },
      odgovori: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 4, maxItems: 4 },
      pravilen: { type: 'INTEGER' },
      razlaga: { type: 'STRING' },
      tema: { type: 'STRING' }
    },
    required: ['vprasanje', 'odgovori', 'pravilen', 'razlaga', 'tema']
  }
}

function buildQuizPrompt(request: QuestionRequest, izogniSe: string[]): string {
  return [
    `predmet: ${request.predmet}`,
    `razred: ${request.razred}`,
    `tezavnost: ${request.tezavnost}`,
    `stevilo: ${request.stevilo}`,
    `izogni_se: ${JSON.stringify(izogniSe)}`
  ].join('\n')
}

/** Whatever the model returned, still unvalidated. questions.ts filters it. */
export type RawQuizQuestion = Record<string, unknown>

export async function generateQuizQuestions(
  request: QuestionRequest,
  izogniSe: string[]
): Promise<RawQuizQuestion[]> {
  const text = await callGemini('quiz', {
    systemInstruction: { parts: [{ text: QUIZ_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildQuizPrompt(request, izogniSe) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: QUIZ_RESPONSE_SCHEMA,
      temperature: 1.0,
      maxOutputTokens: 8000
    }
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned malformed JSON.')
  }
  return Array.isArray(parsed) ? (parsed as RawQuizQuestion[]) : []
}
