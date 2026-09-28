import { create } from 'zustand'
import type { DailyEntry, DailyView } from '@shared/types'
import { ipcErrorMessage } from './ipcError'
import { useDailyStore } from './useDailyStore'
import { useNavStore } from './useNavStore'
import { refreshUsage } from './useUsageStore'

/**
 * Which suggestion the Explanation tab is showing, and whether its explanation
 * is being written.
 *
 * The explanation itself lives on the entry in useDailyStore — there is one
 * source of truth, so the Daily card's "explained" state and this tab can't
 * disagree. Every call returns the fresh DailyView, which replaces the Daily
 * store's copy.
 */

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ExplainState {
  entryId: string | null
  status: Status
  error: string | null
  /** Switch to the tab and show this suggestion's explanation, writing it if needed. */
  open: (id: string) => Promise<void>
  /** Write a fresh explanation for the open suggestion. Spends tokens again. */
  regenerate: () => Promise<void>
}

/**
 * An entry by id, whether it's today's or history. Takes the result explicitly
 * so a component can pass its *subscribed* copy and re-render when it changes.
 */
export function findEntry(result: DailyView | null, id: string | null): DailyEntry | null {
  if (!id || !result) return null
  if (result.today?.id === id) return result.today
  return result.history.find((entry) => entry.id === id) ?? null
}

export const useExplainStore = create<ExplainState>((set, get) => {
  async function fetchExplanation(id: string, force: boolean): Promise<void> {
    set({ status: 'loading', error: null })
    try {
      const view = await window.api.daily.explain(id, force)
      useDailyStore.setState({ result: view })
      refreshUsage()
      // The user may have opened a different suggestion while this one was
      // being written. It is saved either way; only report on the one on screen.
      if (get().entryId === id) set({ status: 'ready' })
    } catch (error) {
      if (get().entryId === id) set({ status: 'error', error: ipcErrorMessage(error) })
    }
  }

  return {
    entryId: null,
    status: 'idle',
    error: null,

    open: async (id) => {
      useNavStore.getState().setTab('explain')

      // Pressing Explain again on the one already being written would pay twice.
      if (get().entryId === id && get().status === 'loading') return

      set({ entryId: id, error: null })
      // Cached: show it immediately, no call.
      if (findEntry(useDailyStore.getState().result, id)?.explanation) {
        set({ status: 'ready' })
        return
      }
      await fetchExplanation(id, false)
    },

    regenerate: async () => {
      const { entryId, status } = get()
      if (!entryId || status === 'loading') return
      await fetchExplanation(entryId, true)
    }
  }
})
