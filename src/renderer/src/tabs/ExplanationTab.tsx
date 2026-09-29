import { useEffect, useState } from 'react'
import { Box, Button, chakra, Flex, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuArrowLeft, LuCheck, LuRefreshCw } from 'react-icons/lu'
import type { DailyEntry, Explanation } from '@shared/types'
import ErrorBanner from '../components/ErrorBanner'
import InlineCode from '../components/InlineCode'
import Page, { SectionTitle } from '../components/Page'
import { localDay } from '../lib/dates'
import { useDailyStore } from '../store/useDailyStore'
import { findEntry, useExplainStore } from '../store/useExplainStore'
import { useNavStore } from '../store/useNavStore'
import { crossfade, fadeUp } from '../theme/motion'
import { card, kicker, primaryButton, quietButton, secondaryButton } from '../theme/styles'

/**
 * The full walkthrough behind one daily suggestion. Nothing is generated here
 * on its own — only after the user presses Explain on a card — and each
 * explanation is cached on its suggestion, so coming back is free.
 */

function BackToDaily(): React.JSX.Element {
  const setTab = useNavStore((state) => state.setTab)
  return (
    <Button h="28px" pl="1.5" pr="2.5" ml="-1.5" mb="3" gap="1.5" fontSize="13px" {...quietButton} onClick={() => setTab('daily')}>
      <LuArrowLeft /> Daily suggestions
    </Button>
  )
}

/** Where the ticks are kept: per suggestion, and per written explanation, so a regenerate starts clean. */
function ticksKey(entry: DailyEntry, explanation: Explanation): string {
  return `career-app:steps:${entry.id}:${explanation.generatedAt}`
}

// ponytail: ticks live in localStorage, not daily.json, so they skip the Markdown
// export and die with the browser profile. Move them onto the entry if that matters.
function readTicks(key: string): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === 'number') : []
  } catch {
    return []
  }
}

/**
 * The steps as a checklist, and Finish, which ticks off the suggestion itself
 * once every step is. Keyed on its storage key by the caller, so a new
 * explanation starts unticked.
 */
function Steps({
  steps,
  storageKey,
  finished,
  onFinish
}: {
  steps: string[]
  storageKey: string
  /** Whether the suggestion is already done on the Daily tab. */
  finished: boolean
  onFinish: () => void
}): React.JSX.Element {
  const [ticked, setTicked] = useState(() => readTicks(storageKey))
  const done = steps.filter((_, index) => ticked.includes(index)).length
  const allDone = done === steps.length

  useEffect(() => {
    try {
      if (ticked.length > 0) localStorage.setItem(storageKey, JSON.stringify(ticked))
      else localStorage.removeItem(storageKey)
    } catch {
      // Only a convenience; the ticks still show until the app closes.
    }
  }, [storageKey, ticked])

  // From the current state, not this render's copy: two quick clicks must both count.
  function toggle(index: number): void {
    setTicked((current) =>
      current.includes(index) ? current.filter((value) => value !== index) : [...current, index]
    )
  }

  return (
    <Stack gap="3">
      <SectionTitle title="Step by step" meta={`${done} of ${steps.length} done`} />
      <Box h="4px" borderRadius="full" bg="app.border" overflow="hidden">
        <Box
          h="full"
          borderRadius="full"
          bg="app.success"
          w={`${(done / steps.length) * 100}%`}
          transition="width 200ms ease"
        />
      </Box>
      <Box as="ol" listStyleType="none" m="0" mt="1" p="0" {...card} overflow="hidden">
        {steps.map((step, index) => {
          const isDone = ticked.includes(index)
          return (
            <Box as="li" key={index} borderTopWidth={index === 0 ? '0' : '1px'} borderColor="app.border">
              <chakra.button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                onClick={() => toggle(index)}
                display="grid"
                gridTemplateColumns="28px minmax(0, 1fr)"
                columnGap="3.5"
                w="full"
                px="4.5"
                py="4"
                textAlign="left"
                cursor="pointer"
                transition="background-color 120ms ease"
                _hover={{ bg: 'app.surfaceSubtle' }}
              >
                <Flex
                  as="span"
                  align="center"
                  justify="center"
                  w="26px"
                  h="26px"
                  borderRadius="full"
                  fontSize="12px"
                  fontWeight="800"
                  bg={isDone ? 'app.success' : 'app.accentSubtle'}
                  color={isDone ? 'app.accentFg' : 'app.accent'}
                >
                  {isDone ? <LuCheck /> : index + 1}
                </Flex>
                <Text as="span" fontSize="15.5px" lineHeight="1.65" pt="1px" color={isDone ? 'app.textMuted' : 'app.text'}>
                  <InlineCode text={step} />
                </Text>
              </chakra.button>
            </Box>
          )
        })}
      </Box>
      <Flex align="center" justify="space-between" gap="3" mt="2">
        <Text fontSize="12px" color="app.textFaint">
          {finished
            ? 'Marked as done on the Daily tab.'
            : allDone
              ? 'Every step is ticked.'
              : 'Tick every step to finish.'}
        </Text>
        {finished ? (
          <Flex
            align="center"
            gap="2"
            h="42px"
            px="4"
            flexShrink="0"
            fontSize="14px"
            fontWeight="700"
            color="app.success"
            bg="app.successSubtle"
            borderWidth="1px"
            borderColor="app.success"
            borderRadius="9px"
            data-finished
          >
            <LuCheck /> Done
          </Flex>
        ) : (
          <Button
            h="42px"
            px="5"
            gap="2"
            flexShrink="0"
            fontSize="14px"
            {...primaryButton}
            disabled={!allDone}
            title={allDone ? 'Mark this suggestion as done' : 'Tick every step first'}
            onClick={onFinish}
          >
            <LuCheck /> Finish
          </Button>
        )}
      </Flex>
    </Stack>
  )
}

function SuggestionPanel({ entry }: { entry: DailyEntry }): React.JSX.Element {
  return (
    <Box {...card} p="5">
      <Text {...kicker} mb="2.5">
        The suggestion
      </Text>
      <Text fontSize="13px" lineHeight="1.65" color="app.textMuted">
        <InlineCode text={entry.suggestion ?? ''} />
      </Text>
    </Box>
  )
}

function ConceptsPanel({
  explanation,
  onRegenerate
}: {
  explanation: Explanation
  onRegenerate: () => void
}): React.JSX.Element {
  const written = explanation.generatedAt
    ? new Date(explanation.generatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null

  return (
    <>
      {explanation.concepts.length > 0 && (
        <Box {...card} p="5">
          <Text {...kicker} mb="3">
            Key concepts
          </Text>
          <Stack as="dl" gap="3.5" m="0">
            {explanation.concepts.map((concept, index) => (
              <Box key={index}>
                <Text as="dt" fontSize="14px" fontWeight="600" color="app.text">
                  <InlineCode text={concept.term} />
                </Text>
                <Text as="dd" m="0" mt="0.5" fontSize="13px" lineHeight="1.6" color="app.textMuted">
                  <InlineCode text={concept.definition} />
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
      <Flex align="center" justify="space-between" gap="3" px="1">
        <Text fontSize="12px" color="app.textFaint">
          {written ? `Written ${written}` : ''}
        </Text>
        <Button h="30px" px="2.5" gap="1.5" fontSize="12px" {...quietButton} title="Write a new explanation (uses AI)" onClick={onRegenerate}>
          <LuRefreshCw /> Regenerate
        </Button>
      </Flex>
    </>
  )
}

function Placeholder({ title, body }: { title: string; body: string }): React.JSX.Element {
  const setTab = useNavStore((state) => state.setTab)
  return (
    <Page eyebrow="Explanation" title={title}>
      <Stack {...card} gap="3" p="6" align="flex-start">
        <Text fontSize="14px" color="app.textMuted" maxW="440px">
          {body}
        </Text>
        <Button h="36px" px="3.5" {...secondaryButton} onClick={() => setTab('daily')}>
          Go to Daily suggestions
        </Button>
      </Stack>
    </Page>
  )
}

export default function ExplanationTab(): React.JSX.Element {
  const { entryId, status, error, open, regenerate } = useExplainStore()
  const setDone = useDailyStore((state) => state.setDone)
  // Subscribed, so the tab updates the moment an explanation lands or the
  // entry is deleted from the Daily tab.
  const result = useDailyStore((state) => state.result)
  const entry = findEntry(result, entryId)

  // The outer layer swaps between nothing chosen, deleted, and a suggestion.
  const screenKey = !entryId ? 'empty' : !entry ? 'deleted' : entry.id

  // Within a suggestion, only the body swaps; the header holds still.
  const bodyState =
    status === 'loading' ? 'loading' : status === 'error' ? 'error' : entry?.explanation ? 'ready' : 'loading'

  function renderScreen(): React.JSX.Element {
    if (!entryId) {
      return (
        <Placeholder
          title="Nothing to explain yet"
          body="Press Explain on a daily suggestion to get a step-by-step walkthrough and the key concepts behind it."
        />
      )
    }
    if (!entry) {
      return (
        <Placeholder
          title="This suggestion was deleted"
          body="Its explanation went with it. Pick another suggestion on the Daily tab."
        />
      )
    }

    const explanation = bodyState === 'ready' ? entry.explanation : null
    const day = localDay(entry.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

    return (
      <Page
        back={<BackToDaily />}
        eyebrow={`Explanation · ${day}`}
        title={entry.interestTitle}
        aside={
          <>
            <SuggestionPanel entry={entry} />
            {explanation && <ConceptsPanel explanation={explanation} onRegenerate={() => void regenerate()} />}
          </>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${entry.id}:${bodyState}`} variants={crossfade} initial="hidden" animate="shown" exit="exit">
            {bodyState === 'loading' && (
              <Flex {...card} align="center" gap="3" p="6" color="app.textMuted">
                <Spinner color="app.accent" size="sm" />
                <Text fontSize="14px">Writing the explanation…</Text>
              </Flex>
            )}
            {bodyState === 'error' && (
              <Stack gap="3" align="flex-start">
                <Box alignSelf="stretch">
                  <ErrorBanner message={error ?? 'Something went wrong.'} />
                </Box>
                <Button
                  h="36px"
                  px="3.5"
                  gap="2"
                  {...secondaryButton}
                  // Retry whatever failed: a regenerate if one already exists.
                  onClick={() => void (entry.explanation ? regenerate() : open(entry.id))}
                >
                  <LuRefreshCw /> Try again
                </Button>
              </Stack>
            )}
            {explanation && (
              <motion.div variants={fadeUp} initial="hidden" animate="shown">
                <Steps
                  key={ticksKey(entry, explanation)}
                  storageKey={ticksKey(entry, explanation)}
                  steps={explanation.steps}
                  finished={entry.done}
                  onFinish={() => void setDone(entry.id, true)}
                />
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </Page>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={screenKey} variants={crossfade} initial="hidden" animate="shown" exit="exit">
        {renderScreen()}
      </motion.div>
    </AnimatePresence>
  )
}
