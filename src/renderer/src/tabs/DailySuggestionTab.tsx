import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Heading, IconButton, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuLightbulb, LuRefreshCw, LuSettings, LuShuffle } from 'react-icons/lu'
import ApiKeyPanel from '../components/ApiKeyPanel'
import ErrorBanner from '../components/ErrorBanner'
import HistoryFilter from '../components/HistoryFilter'
import ProgressStrip from '../components/ProgressStrip'
import SuggestionCard from '../components/SuggestionCard'
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

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Flex direction="column" align="center" gap="3" py="14" textAlign="center" color="app.textMuted">
      {children}
    </Flex>
  )
}

/**
 * One interest a day with an AI-generated thing to do about it, newest on top.
 * Today sits above a hairline rule; every earlier day scrolls beneath it.
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
  // Memoised so the strip and the filter only recompute when entries change.
  const history = useMemo(() => result?.history ?? [], [result])
  const allEntries = useMemo(
    () => (result ? [...(result.today ? [result.today] : []), ...result.history] : []),
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
  // Filtering a list of one is pointless.
  const showFilter = history.length > 1

  return (
    <Stack gap="5" maxW="720px" mx="auto">
      <Heading size="sm" color="app.text">
        Daily suggestions
      </Heading>

      {/* Replaces the old "x of y done" line: it shows that and more. */}
      <ProgressStrip entries={allEntries} />

      {error && <ErrorBanner message={error} />}
      {/* Right under the banner: at the bottom of a long feed it went unseen. */}
      {!busy && status === 'error' && (
        <Flex justify="flex-start" gap="2">
          <Button
            onClick={() => void retry()}
            variant="outline"
            size="sm"
            color="app.text"
            borderColor="app.border"
            _hover={{ bg: 'app.surfaceHover' }}
          >
            <LuRefreshCw /> Try again
          </Button>
          {/* A rejected key or a wrong model name is fixed there. */}
          <Button
            onClick={() => setTab('settings')}
            variant="ghost"
            size="sm"
            color="app.textMuted"
            _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
          >
            <LuSettings /> Open Settings
          </Button>
        </Flex>
      )}

      {!busy && result?.state === 'no-interests' && history.length === 0 && (
        <Centered>
          <Box fontSize="2xl" color="app.textFaint">
            <LuLightbulb />
          </Box>
          <Text fontWeight="medium" color="app.text">
            Nothing to suggest yet
          </Text>
          <Text fontSize="sm">
            Add an interest on the Interests tab and a suggestion will appear here.
          </Text>
        </Centered>
      )}

      {!busy && result?.state === 'no-api-key' && <ApiKeyPanel variant="setup" />}

      {/* The top slot: a spinner while today generates, otherwise today's card.
          One presence group, so a reroll crossfades card → spinner → new card. */}
      <AnimatePresence mode="wait" initial={false}>
        {busy ? (
          <motion.div key="busy" variants={crossfade} initial="hidden" animate="shown" exit="exit">
            <Flex
              align="center"
              justify="center"
              gap="3"
              py={history.length > 0 ? '8' : '14'}
              color="app.textMuted"
            >
              <Spinner color="app.accent" size="sm" />
              <Text fontSize="sm">
                {status === 'generating' ? 'Thinking of something for today…' : 'Loading…'}
              </Text>
            </Flex>
          </motion.div>
        ) : hasTodayCard && today ? (
          <motion.div
            key={today.id}
            variants={fadeUp}
            initial="hidden"
            animate="shown"
            exit="exit"
          >
            <SuggestionCard
              entry={today}
              featured
              onToggleDone={(done) => void setDone(today.id, done)}
              onSaveNote={(note) => setNote(today.id, note)}
              onExplain={() => void openExplanation(today.id)}
              action={
                <IconButton
                  aria-label="Reroll today's suggestion"
                  title="Pick a different interest and suggestion for today"
                  size="xs"
                  variant="ghost"
                  ml="1"
                  color="app.textFaint"
                  _hover={{ bg: 'app.surfaceHover', color: 'app.accent' }}
                  onClick={() => void reroll()}
                >
                  <LuShuffle />
                </IconButton>
              }
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* History stays put while today generates — only the top slot is busy.
          Each row carries its own rule rather than a Stack separator: injected
          separators would be left orphaned while a row plays its exit. */}
      {history.length > 0 && (
        <Box>
          {/* With a filter bar, today's hairline sits above the bar instead of
              above the first row. */}
          {showFilter && (hasTodayCard || busy) && (
            <Box borderTopWidth="1px" borderColor="app.border" mb="5" />
          )}
          {showFilter && (
            <Box mb="5">
              <HistoryFilter
                value={filter}
                onChange={setFilter}
                options={options}
                shown={visibleHistory.length}
                total={history.length}
                filtering={filtering}
              />
            </Box>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={filterKey}
              variants={crossfade}
              initial="hidden"
              animate="shown"
              exit="exit"
            >
              {visibleHistory.length === 0 ? (
                <Flex
                  direction="column"
                  align="center"
                  gap="2"
                  py="10"
                  color="app.textMuted"
                  data-no-match
                >
                  <Text fontSize="sm">No suggestions match.</Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="app.accent"
                    _hover={{ bg: 'app.surfaceHover' }}
                    onClick={() => setFilter(EMPTY_FILTER)}
                  >
                    Clear filters
                  </Button>
                </Flex>
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
                        {(position > 0 || (!showFilter && (hasTodayCard || busy))) && (
                          <Box
                            borderTopWidth="1px"
                            borderColor="app.border"
                            mt={position === 0 ? '0' : '5'}
                            mb="5"
                          />
                        )}
                        <SuggestionCard
                          entry={entry}
                          onToggleDone={(done) => void setDone(entry.id, done)}
                          onSaveNote={(note) => setNote(entry.id, note)}
                          onDelete={() => void remove(entry.id)}
                          onExplain={() => void openExplanation(entry.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </Box>
              )}
            </motion.div>
          </AnimatePresence>
        </Box>
      )}
    </Stack>
  )
}
