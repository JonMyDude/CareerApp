import { todayKey } from '@shared/date'
import { IPC } from '@shared/ipc'
import type { AppApi } from '../../preload'

/**
 * `window.api` for clients that talk to the cloud directly: the browser here,
 * and Android (androidApi.ts) with its own address and service token. The
 * desktop gets `window.api` from its preload script instead.
 */

export type Call = <T>(channel: string, ...args: unknown[]) => Promise<T>

interface Transport {
  /** The address of one API channel. */
  url: (channel: string) => Promise<string>
  headers: () => Promise<Record<string, string>>
  /** Shown when the request never got an answer. */
  unreachable: string
}

export function makeCall(transport: Transport): Call {
  return async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    const url = await transport.url(channel)
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(await transport.headers()),
          'content-type': 'application/json',
          // "Today" is this device's today; the cloud runs on UTC.
          'x-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        body: JSON.stringify({ args })
      })
    } catch {
      throw new Error(transport.unreachable)
    }
    const body = (await response.json().catch(() => null)) as { result?: T; error?: string } | null
    // Access answers a refused request with its login page, not JSON; Android
    // follows that redirect, so it arrives as an ordinary 200 HTML page.
    if (!body) {
      throw new Error(
        (response.headers.get('content-type') ?? '').includes('text/html')
          ? 'Cloudflare Access refused this device. Check the service token in Settings → Cloud.'
          : `The cloud didn't answer as expected (HTTP ${response.status}). Check Settings → Cloud.`
      )
    }
    if (!response.ok) throw new Error(body.error ?? `The cloud answered HTTP ${response.status}.`)
    return body.result as T
  }
}

/** Every data operation, the same on each client that calls the cloud directly. */
export function cloudMethods(call: Call): Pick<AppApi, 'interests' | 'daily' | 'questions' | 'usage' | 'settings'> {
  return {
    interests: {
      list: () => call(IPC.interestsList),
      create: (input) => call(IPC.interestsCreate, input),
      update: (id, patch) => call(IPC.interestsUpdate, id, patch),
      remove: (id) => call(IPC.interestsRemove, id)
    },
    daily: {
      get: () => call(IPC.dailyGet),
      generate: () => call(IPC.dailyGenerate),
      reroll: () => call(IPC.dailyReroll),
      setDone: (id, done) => call(IPC.dailySetDone, id, done),
      remove: (id) => call(IPC.dailyRemove, id),
      explain: (id, force = false) => call(IPC.dailyExplain, id, force),
      setNote: (id, note) => call(IPC.dailySetNote, id, note)
    },
    questions: {
      generate: (request) => call(IPC.questionsGenerate, request),
      markSeen: (predmet, questions) => call(IPC.questionsMarkSeen, predmet, questions),
      recordAnswer: (meta, question, chosen) => call(IPC.questionsRecordAnswer, meta, question, chosen),
      stats: () => call(IPC.questionsStats),
      mistakes: (filter, limit) => call(IPC.questionsMistakes, filter, limit)
    },
    usage: {
      get: () => call(IPC.usageGet)
    },
    settings: {
      get: () => call(IPC.settingsGet),
      setApiKey: (key) => call(IPC.settingsSetApiKey, key),
      update: (patch) => call(IPC.settingsUpdate, patch)
    }
  }
}

export const exportFileName = (): string => `career-app-history-${todayKey()}.md`

/** Hands the browser a text file to save. */
function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const noEvent = (): (() => void) => () => {}

/**
 * The browser's: this site's own origin, so Cloudflare Access's sign-in cookie
 * comes along and no token is needed.
 */
const webCall = makeCall({
  url: async (channel) => `/api/${encodeURIComponent(channel)}`,
  headers: async () => ({}),
  // An expired Access session answers with a cross-site redirect, which fetch
  // reports as a network error, just like being offline.
  unreachable: "Couldn't reach the cloud. If you've been away a while, reload the page to sign in again."
})

export const webApi: AppApi = {
  platform: 'web',
  ...cloudMethods(webCall),
  // The browser draws its own window frame.
  frame: { setTheme: async () => {} },
  export: {
    history: async () => {
      const fileName = exportFileName()
      download(fileName, await webCall<string>(IPC.exportMarkdown))
      return { saved: true, fileName }
    },
    // A download goes wherever the browser puts it; there is no folder to show.
    reveal: async () => {}
  },
  // No notifications in the browser; the Settings page hides the reminder.
  reminder: { test: async () => ({ shown: false }) },
  on: { dailyChanged: noEvent, navigate: noEvent }
}
