import { join } from 'node:path'
import { app, type BrowserWindow } from 'electron'
import type { FrameColors } from '@shared/types'
import { createQueue, readJson, writeJsonAtomic } from './jsonFile'

/**
 * The window frame follows the app theme.
 *
 * The native title bar is hidden (`titleBarStyle: 'hidden'`), which drops its
 * icon and "Career App" text; Electron draws the three caption buttons itself,
 * in colours passed here. Those colours are defined in theme.css like every
 * other — the renderer reads the CSS variables and sends them — and the last
 * set is cached, so the next launch opens in the right colours instead of
 * flashing the light theme before the page paints.
 */

/** Height of the caption-button strip, in px. It sits in the in-app header's top-right corner. */
export const TITLE_BAR_HEIGHT = 40

/**
 * First run only, before the renderer has ever reported its colours. Mirrors
 * the light --app-surface, --app-text-muted and --app-bg in theme.css; the
 * renderer's values replace these on the first paint.
 */
const FIRST_RUN: FrameColors = { background: '#ffffff', symbols: '#656e7a', appBg: '#f5f6f8' }

const HEX = /^#[0-9a-f]{6}$/i
const queue = createQueue()
let current: FrameColors = FIRST_RUN

function filePath(): string {
  return join(app.getPath('userData'), 'window-theme.json')
}

/** Three #rrggbb colours, or null — anything else is refused rather than passed to the OS. */
function validColors(raw: unknown): FrameColors | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const pick = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
  const colors = {
    background: pick(record.background),
    symbols: pick(record.symbols),
    appBg: pick(record.appBg)
  }
  return Object.values(colors).every((value) => HEX.test(value)) ? colors : null
}

/** The colours to open the window with: the last reported set, or the first-run fallback. */
export async function loadWindowTheme(): Promise<FrameColors> {
  current = validColors(await readJson(filePath())) ?? FIRST_RUN
  return current
}

/** Recolour a live window, and remember the colours for the next launch. */
export async function applyWindowTheme(window: BrowserWindow, raw: unknown): Promise<void> {
  const colors = validColors(raw)
  // Purely cosmetic: a bad value leaves the frame as it was rather than failing.
  if (!colors || window.isDestroyed()) return

  window.setTitleBarOverlay({
    color: colors.background,
    symbolColor: colors.symbols,
    height: TITLE_BAR_HEIGHT
  })
  window.setBackgroundColor(colors.appBg)

  // Sent on every launch; only a real change is worth a write.
  const unchanged =
    colors.background === current.background &&
    colors.symbols === current.symbols &&
    colors.appBg === current.appBg
  if (unchanged) return
  current = colors
  await queue(() => writeJsonAtomic(filePath(), colors))
}
