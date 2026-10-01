import { create } from 'zustand'
import { todayKey } from '@shared/date'
import { ipcErrorMessage } from './ipcError'
import { useSettingsStore } from './useSettingsStore'
import { refreshUsage } from './useUsageStore'
import type { DailyEntry, DailyView } from '@shared/types'

type Status = 'idle' | 'loading' | 'generating' | 'ready' | 'error'

interface DailyState {
  result: DailyView | null
  status: Status
  error: string | null
  /** The local day `result` was loaded for; a tray app can stay open past midnight. */
  loadedDay: string | null
  /** Reads cached state and generates if today's suggestion isn't there yet. */
  load: () => Promise<void>
  /**
   * On returning to the window: a new day loads (and generates) as at launch;
   * otherwise the history is re-read quietly, so a change made on another
   * device shows up without a spinner.
   */
  refresh: () => Promise<void>
  retry: () => Promise<void>
  reroll: () => Promise<void>
  setDone: (id: string, done: boolean) => Promise<void>
  /** Rejects if the save fails, so the card can keep the note open. */
  setNote: (id: string, note: string) => Promise<void>
  remove: (id: string) => Promise<void>
  saveApiKey: (key: string) => Promise<void>
}

const message = ipcErrorMessage

export const useDailyStore = create<DailyState>((set, get) => ({
  result: null,
  status: 'idle',
  error: null,
  loadedDay: null,

  load: async () => {
    // Don't restart a generation that's already in flight (StrictMode double-mount,
    // or the user switching tabs while it runs).
    if (get().status === 'loading' || get().status === 'generating') return

    set({ status: 'loading', error: null })
    try {
      const cached = await window.api.daily.get()
      set({ result: cached, loadedDay: todayKey() })

      // Already done for today, or nothing to do — stop here, no network call.
      if (cached.state !== 'pending') {
        set({ status: 'ready' })
        return
      }

      set({ status: 'generating' })
      set({ result: await window.api.daily.generate(), status: 'ready' })
      refreshUsage()
    } catch (error) {
      set({ status: 'error', error: message(error) })
    }
  },

  refresh: async () => {
    const { loadedDay, status } = get()
    if (!loadedDay || status === 'loading' || status === 'generating') return
    // A new day means a new suggestion — the same one call a fresh launch makes.
    if (loadedDay !== todayKey()) return get().load()
    try {
      const result = await window.api.daily.get()
      // A generation that started meanwhile has the newer view.
      if (get().status !== 'generating') set({ result })
    } catch {
      // Offline for a moment: keep what is on screen.
    }
  },

  retry: async () => {
    set({ status: 'generating', error: null })
    try {
      set({ result: await window.api.daily.generate(), status: 'ready' })
      refreshUsage()
    } catch (error) {
      set({ status: 'error', error: message(error) })
    }
  },

  reroll: async () => {
    if (get().status === 'generating') return
    set({ status: 'generating', error: null })
    try {
      set({ result: await window.api.daily.reroll(), status: 'ready' })
      refreshUsage()
    } catch (error) {
      set({ status: 'error', error: message(error) })
    }
  },

  setDone: async (id, done) => {
    // Optimistic: the tick responds instantly and reverts if the write fails.
    const previous = get().result
    if (previous) {
      const apply = (entry: DailyEntry): DailyEntry => (entry.id === id ? { ...entry, done } : entry)
      set({
        result: {
          ...previous,
          today: previous.today ? apply(previous.today) : null,
          history: previous.history.map(apply)
        }
      })
    }
    try {
      set({ result: await window.api.daily.setDone(id, done) })
    } catch (error) {
      set({ result: previous, error: message(error) })
    }
  },

  setNote: async (id, note) => {
    try {
      set({ result: await window.api.daily.setNote(id, note) })
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  remove: async (id) => {
    const previous = get().result
    try {
      set({ result: await window.api.daily.remove(id) })
    } catch (error) {
      set({ result: previous, error: message(error) })
    }
  },

  /** Saving a key also retries today — usually the reason it was entered. */
  saveApiKey: async (key) => {
    await useSettingsStore.getState().saveApiKey(key)
    await get().retry()
  }
}))
