import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/**
 * Motion presets — the animation equivalent of theme.css. Components take their
 * timing from here, so the feel of the whole app is tuned in one place.
 *
 * Purposeful, not playful: every animation explains a state change, and none
 * runs longer than ~250 ms. Transform and opacity only — layout reflow uses
 * Motion's `layout`, which also animates through transforms.
 *
 * Reduced motion is handled once, by <MotionConfig reducedMotion="user"> in
 * main.tsx, which drops transform and layout animation and keeps the fades.
 */

/** Quick and settled — for things the user just caused. */
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }

/** Softer — for layout reflow, where a hard stop reads as a jolt. */
export const springGentle: Transition = { type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }

/** A short tween, for opacity-only changes. */
export const fade: Transition = { duration: 0.16, ease: 'easeOut' }

/** Enter from slightly below; leave by fading out. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, transition: fade }
}

/** A plain crossfade, for swapping one whole screen for another. */
export const crossfade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: fade },
  exit: { opacity: 0, transition: fade }
}

/** Question to question: the old one leaves left, the new one arrives from the right. */
export const slideAcross: Variants = {
  hidden: { opacity: 0, x: 24 },
  shown: { opacity: 1, x: 0, transition: springSnappy },
  exit: { opacity: 0, x: -24, transition: fade }
}

/**
 * A row in a list. Pair with <AnimatePresence mode="popLayout"> and `layout` on
 * each row: a leaving row is lifted out of the flow and its siblings close the
 * gap through layout transforms — no height animation, so no reflow per frame.
 * The list container must be `position: relative` for popLayout to place it.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, scale: 0.98, transition: fade }
}

/** A popover growing out of the element that opened it. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  shown: { opacity: 1, scale: 1, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, transition: fade }
}

/** A wrong answer: a short horizontal shake. */
export const shake: TargetAndTransition = {
  x: [0, -8, 8, -5, 5, 0],
  transition: { duration: 0.36, ease: 'easeInOut' }
}

/** A confirmed answer or a ticked box: a small scale bump. */
export const pop: TargetAndTransition = {
  scale: [1, 1.04, 1],
  transition: { duration: 0.28, ease: 'easeOut' }
}

/**
 * Ticking a checkbox. Stronger than `pop` because the target is tiny: a 4%
 * bump on a 20px box moves less than a pixel.
 */
export const tick: TargetAndTransition = {
  scale: [1, 1.25, 1],
  transition: { duration: 0.26, ease: 'easeOut' }
}

/** Resting state for anything that can shake or pop. */
export const rest: TargetAndTransition = { x: 0, scale: 1 }
