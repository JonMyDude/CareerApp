import { useEffect, useRef, useState } from 'react'
import { Box, Flex } from '@chakra-ui/react'
import { LuCheck, LuRefreshCw } from 'react-icons/lu'
import { refreshAll } from '../lib/refresh'

/** How far the finger travels, damped, before letting go refreshes. */
const TRIGGER = 70
const MAX_PULL = 110
/** How long the tick stays after a refresh before the indicator slides away. */
const DONE_MS = 700

/** idle: tucked away above the page. pulling: under the finger. */
type Phase = 'idle' | 'pulling' | 'refreshing' | 'done'

/**
 * Android's pull-to-refresh on the page's scroll area: pulling down from the
 * very top brings down a spinning arrow, letting go past the mark re-reads
 * everything from the cloud, and a tick confirms it before the indicator glides
 * back up. Nothing happens once the page is scrolled.
 *
 * Always mounted, so leaving can animate like arriving does.
 */
export default function PullToRefresh({
  scrollRef,
  enabled
}: {
  scrollRef: React.RefObject<HTMLElement | null>
  enabled: boolean
}): React.JSX.Element | null {
  const [pull, setPull] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  /** The tick stays on through the glide away, until the next pull. */
  const [ticked, setTicked] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !enabled) return
    let startY: number | null = null
    let distance = 0

    const onStart = (event: TouchEvent): void => {
      startY = element.scrollTop <= 0 && !busy.current ? event.touches[0].clientY : null
      distance = 0
    }
    const onMove = (event: TouchEvent): void => {
      if (startY === null) return
      // Damped, so the arrow lags the finger like the native gesture.
      distance = Math.min(MAX_PULL, Math.max(0, (event.touches[0].clientY - startY) * 0.5))
      if (element.scrollTop > 0) distance = 0
      setPull(distance)
      setPhase(distance > 0 ? 'pulling' : 'idle')
      if (distance > 0) setTicked(false)
    }
    const onEnd = async (): Promise<void> => {
      if (startY === null) return
      startY = null
      if (distance < TRIGGER) {
        setPhase('idle')
        return
      }
      busy.current = true
      setPhase('refreshing')
      try {
        await refreshAll(true)
      } finally {
        setTicked(true)
        setPhase('done')
        await new Promise((resolve) => setTimeout(resolve, DONE_MS))
        setPhase('idle')
        busy.current = false
      }
    }

    element.addEventListener('touchstart', onStart, { passive: true })
    element.addEventListener('touchmove', onMove, { passive: true })
    element.addEventListener('touchend', onEnd)
    element.addEventListener('touchcancel', onEnd)
    return () => {
      element.removeEventListener('touchstart', onStart)
      element.removeEventListener('touchmove', onMove)
      element.removeEventListener('touchend', onEnd)
      element.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef, enabled])

  if (!enabled) return null

  const pulling = phase === 'pulling'
  const shown = phase !== 'idle'
  // Under the finger while pulling, parked at the mark while working, and
  // tucked up out of sight otherwise.
  const y = pulling ? pull - 20 : shown ? TRIGGER - 20 : -56

  return (
    <Flex
      position="absolute"
      // Below the status bar, which Android draws over the page.
      top="env(safe-area-inset-top, 0px)"
      left="50%"
      zIndex="5"
      align="center"
      justify="center"
      boxSize="40px"
      borderRadius="full"
      bg="app.surface"
      borderWidth="1px"
      borderColor="app.border"
      boxShadow="app"
      color={ticked ? 'app.success' : pull >= TRIGGER || phase === 'refreshing' ? 'app.accent' : 'app.textMuted'}
      pointerEvents="none"
      aria-hidden={!shown}
      style={{
        transform: `translate(-50%, ${y}px) scale(${shown ? 1 : 0.6})`,
        opacity: pulling ? Math.min(1, pull / TRIGGER) : shown ? 1 : 0,
        // Follows the finger exactly; glides everywhere else, leaving included.
        transition: pulling ? undefined : 'transform 240ms ease, opacity 240ms ease, color 160ms ease'
      }}
    >
      {ticked ? (
        <LuCheck />
      ) : (
        // Only the arrow turns with the pull, and it keeps its angle after
        // letting go; the tick that replaces it stays upright.
        <Box
          as="span"
          display="flex"
          style={{ transform: `rotate(${pull * 4}deg)` }}
          css={phase === 'refreshing' ? { '& svg': { animation: 'app-spin 0.8s linear infinite' } } : undefined}
        >
          <LuRefreshCw />
        </Box>
      )}
    </Flex>
  )
}
