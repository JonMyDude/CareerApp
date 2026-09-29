/**
 * The recurring pieces of the look, as Chakra style props to spread onto an
 * element: `<Box {...card} p="5">`. Like everything else they only name app.*
 * tokens, so colour still lives in theme.css alone.
 *
 * Buttons are Chakra's solid Button with these overrides. Anything that sets
 * aria-expanded also needs an `_expanded` of its own, or Chakra paints its
 * light-palette grey over it in dark mode.
 */

/**
 * `display` for the rail's text. It shows from Chakra's `lg` breakpoint
 * (1024px) up; below that the rail folds to its icons.
 */
export const wideRailOnly = { base: 'none', lg: 'block' } as const

/** Every list, card and side panel. */
export const card = {
  bg: 'app.surface',
  borderWidth: '1px',
  borderColor: 'app.border',
  borderRadius: '14px'
} as const

/** The small uppercase label over a card ("Progress", "Key concepts"). */
export const kicker = {
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'app.textFaint'
} as const

/** The one filled action in a view. */
export const primaryButton = {
  bg: 'app.accent',
  color: 'app.accentFg',
  fontWeight: '700',
  borderRadius: '9px',
  _hover: { bg: 'app.accentHover' }
} as const

/** Outlined, for the choice next to a primary. */
export const secondaryButton = {
  bg: 'transparent',
  color: 'app.text',
  fontWeight: '600',
  borderWidth: '1px',
  borderColor: 'app.borderStrong',
  borderRadius: '9px',
  _hover: { bg: 'app.surfaceHover' }
} as const

/** No frame until hovered: back links, Regenerate, Skip. */
export const quietButton = {
  bg: 'transparent',
  color: 'app.textMuted',
  fontWeight: '600',
  borderRadius: '8px',
  _hover: { bg: 'app.surfaceHover', color: 'app.text' }
} as const

/** A square icon action. Override `_hover.color` for accent or danger actions. */
export const iconButton = {
  bg: 'transparent',
  color: 'app.textFaint',
  borderRadius: '8px',
  _hover: { bg: 'app.surfaceHover', color: 'app.text' }
} as const

/** Text inputs and selects. */
export const field = {
  bg: 'app.surface',
  color: 'app.text',
  borderColor: 'app.border',
  borderRadius: '9px',
  _placeholder: { color: 'app.textFaint' },
  _hover: { borderColor: 'app.borderStrong' }
} as const
