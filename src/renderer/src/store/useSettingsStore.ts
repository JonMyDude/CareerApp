import { create } from 'zustand'
import type { SettingsInfo, SettingsPatch } from '@shared/types'
import { refreshUsage } from './useUsageStore'
import { ipcErrorMessage } from './ipcError'

/**
 * What the Settings page shows. Always the settings as saved on disk — every
 * change is sent to the main process, validated there, and the result read
 * back — so the page can't drift from config.json.
 *
 * `settings.get()` reports whether an API key exists, never the key itself.
 */
interface SettingsState {
  settings: SettingsInfo | null
  /** Why the last load failed, e.g. the desktop isn't connected to the cloud yet. */
  error: string | null
  load: () => Promise<void>
  /** Rejects with main's message when a value is refused; the page shows it by the field. */
  update: (patch: SettingsPatch) => Promise<void>
  saveApiKey: (key: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  error: null,

  load: async () => {
    try {
      set({ settings: await window.api.settings.get(), error: null })
    } catch (failure) {
      // Shown in place of the fields that need it; the Cloud section still works.
      set({ error: ipcErrorMessage(failure) })
    }
  },

  update: async (patch) => {
    set({ settings: await window.api.settings.update(patch) })
    // The token meter's bar is drawn against the budget.
    if (patch.dailyTokenBudget !== undefined) refreshUsage()
  },

  saveApiKey: async (key) => {
    await window.api.settings.setApiKey(key)
    set({ settings: await window.api.settings.get() })
  }
}))
