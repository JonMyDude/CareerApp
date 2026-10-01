import { create } from 'zustand'
import { ipcErrorMessage } from './ipcError'
import type { Interest, InterestInput, InterestPatch } from '@shared/types'

/**
 * The one shared dataset. All three tabs read from here; only this file talks
 * to window.api for interests, so persistence stays in a single place.
 */

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface InterestsState {
  interests: Interest[]
  status: Status
  error: string | null
  load: () => Promise<void>
  /** Re-read without a spinner, e.g. when the window regains focus. */
  refresh: () => Promise<void>
  add: (input: InterestInput) => Promise<void>
  edit: (id: string, patch: InterestPatch) => Promise<void>
  remove: (id: string) => Promise<void>
  clearError: () => void
}

const message = ipcErrorMessage

export const useInterestsStore = create<InterestsState>((set, get) => ({
  interests: [],
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      set({ interests: await window.api.interests.list(), status: 'ready' })
    } catch (error) {
      set({ status: 'error', error: message(error) })
    }
  },

  refresh: async () => {
    if (get().status !== 'ready') return
    try {
      set({ interests: await window.api.interests.list() })
    } catch {
      // Offline for a moment: keep what is on screen.
    }
  },

  add: async (input) => {
    set({ error: null })
    try {
      const created = await window.api.interests.create(input)
      set({ interests: [...get().interests, created] })
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  edit: async (id, patch) => {
    set({ error: null })
    try {
      const updated = await window.api.interests.update(id, patch)
      set({ interests: get().interests.map((item) => (item.id === id ? updated : item)) })
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  remove: async (id) => {
    set({ error: null })
    // Optimistic: the row disappears immediately, and comes back if the write fails.
    const previous = get().interests
    set({ interests: previous.filter((item) => item.id !== id) })
    try {
      await window.api.interests.remove(id)
    } catch (error) {
      set({ interests: previous, error: message(error) })
    }
  },

  clearError: () => set({ error: null })
}))
