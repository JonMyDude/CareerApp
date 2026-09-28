import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

/**
 * Chakra tokens are deliberately thin wrappers over the CSS variables in
 * theme.css. Components reference them as `bg="app.surface"` and the actual
 * colour is resolved by CSS, which is what makes light/dark a pure CSS swap.
 */
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
          accentFg: { value: 'var(--app-accent-fg)' },
          danger: { value: 'var(--app-danger)' },
          dangerHover: { value: 'var(--app-danger-hover)' },
          dangerSubtle: { value: 'var(--app-danger-subtle)' },
          success: { value: 'var(--app-success)' },
          railBg: { value: 'var(--app-rail-bg)' },
          railHoverBg: { value: 'var(--app-rail-hover-bg)' },
          railIcon: { value: 'var(--app-rail-icon)' },
          railActiveBg: { value: 'var(--app-rail-active-bg)' },
          railActiveFg: { value: 'var(--app-rail-active-fg)' }
        }
      },
      shadows: {
        app: { value: 'var(--app-shadow)' }
      }
    }
  },
  globalCss: {
    'html, body': {
      fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif'
    },
    '*:focus-visible': {
      outline: '2px solid var(--app-focus-ring)',
      outlineOffset: '2px'
    }
  }
})

export const system = createSystem(defaultConfig, config)
