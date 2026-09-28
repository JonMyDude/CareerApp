import { useMemo, useState } from 'react'
import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuChevronDown, LuFlame } from 'react-icons/lu'
import type { DailyEntry } from '@shared/types'
import { computeProgress } from '@shared/progress'
import { fade } from '../theme/motion'

/**
 * Streak, done rate and the last 30 days, above the Daily feed. Everything is
 * worked out from the entries already on screen (see shared/progress.ts).
 */

const OPEN_KEY = 'career-app:progress-open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

/** One bar per day; brighter the more was finished. Colour stays the accent token. */
function ActivityRow({ days }: { days: { date: string; count: number }[] }): React.JSX.Element {
  const active = days.filter((day) => day.count > 0).length
  return (
    <Box>
      <Flex
        gap="3px"
        role="img"
        aria-label={`Active on ${active} of the last ${days.length} days`}
      >
        {days.map((day, index) => (
          <Box
            key={day.date}
            flex="1"
            h="8px"
            borderRadius="2px"
            bg={day.count > 0 ? 'app.accent' : 'app.surfaceHover'}
            opacity={day.count === 0 ? 1 : day.count === 1 ? 0.45 : day.count === 2 ? 0.7 : 1}
            // Today is outlined, so an empty today reads as "still to do".
            outline={index === days.length - 1 ? '1px solid' : undefined}
            outlineColor="app.accent"
            outlineOffset="1px"
            title={`${dayLabel(day.date)}: ${day.count === 0 ? 'nothing done' : `${day.count} done`}`}
          />
        ))}
      </Flex>
      <Flex justify="space-between" mt="1" fontSize="10px" color="app.textFaint">
        <Text>Last {days.length} days</Text>
        <Text>today</Text>
      </Flex>
    </Box>
  )
}

export default function ProgressStrip({ entries }: { entries: DailyEntry[] }): React.JSX.Element | null {
  const progress = useMemo(() => computeProgress(entries), [entries])
  const [open, setOpen] = useState(readOpen)

  if (progress.total === 0) return null

  const { currentStreak, doneToday, longestStreak, done, total, byInterest, mostSkipped } = progress
  const rate = Math.round((done / total) * 100)
  const streakHint =
    currentStreak === 0
      ? 'Tick a suggestion off to start one'
      : doneToday
        ? 'Today counts'
        : 'Tick one off today to keep it'

  function toggle(): void {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0')
    } catch {
      // Only a convenience; the strip still works.
    }
  }

  return (
    <Box
      data-progress
      bg="app.surface"
      borderWidth="1px"
      borderColor="app.border"
      borderRadius="md"
      px="4"
      py="3"
    >
      <Flex align="center" gap="4">
        <Flex align="center" gap="2.5" minW="0">
          <Box
            fontSize="xl"
            // Lit while the streak is safe for today, dimmed while it still needs today.
            color={currentStreak === 0 ? 'app.textFaint' : doneToday ? 'app.accent' : 'app.textMuted'}
          >
            <LuFlame />
          </Box>
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium" color="app.text" data-streak>
              {currentStreak === 0 ? 'No streak yet' : `${currentStreak}-day streak`}
            </Text>
            <Text fontSize="xs" color="app.textFaint" truncate>
              {streakHint}
            </Text>
          </Box>
        </Flex>

        <Box w="1px" alignSelf="stretch" bg="app.border" />

        <Box>
          <Text fontSize="sm" fontWeight="medium" color="app.text" data-done>
            {done} of {total} done
          </Text>
          <Text fontSize="xs" color="app.textFaint">
            {rate}% finished
          </Text>
        </Box>

        <Box flex="1" />

        <Button
          size="xs"
          variant="ghost"
          color="app.textMuted"
          _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
          // Chakra's own expanded style is a light-palette grey that ignores
          // our data-theme, so it would glow white in dark mode.
          _expanded={{ bg: 'app.surfaceHover', color: 'app.text' }}
          aria-expanded={open}
          onClick={toggle}
        >
          Details
          <Box
            as="span"
            display="flex"
            transition="transform 160ms ease"
            transform={open ? 'rotate(180deg)' : undefined}
          >
            <LuChevronDown />
          </Box>
        </Button>
      </Flex>

      <Box mt="3">
        <ActivityRow days={progress.lastDays} />
      </Box>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={fade}
            style={{ overflow: 'hidden' }}
          >
            <Box mt="3" pt="3" borderTopWidth="1px" borderColor="app.border" data-details>
              <Flex gap="6" wrap="wrap" mb="3" fontSize="xs" color="app.textMuted">
                <Text>
                  Longest streak{' '}
                  <Text as="span" color="app.text" fontWeight="medium">
                    {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
                  </Text>
                </Text>
                {mostSkipped && (
                  <Text>
                    Most skipped{' '}
                    <Text as="span" color="app.text" fontWeight="medium">
                      {mostSkipped.title}
                    </Text>{' '}
                    ({mostSkipped.total - mostSkipped.done} not done)
                  </Text>
                )}
              </Flex>
              <Stack gap="2">
                {byInterest.map((group) => (
                  <Flex key={group.title} align="center" gap="3" fontSize="xs">
                    <Text w="180px" flexShrink="0" truncate color="app.text" title={group.title}>
                      {group.title}
                    </Text>
                    <Box flex="1" h="6px" borderRadius="full" bg="app.surfaceHover" overflow="hidden">
                      <Box
                        h="full"
                        borderRadius="full"
                        bg="app.success"
                        w={`${(group.done / group.total) * 100}%`}
                      />
                    </Box>
                    <Text w="44px" flexShrink="0" textAlign="right" color="app.textMuted">
                      {group.done}/{group.total}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
