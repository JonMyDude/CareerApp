import { useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavStore } from '../store/useNavStore'
import { useUsageStore } from '../store/useUsageStore'
import { popIn } from '../theme/motion'

/**
 * Gemini tokens spent today, in the side rail.
 *
 * Google exposes no per-key quota endpoint, so there is no "% of your limit" to
 * show unless the user sets a daily budget in Settings. Without one there is no
 * bar and the number carries the meaning — better than inventing a ceiling and
 * implying it is real.
 */

function compact(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(tokens < 10_000 ? 1 : 0)}k`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <Flex justify="space-between" gap="4" fontSize="xs">
      <Text color="app.textMuted">{label}</Text>
      <Text color="app.text">{value}</Text>
    </Flex>
  )
}

export default function UsageMeter(): React.JSX.Element | null {
  const usage = useUsageStore((state) => state.usage)
  const refresh = useUsageStore((state) => state.refresh)
  const setTab = useNavStore((state) => state.setTab)
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Close on an outside click or Escape — the panel is a plain div, not a
  // managed popover, so it has to handle dismissal itself.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent): void => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!usage) return null

  const { totalTokens, budget } = usage
  const hasBudget = typeof budget === 'number' && budget > 0
  const fraction = hasBudget ? Math.min(1, totalTokens / budget) : null
  const overBudget = hasBudget && totalTokens >= budget

  return (
    <Box position="relative" ref={wrapper}>
      <Flex
        as="button"
        aria-label={`Gemini tokens used today: ${totalTokens.toLocaleString()}`}
        aria-expanded={open}
        title="Gemini tokens used today"
        onClick={() => {
          if (!open) void refresh()
          setOpen((value) => !value)
        }}
        direction="column"
        align="center"
        gap="1"
        w="42px"
        py="1.5"
        borderRadius="8px"
        cursor="pointer"
        _hover={{ bg: 'app.railHoverBg' }}
      >
        <Text fontSize="10px" lineHeight="1" color="app.railIcon" fontWeight="medium">
          {compact(totalTokens)}
        </Text>
        {/* No budget, no bar: an always-empty track reads as broken, and a
            filled one would imply a ceiling that does not exist. */}
        {fraction !== null && (
          <Box w="26px" h="3px" borderRadius="full" bg="app.railHoverBg" overflow="hidden">
            <Box
              h="full"
              borderRadius="full"
              w={`${Math.max(4, fraction * 100)}%`}
              bg={overBudget ? 'app.danger' : 'app.accent'}
            />
          </Box>
        )}
      </Flex>

      <AnimatePresence>
        {open && (
          <motion.div
            key="usage-panel"
            variants={popIn}
            initial="hidden"
            animate="shown"
            exit="exit"
            // Grows out of the rail button it belongs to.
            style={{
              position: 'absolute',
              bottom: 0,
              left: 'calc(100% + 8px)',
              zIndex: 10,
              transformOrigin: 'bottom left'
            }}
          >
            <Box
              w="230px"
              p="3"
              bg="app.surface"
              borderWidth="1px"
              borderColor="app.border"
              borderRadius="md"
              boxShadow="app"
            >
              <Text fontSize="xs" fontWeight="medium" color="app.text" mb="0.5">
                Gemini today
              </Text>
              <Text fontSize="lg" fontWeight="medium" color="app.text" lineHeight="1.2">
                {totalTokens.toLocaleString()}
              </Text>
              <Text fontSize="10px" color="app.textFaint" mb="3">
                tokens · {usage.requests} {usage.requests === 1 ? 'call' : 'calls'}
              </Text>

              <Box borderTopWidth="1px" borderColor="app.border" pt="2">
                <Row label="Input" value={usage.promptTokens.toLocaleString()} />
                <Row
                  label="Output"
                  value={(usage.outputTokens + usage.thoughtTokens).toLocaleString()}
                />
                <Row label="Daily suggestion" value={compact(usage.byFeature.daily)} />
                <Row label="Questions" value={compact(usage.byFeature.quiz)} />
                <Row label="Explanations" value={compact(usage.byFeature.explain)} />
              </Box>

              <Text fontSize="10px" color="app.textFaint" mt="3" lineHeight="1.5">
                {hasBudget
                  ? `${Math.round((totalTokens / budget) * 100)}% of ${compact(budget)} · resets at midnight`
                  : 'Resets at midnight. Google exposes no quota to read, so there is no bar until you set a budget of your own.'}
              </Text>
              <Button
                variant="plain"
                size="2xs"
                px="0"
                h="auto"
                mt="1"
                fontSize="10px"
                color="app.accent"
                _hover={{ textDecoration: 'underline' }}
                onClick={() => {
                  setOpen(false)
                  setTab('settings')
                }}
              >
                {hasBudget ? 'Change budget in Settings' : 'Set a budget in Settings'}
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
