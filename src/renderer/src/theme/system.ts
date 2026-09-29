import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

/**
 * Chakra tokens are deliberately thin wrappers over the CSS variables in
 * theme.css. Components reference them as `bg="app.surface"` and the actual
 * colour is resolved by CSS, which is what makes light/dark a pure CSS swap.
 */

/** Archivo is bundled (see main.tsx), so the app never fetches a font. */
const FONT = '"Archivo Variable", Archivo, system-ui, "Segoe UI", sans-serif'

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        app: {
          bg: { value: 'var(--app-bg)' },
          surface: { value: 'var(--app-surface)' },
          surfaceSubtle: { value: 'var(--app-surface-subtle)' },
          surfaceHover: { value: 'var(--app-surface-hover)' },
          border: { value: 'var(--app-border)' },
          borderStrong: { value: 'var(--app-border-strong)' },
          text: { value: 'var(--app-text)' },
          textMuted: { value: 'var(--app-text-muted)' },
          textFaint: { value: 'var(--app-text-faint)' },
          accent: { value: 'var(--app-accent)' },
          accentHover: { value: 'var(--app-accent-hover)' },
          accentSubtle: { value: 'var(--app-accent-subtle)' },
          accentMuted: { value: 'var(--app-accent-muted)' },
          accentFg: { value: 'var(--app-accent-fg)' },
          danger: { value: 'var(--app-danger)' },
          dangerHover: { value: 'var(--app-danger-hover)' },
          dangerSubtle: { value: 'var(--app-danger-subtle)' },
          success: { value: 'var(--app-success)' },
          successSubtle: { value: 'var(--app-success-subtle)' },
          streak: { value: 'var(--app-streak)' },
          streakSubtle: { value: 'var(--app-streak-subtle)' },
          railBg: { value: 'var(--app-rail-bg)' },
          railHoverBg: { value: 'var(--app-rail-hover-bg)' },
          railIcon: { value: 'var(--app-rail-icon)' },
          railActiveBg: { value: 'var(--app-rail-active-bg)' },
          switchKnob: { value: 'var(--app-switch-knob)' }
        }
      },
      fonts: {
        heading: { value: FONT },
        body: { value: FONT }
      },
      shadows: {
        app: { value: 'var(--app-shadow)' }
      }
    },
    semanticTokens: {
      colors: {
        // Every Chakra focus ring reads this (colorPalette is gray). Its own
        // value is a fixed grey that ignores data-theme.
        gray: {
          focusRing: { value: 'var(--app-accent)' }
        }
      }
    }
  },
  globalCss: {
    'html, body': {
      fontFamily: FONT
    },
    body: {
      fontSize: '15px',
      lineHeight: '1.55'
    },
    '*:focus-visible': {
      outline: '2px solid var(--app-accent)',
      outlineOffset: '2px'
    }
  }
})

export const system = createSystem(defaultConfig, config)
