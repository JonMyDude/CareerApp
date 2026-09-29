import { useState } from 'react'
import { Box, chakra, Flex, Grid, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuChevronDown, LuFlame } from 'react-icons/lu'
import type { Progress } from '@shared/progress'
import { localDay } from '../lib/dates'
import { fade, pop, rest } from '../theme/motion'
import { card, kicker } from '../theme/styles'

/**
 * Streak, done rate and the last 30 days, beside the Daily feed. Everything is
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
  return localDay(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * The current streak, under the progress card. The flame burns while today
 * already counts, glows dimmer while the streak still needs today, and is out
 * when there is no streak.
 */
export function StreakCard({ progress }: { progress: Progress }): React.JSX.Element | null {
  const { currentStreak, doneToday, total } = progress
  if (total === 0) return null

  const alive = currentStreak > 0
  const hint = !alive
    ? 'Tick a suggestion off to start one'
    : doneToday
      ? 'Today counts'
      : 'Tick one off today to keep it'

  return (
    <Flex {...card} align="center" gap="4" p="5" data-streak>
      {/* Pops when today's tick lights it; initial={false}, so not on load. */}
      <motion.div initial={false} animate={doneToday ? pop : rest} style={{ display: 'flex', flexShrink: 0 }}>
        <Flex
          align="center"
          justify="center"
          boxSize="48px"
          borderRadius="12px"
          fontSize="26px"
          bg={alive ? 'app.streakSubtle' : 'app.surfaceHover'}
          color={alive ? 'app.streak' : 'app.textFaint'}
          opacity={alive && !doneToday ? 0.6 : 1}
          transition="background-color 200ms ease, color 200ms ease, opacity 200ms ease"
        >
          <LuFlame />
        </Flex>
      </motion.div>
      <Box minW="0">
        {alive ? (
          <Text fontSize="24px" fontWeight="800" lineHeight="1.1" color="app.text" fontVariantNumeric="tabular-nums">
            {currentStreak}
            <Text as="span" fontSize="14px" fontWeight="600" color="app.textFaint">
              {' '}
              {currentStreak === 1 ? 'day' : 'days'} in a row
            </Text>
          </Text>
        ) : (
          <Text fontSize="15px" fontWeight="600" color="app.text">
            No streak yet
          </Text>
        )}
        <Text fontSize="12px" color="app.textMuted" mt="0.5">
          {hint}
        </Text>
      </Box>
    </Flex>
  )
}

function Stat({ value, unit, label }: { value: React.ReactNode; unit?: string; label: string }): React.JSX.Element {
  return (
    <Box>
      <Text fontSize="24px" fontWeight="800" lineHeight="1.1" color="app.text" fontVariantNumeric="tabular-nums">
        {value}
        {unit && (
          <Text as="span" fontSize="14px" fontWeight="600" color="app.textFaint">
            {unit}
          </Text>
        )}
      </Text>
      <Text fontSize="12px" color="app.textMuted">
        {label}
      </Text>
    </Box>
  )
}

/** One square per day, oldest first, ten to a row; brighter the more was finished. */
function ActivityGrid({ days }: { days: Progress['lastDays'] }): React.JSX.Element {
  const active = days.filter((day) => day.count > 0).length
  return (
    <Box mt="4.5">
      <Grid
        templateColumns="repeat(10, minmax(0, 1fr))"
        gap="1"
        role="img"
        aria-label={`Active on ${active} of the last ${days.length} days`}
      >
        {days.map((day, index) => (
          <Box
            key={day.date}
            aspectRatio="1"
            borderRadius="4px"
            bg={day.count === 0 ? 'app.border' : day.count === 1 ? 'app.accentMuted' : 'app.accent'}
            // Today is ringed, so an empty today reads as "still to do".
            boxShadow={index === days.length - 1 ? '0 0 0 1.5px var(--app-accent)' : undefined}
            title={`${dayLabel(day.date)}: ${day.count === 0 ? 'nothing done' : `${day.count} done`}`}
          />
        ))}
      </Grid>
      <Flex justify="space-between" mt="1.5" fontSize="11px" color="app.textFaint">
        <Text>Last {days.length} days</Text>
        <Text>Today</Text>
      </Flex>
    </Box>
  )
}

export default function ProgressCard({ progress }: { progress: Progress }): React.JSX.Element | null {
  const [open, setOpen] = useState(readOpen)

  if (progress.total === 0) return null

  const { longestStreak, done, total, byInterest, mostSkipped } = progress

  function toggle(): void {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0')
    } catch {
      // Only a convenience; the card still works.
    }
  }

  return (
    <Box {...card} p="5" data-progress>
      <Text {...kicker} mb="3.5">
        Progress
      </Text>
      <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap="2">
        <Stat value={<span data-done>{done}</span>} unit={`/${total}`} label="done" />
        <Stat value={`${Math.round((done / total) * 100)}%`} label="finished" />
        <Stat value={longestStreak} unit="d" label="best streak" />
      </Grid>

      <ActivityGrid days={progress.lastDays} />

      <chakra.button
        type="button"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        w="full"
        mt="3.5"
        pt="2.5"
        borderTopWidth="1px"
        borderColor="app.border"
        color="app.textMuted"
        fontSize="13px"
        fontWeight="600"
        cursor="pointer"
        _hover={{ color: 'app.text' }}
        aria-expanded={open}
        onClick={toggle}
      >
        By interest
        <Box as="span" display="flex" transition="transform 160ms ease" transform={open ? 'rotate(180deg)' : undefined}>
          <LuChevronDown />
        </Box>
      </chakra.button>

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
            <Stack gap="2.5" mt="3" data-details>
              {byInterest.map((group) => (
                <Box key={group.key} fontSize="12px">
                  <Flex justify="space-between" gap="2" mb="1">
                    <Text truncate color="app.text" title={group.title}>
                      {group.title}
                    </Text>
                    <Text flexShrink="0" color="app.textFaint" fontVariantNumeric="tabular-nums">
                      {group.done}/{group.total}
                    </Text>
                  </Flex>
                  <Box h="5px" borderRadius="full" bg="app.border" overflow="hidden">
                    <Box h="full" borderRadius="full" bg="app.success" w={`${(group.done / group.total) * 100}%`} />
                  </Box>
                </Box>
              ))}
              {mostSkipped && (
                <Text fontSize="12px" color="app.textFaint">
                  Most skipped:{' '}
                  <Text as="span" color="app.textMuted">
                    {mostSkipped.title}
                  </Text>{' '}
                  ({mostSkipped.total - mostSkipped.done} not done)
                </Text>
              )}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
