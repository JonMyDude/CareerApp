import { useMemo, useState } from 'react'
import { Box, Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuLightbulb } from 'react-icons/lu'
import { todayKey } from '@shared/date'
import { computeProgress, type InterestProgress } from '@shared/progress'
import { cycleProgress } from '@shared/shuffleBag'
import { IMPORTANCE_LABELS, type Importance, type Interest } from '@shared/types'
import AddInterestForm from '../components/AddInterestForm'
import ErrorBanner from '../components/ErrorBanner'
import InterestRow from '../components/InterestRow'
import Page from '../components/Page'
import SegmentedControl from '../components/SegmentedControl'
import { localDay, shortDate } from '../lib/dates'
import { useDailyStore } from '../store/useDailyStore'
import { useInterestsStore } from '../store/useInterestsStore'
import { fadeUp, listItem, springGentle } from '../theme/motion'
import { card, kicker } from '../theme/styles'

type LevelFilter = 'all' | Importance

const FILTER_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 3, label: IMPORTANCE_LABELS[3] },
  { value: 2, label: IMPORTANCE_LABELS[2] },
  { value: 1, label: IMPORTANCE_LABELS[1] }
]

/** Highest first. The hint is what the level does to the Daily picks. */
const GROUPS: { level: Importance; hint: string }[] = [
  { level: 3, hint: 'Picked most often' },
  { level: 2, hint: 'Regular picks' },
  { level: 1, hint: 'Now and then' }
]

/** "Last picked 26. sep. · 3 of 5 done", from the Daily history. */
function metaFor(interest: Interest, picks: InterestProgress | undefined): string {
  if (!picks) {
    const added = new Date(interest.createdAt)
    return `Added ${todayKey(added) === todayKey() ? 'today' : shortDate(added)} · not picked yet`
  }
  const picked = picks.lastDate === todayKey() ? 'Picked today' : `Last picked ${shortDate(localDay(picks.lastDate))}`
  return `${picked} · ${picks.done} of ${picks.total} done`
}

/** Three small bars, filled to the level, for the legend. */
function MiniBars({ level }: { level: Importance }): React.JSX.Element {
  return (
    <Flex align="flex-end" gap="2px" h="14px" flexShrink="0">
      {[1, 2, 3].map((bar) => (
        <Box key={bar} w="4px" h={`${2 + bar * 4}px`} borderRadius="2px" bg={bar <= level ? 'app.accent' : 'app.borderStrong'} />
      ))}
    </Flex>
  )
}

/**
 * Flat list with an importance level per interest, grouped by that level. Per
 * CLAUDE.md this tab is still dumb storage — no tree UI, no generated
 * breakdowns, no AI calls. The picks shown per row are read from the Daily tab's
 * history, not generated.
 */
export default function InterestsTab(): React.JSX.Element {
  const interests = useInterestsStore((state) => state.interests)
  const status = useInterestsStore((state) => state.status)
  const error = useInterestsStore((state) => state.error)
  const clearError = useInterestsStore((state) => state.clearError)
  const daily = useDailyStore((state) => state.result)
  const [level, setLevel] = useState<LevelFilter>('all')

  // Picks per interest, keyed by id — or by title, for entries saved before ids were.
  const picks = useMemo(() => {
    const entries = daily ? [...(daily.today ? [daily.today] : []), ...daily.history] : []
    return new Map(computeProgress(entries).byInterest.map((group) => [group.key, group]))
  }, [daily])
  const cycle = useMemo(
    () => (daily ? cycleProgress(interests, { drawn: daily.drawn }, (interest) => interest.importance) : null),
    [daily, interests]
  )

  const count = (value: Importance): number => interests.filter((interest) => interest.importance === value).length
  const noun = interests.length === 1 ? 'interest' : 'interests'
  const groups = GROUPS.filter((group) => level === 'all' || group.level === level)

  const aside = (
    <>
      {cycle && cycle.total > 0 && (
        <Box {...card} p="5" data-cycle>
          <Text {...kicker} mb="2.5">
            This cycle
          </Text>
          <Text fontSize="24px" fontWeight="800" lineHeight="1.1" color="app.text" fontVariantNumeric="tabular-nums">
            {cycle.drawn}
            <Text as="span" fontSize="14px" fontWeight="600" color="app.textFaint">
              {' '}
              of {cycle.total} picks
            </Text>
          </Text>
          <Box h="6px" mt="3" borderRadius="full" bg="app.border" overflow="hidden">
            <Box h="full" borderRadius="full" bg="app.accent" w={`${(cycle.drawn / cycle.total) * 100}%`} />
          </Box>
          <Text mt="3" fontSize="13px" lineHeight="1.6" color="app.textMuted">
            Each interest gets its share of Daily picks, High three, Medium two and Low one, before the cycle starts
            again.
          </Text>
        </Box>
      )}
      <Box {...card} p="5">
        <Text {...kicker} mb="3">
          Importance
        </Text>
        <Stack gap="2.5" fontSize="13px">
          {GROUPS.map((group) => (
            <Flex key={group.level} align="center" gap="2.5">
              <MiniBars level={group.level} />
              <Text fontWeight="600" w="56px" color="app.text">
                {IMPORTANCE_LABELS[group.level]}
              </Text>
              <Text color="app.textMuted">{group.hint}</Text>
            </Flex>
          ))}
        </Stack>
      </Box>
    </>
  )

  return (
    <Page
      eyebrow={
        interests.length === 0
          ? 'Nothing added yet'
          : `${interests.length} ${noun} · ${count(3)} high, ${count(2)} medium, ${count(1)} low`
      }
      title="Interests"
      // Filtering a list of one is pointless.
      actions={
        interests.length > 1 && (
          <SegmentedControl label="Importance" value={level} options={FILTER_OPTIONS} onChange={setLevel} />
        )
      }
      aside={aside}
    >
      <Stack gap="7">
        <AddInterestForm />

        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        {status === 'loading' && (
          <Flex justify="center" py="10">
            <Spinner color="app.accent" />
          </Flex>
        )}

        {status === 'ready' && interests.length === 0 && (
          // Enter-only: when an interest is added it just gives way to the new row.
          <motion.div variants={fadeUp} initial="hidden" animate="shown">
            <Flex
              direction="column"
              align="flex-start"
              gap="2"
              p="6"
              color="app.textMuted"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="app.borderStrong"
              borderRadius="14px"
            >
              <Box fontSize="22px" color="app.textFaint">
                <LuLightbulb />
              </Box>
              <Text fontWeight="600" color="app.text">
                No interests yet
              </Text>
              <Text fontSize="14px">Add the first thing you want to learn above. Daily picks from this list.</Text>
            </Flex>
          </motion.div>
        )}

        {interests.length > 0 &&
          groups.map((group) => {
            const items = interests.filter((interest) => interest.importance === group.level)
            return (
              <Stack as="section" key={group.level} gap="2.5" data-group={group.level}>
                <Flex align="baseline" gap="2.5">
                  <Heading as="h2" fontSize="16px" fontWeight="600" color="app.text" whiteSpace="nowrap">
                    {IMPORTANCE_LABELS[group.level]}
                  </Heading>
                  <Text fontSize="13px" color="app.textFaint">
                    {items.length}
                  </Text>
                  <Box flex="1" />
                  <Text fontSize="12px" color="app.textFaint" whiteSpace="nowrap">
                    {group.hint}
                  </Text>
                </Flex>

                <Box {...card} overflow="hidden">
                  {items.length === 0 && (
                    <Text px="4.5" py="4" fontSize="13px" color="app.textFaint">
                      Nothing here. Click a bar on any interest to move it.
                    </Text>
                  )}
                  {/* popLayout lifts a deleted row out of the flow so the rows below
                      close the gap by layout transform; it positions against this
                      relative box. initial={false}: rows there on load don't slide in. */}
                  <Box position="relative">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {items.map((interest, position) => (
                        <motion.div
                          key={interest.id}
                          layout
                          variants={listItem}
                          initial="hidden"
                          animate="shown"
                          exit="exit"
                          transition={{ layout: springGentle }}
                        >
                          <InterestRow
                            interest={interest}
                            first={position === 0}
                            meta={metaFor(interest, picks.get(interest.id) ?? picks.get(interest.title))}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </Box>
                </Box>
              </Stack>
            )
          })}
      </Stack>
    </Page>
  )
}
