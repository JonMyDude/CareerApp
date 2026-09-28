import { create } from 'zustand'

export type ColorModePreference = 'light' | 'dark' | 'system'
export type ResolvedColorMode = 'light' | 'dark'

const STORAGE_KEY = 'career-app:color-mode'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ColorModePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

/** Resolves 'system' here rather than in CSS, so theme.css only needs one light and one dark block. */
function resolve(preference: ColorModePreference): ResolvedColorMode {
  if (preference !== 'system') return preference
  return systemDark.matches ? 'dark' : 'light'
}

/**
 * The window's caption buttons are drawn by Electron, outside the page, so
 * they can't use CSS. Read their colours from theme.css and hand them over —
 * that way the frame has no colour of its own to keep in sync.
 */
function syncFrame(): void {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string): string => styles.getPropertyValue(name).trim()
  const colors = {
    background: read('--app-surface'),
    symbols: read('--app-text-muted'),
    appBg: read('--app-bg')
  }
  // Empty until theme.css has loaded; the next change carries them instead.
  if (!colors.background) return
  void window.api.frame.setTheme(colors).catch(() => {
    // Cosmetic only — the page itself is already themed.
  })
}

function apply(mode: ResolvedColorMode): void {
  document.documentElement.dataset.theme = mode
  // Deferred a task: in dev, theme.css is injected by a module that evaluates
  // after this one, so at startup its variables aren't readable yet.
  setTimeout(syncFrame, 0)
}

interface ColorModeState {
  /** What the user chose, which may be 'system'. */
  preference: ColorModePreference
  /** What is actually on screen. */
  resolved: ResolvedColorMode
  setPreference: (preference: ColorModePreference) => void
  /** Flip between light and dark, leaving 'system' behind. */
  toggle: () => void
}

/**
 * One theme state for the whole app — the rail's toggle and the Settings page
 * both read and change it. A hook with local state would give each its own copy.
 */
export const useColorMode = create<ColorModeState>((set, get) => ({
  preference: readPreference(),
  resolved: resolve(readPreference()),

  setPreference: (preference) => {
    localStorage.setItem(STORAGE_KEY, preference)
    const resolved = resolve(preference)
    set({ preference, resolved })
    apply(resolved)
  },

  toggle: () => get().setPreference(get().resolved === 'dark' ? 'light' : 'dark')
}))

// Stamped at import, before the first render, so the wrong palette never shows.
apply(useColorMode.getState().resolved)

// 'System' follows Windows live.
systemDark.addEventListener('change', () => {
  if (useColorMode.getState().preference !== 'system') return
  const resolved = resolve('system')
  useColorMode.setState({ resolved })
  apply(resolved)
})
