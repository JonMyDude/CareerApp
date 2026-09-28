import { create } from 'zustand'
import type { UsageSummary } from '@shared/types'

/** Token totals for today. Read-only — the main process owns the numbers. */
interface UsageState {
  usage: UsageSummary | null
  refresh: () => Promise<void>
}

export const useUsageStore = create<UsageState>((set) => ({
  usage: null,
  refresh: async () => {
    try {
      set({ usage: await window.api.usage.get() })
    } catch {
      // The meter is ambient; a failed read should never surface an error.
    }
  }
}))

/** Call after anything that may have spent tokens. */
export function refreshUsage(): void {
  void useUsageStore.getState().refresh()
}
