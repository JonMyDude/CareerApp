/**
 * Where the data lives. Each former JSON file (interests, daily, questions,
 * quiz-history, usage, settings) is one named document. The cloud stores them
 * in a Durable Object; tests use `memoryDocs`.
 *
 * Every module reads a whole document, changes it and writes it back, through
 * its own queue, as it did with files. All requests reach the one Durable
 * Object, which runs them in one isolate, so those queues still serialise
 * every writer.
 */
export interface Docs {
  /** The stored value, or null when there is none yet — normal on first use. */
  read(name: string): Promise<unknown>
  write(name: string, data: unknown): Promise<void>
}

let current: Docs | null = null

export function setDocs(docs: Docs): void {
  current = docs
}

export function docs(): Docs {
  if (!current) throw new Error('Storage is not set up.')
  return current
}

/** For tests: documents kept in a Map, copied in and out like real storage would. */
export function memoryDocs(): Docs & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    store,
    read: async (name) => (store.has(name) ? structuredClone(store.get(name)) : null),
    write: async (name, data) => {
      store.set(name, structuredClone(data))
    }
  }
}

/** The document names, one per former file. */
export const DOC_NAMES = ['interests', 'daily', 'questions', 'quiz-history', 'usage', 'settings'] as const
