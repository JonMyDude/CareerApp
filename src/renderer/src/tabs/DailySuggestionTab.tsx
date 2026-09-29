import { useEffect, useMemo, useState } from 'react'
import { Box, Button, chakra, Flex, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuLightbulb, LuRefreshCw, LuSettings } from 'react-icons/lu'
import { computeProgress } from '@shared/progress'
import ApiKeyPanel from '../components/ApiKeyPanel'
import DailyActions from '../components/DailyActions'
import ErrorBanner from '../components/ErrorBanner'
import HistoryFilter from '../components/HistoryFilter'
import Page, { SectionTitle } from '../components/Page'
import ProgressCard, { StreakCard } from '../components/ProgressCard'
import SuggestionCard, { HistoryRow } from '../components/SuggestionCard'
import {
  EMPTY_FILTER,
  fold,
  interestOptions,
  isFiltering,
  matchesFilter,
  useDebounced,
  type HistoryFilterState
} from '../lib/historyFilter'
import { useDailyStore } from '../store/useDailyStore'
import { useExplainStore } from '../store/useExplainStore'
import { useNavStore } from '../store/useNavStore'
import { crossfade, fadeUp, listItem, springGentle } from '../theme/motion'
import { card, quietButton, secondaryButton } from '../theme/styles'

/**
 * One interest a day with an AI-generated thing to do about it: today's card
 * on top, every earlier suggestion in a list beneath it, and progress, the
 * reminder and the export beside them.
 */
export default function DailySuggestionTab(): React.JSX.Element {
  const { result, status, error, load, retry, reroll, setDone, setNote, remove } = useDailyStore()
  const openExplanation = useExplainStore((state) => state.open)
  const setTab = useNavStore((state) => state.setTab)
  const [filter, setFilter] = useState<HistoryFilterState>(EMPTY_FILTER)
  // Filtering waits until typing pauses, so the list settles once, not per key.
  const query = useDebounced(filter.query, 150)

  useEffect(() => {
    void load()
  }, [load])

  const busy = status === 'loading' || status === 'generating'
  const today = result?.today ?? null
  const hasTodayCard = Boolean(today?.suggestion)
  // Memoised so the progress and the filter only recompute when entries change.
  const history = useMemo(() => result?.history ?? [], [result])
  const progress = useMemo(
    () => computeProgress(result ? [...(result.today ? [result.today] : []), ...result.history] : []),
    [result]
  )

  // The filter as applied: the raw query is swapped for the debounced one.
  const applied = useMemo<HistoryFilterState>(
    () => ({ interest: filter.interest, status: filter.status, query }),
    [filter.interest, filter.status, query]
  )
  const filtering = isFiltering(applied)
  const visibleHistory = useMemo(
    () => (filtering ? history.filter((entry) => matchesFilter(entry, applied)) : history),
    [history, applied, filtering]
  )
  const options = useMemo(() => interestOptions(history), [history])
  // A new filter crossfades the whole list instead of animating every row out.
  const filterKey = `${applied.interest}|${applied.status}|${fold(applied.query.trim())}`
  const noun = history.length === 1 ? 'suggestion' : 'suggestions'

  const handlersFor = (id: string) => ({
    onToggleDone: (done: boolean) => void setDone(id, done),
    onSaveNote: (note: string) => setNote(id, note),
    onExplain: () => void openExplanation(id)
  })

  return (
    <Page
      eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      title="Today's suggestion"
      aside={
        <>
          <ProgressCard progress={progress} />
          <StreakCard progress={progress} />
          <DailyActions total={progress.total} />
        </>
      }
    >
      <Stack gap="8">
        {(error || (!busy && status === 'error')) && (
          <Stack gap="3">
            {error && <ErrorBanner message={error} />}
            {/* Right under the banner: at the bottom of a long feed it went unseen. */}
            {!busy && status === 'error' && (
              <Flex gap="2">
                <Button h="36px" px="3.5" gap="2" {...secondaryButton} onClick={() => void retry()}>
                  <LuRefreshCw /> Try again
                </Button>
                {/* A rejected key or a wrong model name is fixed there. */}
                <Button h="36px" px="3.5" gap="2" {...quietButton} onClick={() => setTab('settings')}>
                  <LuSettings /> Open Settings
                </Button>
              </Flex>
            )}
          </Stack>
        )}

        {!busy && result?.state === 'no-interests' && history.length === 0 && (
          <Flex {...card} direction="column" align="flex-start" gap="2" p="6" color="app.textMuted">
            <Box fontSize="22px" color="app.textFaint">
              <LuLightbulb />
            </Box>
            <Text fontWeight="600" color="app.text">
              Nothing to suggest yet
            </Text>
            <Text fontSize="14px">Add an interest and a suggestion will appear here.</Text>
            <Button h="36px" px="3.5" mt="2" {...secondaryButton} onClick={() => setTab('interests')}>
              Add an interest
            </Button>
          </Flex>
        )}

        {!busy && result?.state === 'no-api-key' && <ApiKeyPanel variant="setup" />}

        {/* The top slot: a spinner while today generates, otherwise today's card.
            One presence group, so a reroll crossfades card → spinner → new card. */}
        <AnimatePresence mode="wait" initial={false}>
          {busy ? (
            <motion.div key="busy" variants={crossfade} initial="hidden" animate="shown" exit="exit">
              <Flex {...card} align="center" gap="3" p="6" color="app.textMuted">
                <Spinner color="app.accent" size="sm" />
                <Text fontSize="14px">
                  {status === 'generating' ? 'Thinking of something for today…' : 'Loading…'}
                </Text>
              </Flex>
            </motion.div>
          ) : hasTodayCard && today ? (
            <motion.div key={today.id} variants={fadeUp} initial="hidden" animate="shown" exit="exit">
              <SuggestionCard entry={today} onReroll={() => void reroll()} {...handlersFor(today.id)} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* History stays put while today generates — only the top slot is busy. */}
        {history.length > 0 && (
          <Stack as="section" gap="3">
            <SectionTitle
              title="Earlier suggestions"
              meta={filtering ? `${visibleHistory.length} of ${history.length}` : `${history.length} ${noun}`}
            />
            {/* Filtering a list of one is pointless. */}
            {history.length > 1 && <HistoryFilter value={filter} onChange={setFilter} options={options} />}

            <Box {...card} overflow="hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={filterKey} variants={crossfade} initial="hidden" animate="shown" exit="exit">
                  {visibleHistory.length === 0 ? (
                    <Text px="4.5" py="8" fontSize="14px" color="app.textMuted" data-no-match>
                      No suggestions match.{' '}
                      <chakra.button
                        type="button"
                        color="app.accent"
                        cursor="pointer"
                        _hover={{ color: 'app.accentHover', textDecoration: 'underline' }}
                        onClick={() => setFilter(EMPTY_FILTER)}
                      >
                        Clear filters
                      </chakra.button>
                    </Text>
                  ) : (
                    // popLayout lifts a leaving row out of the flow so the rest close the
                    // gap by layout transform; it positions against this relative box.
                    <Box position="relative">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {visibleHistory.map((entry, position) => (
                          <motion.div
                            key={entry.id}
                            layout
                            variants={listItem}
                            initial="hidden"
                            animate="shown"
                            exit="exit"
                            transition={{ layout: springGentle }}
                          >
                            <HistoryRow
                              entry={entry}
                              first={position === 0}
                              onDelete={() => void remove(entry.id)}
                              {...handlersFor(entry.id)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </Box>
                  )}
                </motion.div>
              </AnimatePresence>
            </Box>
          </Stack>
        )}
      </Stack>
    </Page>
  )
}
