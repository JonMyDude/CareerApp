import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  CloudConnection,
  CloudInfo,
  DailyView,
  ExportResult,
  FrameColors,
  Interest,
  InterestInput,
  InterestPatch,
  QuestionRequest,
  QuizAnswerMeta,
  QuizQuestion,
  QuizStats,
  ReviewQuestion,
  SettingsInfo,
  SettingsPatch,
  TestReminderResult,
  UploadResult,
  UsageSummary
} from '@shared/types'

/**
 * The only surface the renderer gets. Nothing here exposes ipcRenderer itself,
 * so the UI can call these functions and nothing else.
 *
 * Note there is no way to READ the API key from this side — by design.
 */
const api = {
  /** The browser and Android install their own `window.api` (renderer/src/installApi.ts). */
  platform: 'desktop' as 'desktop' | 'web' | 'android',
  interests: {
    list: (): Promise<Interest[]> => ipcRenderer.invoke(IPC.interestsList),
    create: (input: InterestInput): Promise<Interest> =>
      ipcRenderer.invoke(IPC.interestsCreate, input),
    update: (id: string, patch: InterestPatch): Promise<Interest> =>
      ipcRenderer.invoke(IPC.interestsUpdate, id, patch),
    remove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.interestsRemove, id)
  },
  daily: {
    /** Cached state only, never a network call. */
    get: (): Promise<DailyView> => ipcRenderer.invoke(IPC.dailyGet),
    /** Generates if today's suggestion isn't cached yet; otherwise returns the cache. */
    generate: (): Promise<DailyView> => ipcRenderer.invoke(IPC.dailyGenerate),
    /** Draws a different interest and adds another suggestion for today. */
    reroll: (): Promise<DailyView> => ipcRenderer.invoke(IPC.dailyReroll),
    /** Tick a suggestion off, or un-tick it. */
    setDone: (id: string, done: boolean): Promise<DailyView> =>
      ipcRenderer.invoke(IPC.dailySetDone, id, done),
    /** Delete a suggestion from the history. */
    remove: (id: string): Promise<DailyView> => ipcRenderer.invoke(IPC.dailyRemove, id),
    /**
     * The full explanation for one suggestion. Cached after the first call —
     * pass `force` to regenerate, which spends tokens again.
     */
    explain: (id: string, force = false): Promise<DailyView> =>
      ipcRenderer.invoke(IPC.dailyExplain, id, force),
    /** The user's one-line reflection on a suggestion; '' clears it. */
    setNote: (id: string, note: string): Promise<DailyView> =>
      ipcRenderer.invoke(IPC.dailySetNote, id, note)
  },
  questions: {
    /** Returns only questions that passed every validation rule in the spec. */
    generate: (request: QuestionRequest): Promise<QuizQuestion[]> =>
      ipcRenderer.invoke(IPC.questionsGenerate, request),
    /** Commit a batch to long-term memory once it is actually on screen. */
    markSeen: (predmet: string, questions: QuizQuestion[]): Promise<void> =>
      ipcRenderer.invoke(IPC.questionsMarkSeen, predmet, questions),
    /** Log an answer; a wrong one is kept for review, a right one clears it. */
    recordAnswer: (meta: QuizAnswerMeta, question: QuizQuestion, chosen: number): Promise<void> =>
      ipcRenderer.invoke(IPC.questionsRecordAnswer, meta, question, chosen),
    /** Accuracy per subject, class and topic, from the answer log. Never a network call. */
    stats: (): Promise<QuizStats> => ipcRenderer.invoke(IPC.questionsStats),
    /** Past mistakes to ask again. RANDOM (or '') means any subject or class. */
    mistakes: (filter: { predmet: string; razred: string }, limit: number): Promise<ReviewQuestion[]> =>
      ipcRenderer.invoke(IPC.questionsMistakes, filter, limit)
  },
  usage: {
    /** Token totals for today, read from disk. Never a network call. */
    get: (): Promise<UsageSummary> => ipcRenderer.invoke(IPC.usageGet)
  },
  settings: {
    get: (): Promise<SettingsInfo> => ipcRenderer.invoke(IPC.settingsGet),
    /** Write-only: the key goes in, and nothing ever reads it back out. */
    setApiKey: (key: string): Promise<void> => ipcRenderer.invoke(IPC.settingsSetApiKey, key),
    /** Validated in main; rejects with a readable message if a value is refused. */
    update: (patch: SettingsPatch): Promise<SettingsInfo> =>
      ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  /** Desktop only: where the cloud is, and the one-time upload of this computer's old files. */
  cloud: {
    get: (): Promise<CloudInfo> => ipcRenderer.invoke(IPC.cloudGet),
    /** Saves the address and service token, then checks they work. */
    set: (connection: CloudConnection): Promise<CloudInfo> => ipcRenderer.invoke(IPC.cloudSet, connection),
    upload: (): Promise<UploadResult> => ipcRenderer.invoke(IPC.cloudUpload)
  },
  frame: {
    /** Recolour the window's caption buttons to match the app theme. */
    setTheme: (colors: FrameColors): Promise<void> =>
      ipcRenderer.invoke(IPC.frameSetTheme, colors)
  },
  export: {
    /** Opens a save dialog and writes the history as Markdown where the user picks. */
    history: (): Promise<ExportResult> => ipcRenderer.invoke(IPC.exportHistory),
    /** Shows the last exported file in Explorer. Takes no path — main remembers it. */
    reveal: (): Promise<void> => ipcRenderer.invoke(IPC.exportReveal)
  },
  reminder: {
    /** Shows today's reminder now, as it would look. Never spends tokens. */
    test: (): Promise<TestReminderResult> => ipcRenderer.invoke(IPC.reminderTest)
  },
  /**
   * Events from the main process, each on one fixed channel. Every subscribe
   * returns its unsubscribe. The raw IPC event object is never handed over.
   */
  on: {
    /** Today's suggestion changed outside the renderer (the reminder generated it). */
    dailyChanged: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.eventDailyChanged, listener)
      return () => ipcRenderer.removeListener(IPC.eventDailyChanged, listener)
    },
    /** Main wants a tab shown — e.g. a click on the reminder opens Daily. */
    navigate: (callback: (tab: string) => void): (() => void) => {
      const listener = (_event: unknown, tab: unknown): void => {
        if (typeof tab === 'string') callback(tab)
      }
      ipcRenderer.on(IPC.eventNavigate, listener)
      return () => ipcRenderer.removeListener(IPC.eventNavigate, listener)
    }
  }
}

/** `cloud` exists on the desktop and Android; in the browser the page itself is the cloud. */
export type AppApi = Omit<typeof api, 'cloud'> & { cloud?: typeof api.cloud }

contextBridge.exposeInMainWorld('api', api)
