/**
 * Types shared by the main process, the preload bridge and the renderer.
 * Keep this file free of imports so both sides can use it.
 */

/** 1 = Low, 2 = Medium, 3 = High. Also how many times the interest comes up per Daily cycle. */
export type Importance = 1 | 2 | 3

export const IMPORTANCE_LABELS: Record<Importance, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
export const DEFAULT_IMPORTANCE: Importance = 2

export interface Interest {
  id: string
  title: string
  notes: string
  importance: Importance
  /** ISO 8601 */
  createdAt: string
  /** ISO 8601 */
  updatedAt: string
}

export interface InterestInput {
  title: string
  notes?: string
  importance?: Importance
}

export type InterestPatch = Partial<InterestInput>

/** Shape of the JSON file on disk. `version` lets us migrate later. */
export interface InterestsFile {
  version: 1
  interests: Interest[]
}

export const MAX_TITLE_LENGTH = 120
export const MAX_NOTES_LENGTH = 2000
/** A reflection on a daily suggestion is one line; it also goes into the prompt, so it's kept short. */
export const MAX_REFLECTION_LENGTH = 280

/* ---------- Daily Suggestion (step 2) ---------- */

/** The in-depth walkthrough behind a suggestion, generated only on request. */
export interface Explanation {
  /** In order. Plain text; the app numbers them. */
  steps: string[]
  concepts: { term: string; definition: string }[]
  generatedAt: string
}

export interface DailyEntry {
  /** Own identity — a day can hold several entries once you reroll. */
  id: string
  /** Local calendar day, e.g. "2026-09-02". */
  date: string
  interestId: string
  interestTitle: string
  /** null while the interest is drawn but the AI call hasn't succeeded yet. */
  suggestion: string | null
  /** Ticked off by the user. Fed to the model so it knows what was actually done. */
  done: boolean
  /** When it was ticked; null while not done. Streaks count completion days, not suggestion days. */
  doneAt: string | null
  /** The user's one-line reflection, '' for none. Fed to the model with the suggestion. */
  note: string
  /** Cached once the user presses Explain; null until then. */
  explanation: Explanation | null
  /** When the interest was drawn. Sorting key, so rerolls keep their order. */
  createdAt: string
  generatedAt: string | null
}

export type DailyState = 'no-interests' | 'no-api-key' | 'pending' | 'ready'

export interface DailyView {
  state: DailyState
  /** Today's entry, once an interest has been drawn for today. */
  today: DailyEntry | null
  /** Every earlier day that produced a suggestion, newest first. */
  history: DailyEntry[]
  /** Interest ids drawn so far this shuffle-bag cycle, repeats included. For the Interests tab's cycle meter. */
  drawn: string[]
}

export interface SettingsInfo {
  /** Never the key itself — only whether one is present. */
  hasApiKey: boolean
  /** The model actually in use. */
  model: string
  /** What `model` falls back to; equal to it unless the user picked another. */
  defaultModel: string
  /** Self-set ceiling for the token meter; null = none. */
  dailyTokenBudget: number | null
  reminder: ReminderSettings
  /** Closing the window hides it to the tray instead of quitting. */
  closeToTray: boolean
  /** Launch at Windows sign-in. null where it can't be set: dev runs, which would register electron.exe. */
  openAtLogin: boolean | null
}

export interface ReminderSettings {
  enabled: boolean
  /** Local 24-hour "HH:MM". */
  time: string
}

/** A change from the Settings page. Omitted fields are left as they are. */
export interface SettingsPatch {
  /** '' (or the default's own name) resets to the default model. */
  model?: string
  /** null removes the budget. */
  dailyTokenBudget?: number | null
  reminder?: ReminderSettings
  closeToTray?: boolean
  openAtLogin?: boolean
}

export interface TestReminderResult {
  /** true: Windows showed it. false: Windows refused it. null: no answer either way. */
  shown: boolean | null
}

/* ---------- Question Generator (step 3) ---------- */

/** One multiple-choice question. Field names match the spec's JSON schema. */
export interface QuizQuestion {
  /** Local only — the model does not return this. */
  id: string
  vprasanje: string
  /** Exactly four, all distinct. */
  odgovori: string[]
  /** Index 0-3 of the correct answer. */
  pravilen: number
  razlaga: string
  tema: string
}

export interface QuestionRequest {
  predmet: string
  razred: string
  /** 1 = basic, 2 = school test, 3 = detail. */
  tezavnost: number
  /** 1-10. */
  stevilo: number
}

/** Where an answered question came from — recorded with the answer. */
export interface QuizAnswerMeta {
  predmet: string
  razred: string
  tezavnost: number
}

/** A question in a review round: a past mistake, reshuffled, with its own subject and class. */
export type ReviewQuestion = QuizQuestion & QuizAnswerMeta

export interface QuizStatLine {
  answered: number
  correct: number
}

export interface QuizStats {
  /** Most answered first. */
  subjects: (QuizStatLine & {
    predmet: string
    /** Open mistakes in this subject. */
    mistakes: number
    classes: (QuizStatLine & { razred: string })[]
    /** Lowest share correct, among topics with at least 3 answers. */
    weakTopics: (QuizStatLine & { tema: string })[]
  })[]
  /** Open mistakes per subject and class, so the review button can count its own selection. */
  mistakes: { predmet: string; razred: string; count: number }[]
}

/* ---------- Cloud (desktop) ---------- */

/** Where the desktop finds the cloud, and the Access service token that lets it in. */
export interface CloudConnection {
  url: string
  clientId: string
  clientSecret: string
}

/** What the Settings page may know: never the secret itself. */
export interface CloudInfo {
  url: string
  hasToken: boolean
  /** This computer still has data files from before the cloud, not yet uploaded. */
  canUpload: boolean
}

export interface UploadResult {
  /** Which documents went up, e.g. ['interests', 'daily']. */
  imported: string[]
}

/* ---------- Export ---------- */

export interface ExportResult {
  /** False when the user cancelled the save dialog. */
  saved: boolean
  /** Just the file name, for the confirmation line; the full path stays in main. */
  fileName: string | null
}

/* ---------- Window frame ---------- */

/** Caption-button colours, read from theme.css by the renderer. Each is #rrggbb. */
export interface FrameColors {
  /** Behind the minimise / maximise / close buttons — the page background. */
  background: string
  /** The button glyphs. */
  symbols: string
  /** The window's own background, shown before the page paints. */
  appBg: string
}

/* ---------- Token usage meter ---------- */

export interface UsageSummary {
  /** Local calendar day these totals cover. */
  date: string
  requests: number
  promptTokens: number
  outputTokens: number
  /** Thinking tokens, billed as output. 0 on models that don't think. */
  thoughtTokens: number
  totalTokens: number
  byFeature: { daily: number; quiz: number; explain: number }
  /** Optional self-set ceiling; Google exposes no per-key quota to read. */
  budget: number | null
}
