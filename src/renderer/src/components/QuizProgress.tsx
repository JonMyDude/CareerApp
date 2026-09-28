import { useEffect, useRef } from 'react'
import { Box } from '@chakra-ui/react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

interface Props {
  /** Questions answered so far. */
  answered: number
  total: number
}

/**
 * Duolingo-style progress bar: a rounded track with a spring-driven blue fill
 * and a soft highlight along its top edge.
 *
 * The fill advances the moment an answer is given rather than on "Naprej", so
 * the click itself has visible feedback.
 *
 * Driven through a motion value rather than the `animate` prop: the target is
 * set from an effect, so nothing is mutated during render. An earlier version
 * tracked the previous value in a ref read during render, and React's
 * double-invoked render left the fill stuck a step behind the real progress.
 */
export default function QuizProgress({ answered, total }: Props): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const fraction = total > 0 ? Math.min(1, Math.max(0, answered / total)) : 0

  const target = useMotionValue(fraction)
  const spring = useSpring(target, { stiffness: 190, damping: 24, mass: 0.6 })
  const width = useTransform(spring, (value) => `${Math.min(1, Math.max(0, value)) * 100}%`)

  const previous = useRef(fraction)

  useEffect(() => {
    // A new round drops progress back to zero. Sliding backwards looks like a
    // mistake, so only growth is animated — a reset snaps.
    const wentBackwards = fraction < previous.current
    previous.current = fraction

    target.set(fraction)
    if (wentBackwards || reduceMotion) spring.jump(fraction)
  }, [fraction, reduceMotion, spring, target])

  return (
    <Box
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={answered}
      aria-label={`Napredek: ${answered} od ${total}`}
      position="relative"
      w="full"
      h="14px"
      borderRadius="full"
      bg="app.surfaceHover"
      overflow="hidden"
    >
      <motion.div
        style={{
          width,
          position: 'relative',
          height: '100%',
          borderRadius: '9999px',
          background: 'var(--app-accent)'
        }}
      >
        {/* Duolingo's signature highlight, inset so it stays inside the cap. */}
        {fraction > 0 && (
          <Box
            position="absolute"
            top="3px"
            left="6px"
            right="6px"
            h="3px"
            borderRadius="full"
            bg="rgba(255, 255, 255, 0.45)"
            pointerEvents="none"
          />
        )}
      </motion.div>
    </Box>
  )
}
