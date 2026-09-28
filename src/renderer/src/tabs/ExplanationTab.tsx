import { Box, Button, Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuArrowLeft, LuBookOpen, LuRefreshCw } from 'react-icons/lu'
import type { DailyEntry, Explanation } from '@shared/types'
import ErrorBanner from '../components/ErrorBanner'
import InlineCode from '../components/InlineCode'
import { formatEntryDate } from '../lib/dates'
import { useDailyStore } from '../store/useDailyStore'
import { findEntry, useExplainStore } from '../store/useExplainStore'
import { useNavStore } from '../store/useNavStore'
import { crossfade, fadeUp } from '../theme/motion'

/**
 * The full walkthrough behind one daily suggestion. Nothing is generated here
 * on its own — only after the user presses Explain on a card — and each
 * explanation is cached on its suggestion, so coming back is free.
 */

function BackToDaily(): React.JSX.Element {
  const setTab = useNavStore((state) => state.setTab)
  return (
    <Button
      variant="plain"
      size="xs"
      px="0"
      alignSelf="flex-start"
      color="app.textMuted"
      _hover={{ color: 'app.text' }}
      onClick={() => setTab('daily')}
    >
      <LuArrowLeft /> Daily suggestions
    </Button>
  )
}

function Placeholder({
  title,
  body
}: {
  title: string
  body: string
}): React.JSX.Element {
  const setTab = useNavStore((state) => state.setTab)
  return (
    <Flex direction="column" align="center" gap="3" py="16" textAlign="center" color="app.textMuted">
      <Box fontSize="3xl" color="app.textFaint">
        <LuBookOpen />
      </Box>
      <Text fontWeight="medium" color="app.text">
        {title}
      </Text>
      <Text fontSize="sm" maxW="380px">
        {body}
      </Text>
      <Button
        size="sm"
        variant="outline"
        color="app.text"
        borderColor="app.border"
        _hover={{ bg: 'app.surfaceHover' }}
        onClick={() => setTab('daily')}
      >
        Go to Daily suggestions
      </Button>
    </Flex>
  )
}

function Header({ entry }: { entry: DailyEntry }): React.JSX.Element {
  return (
    <Stack gap="3">
      <BackToDaily />
      <Flex align="baseline" justify="space-between" gap="3">
        <Heading size="md" color="app.text">
          {entry.interestTitle}
        </Heading>
        <Text fontSize="xs" color="app.textFaint" flexShrink="0">
          {formatEntryDate(entry)}
        </Text>
      </Flex>
      {/* The suggestion being explained, quoted so it reads as the question. */}
      <Box
        borderLeftWidth="3px"
        borderColor="app.accent"
        bg="app.surfaceSubtle"
        borderRadius="sm"
        px="4"
        py="3"
      >
        <Text color="app.textMuted" fontSize="sm" lineHeight="1.7">
          {entry.suggestion}
        </Text>
      </Box>
    </Stack>
  )
}

function Content({
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
    <Stack gap="7">
      <motion.section variants={fadeUp} initial="hidden" animate="shown">
        <Heading size="sm" color="app.text" mb="3">
          Step by step
        </Heading>
        <Stack as="ol" gap="3" listStyleType="none" p="0" m="0">
          {explanation.steps.map((step, index) => (
            <Flex as="li" key={index} gap="3" align="flex-start">
              <Flex
                align="center"
                justify="center"
                flexShrink="0"
                w="6"
                h="6"
                mt="0.5"
                borderRadius="full"
                bg="app.accentSubtle"
                color="app.accent"
                fontSize="xs"
                fontWeight="bold"
              >
                {index + 1}
              </Flex>
              <Text color="app.text" lineHeight="1.7">
                <InlineCode text={step} />
              </Text>
            </Flex>
          ))}
        </Stack>
      </motion.section>

      <motion.section variants={fadeUp} initial="hidden" animate="shown">
        <Heading size="sm" color="app.text" mb="3">
          Key concepts
        </Heading>
        <Stack as="dl" gap="3" m="0">
          {explanation.concepts.map((concept, index) => (
            <Box key={index}>
              <Text as="dt" fontWeight="medium" color="app.text">
                <InlineCode text={concept.term} />
              </Text>
              <Text as="dd" m="0" fontSize="sm" color="app.textMuted" lineHeight="1.7">
                <InlineCode text={concept.definition} />
              </Text>
            </Box>
          ))}
        </Stack>
      </motion.section>

      <Flex
        align="center"
        justify="space-between"
        gap="3"
        pt="4"
        borderTopWidth="1px"
        borderColor="app.border"
      >
        <Text fontSize="xs" color="app.textFaint">
          {written ? `Written ${written}` : ''}
        </Text>
        <Button
          variant="ghost"
          size="xs"
          color="app.textFaint"
          _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
          title="Write a new explanation (uses AI)"
          onClick={onRegenerate}
        >
          <LuRefreshCw /> Regenerate
        </Button>
      </Flex>
    </Stack>
  )
}

export default function ExplanationTab(): React.JSX.Element {
  const { entryId, status, error, open, regenerate } = useExplainStore()
  // Subscribed, so the tab updates the moment an explanation lands or the
  // entry is deleted from the Daily tab.
  const result = useDailyStore((state) => state.result)
  const entry = findEntry(result, entryId)

  // The outer layer swaps between nothing chosen, deleted, and a suggestion.
  const screenKey = !entryId ? 'empty' : !entry ? 'deleted' : entry.id

  // Within a suggestion, only the body swaps; the header holds still.
  const bodyState =
    status === 'loading'
      ? 'loading'
      : status === 'error'
        ? 'error'
        : entry?.explanation
          ? 'ready'
          : 'loading'

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

    return (
      <Stack gap="6">
        <Header entry={entry} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${entry.id}:${bodyState}`}
            variants={crossfade}
            initial="hidden"
            animate="shown"
            exit="exit"
          >
            {bodyState === 'loading' && (
              <Flex align="center" justify="center" gap="3" py="12" color="app.textMuted">
                <Spinner color="app.accent" size="sm" />
                <Text fontSize="sm">Writing the explanation…</Text>
              </Flex>
            )}
            {bodyState === 'error' && (
              <Stack gap="3">
                <ErrorBanner message={error ?? 'Something went wrong.'} />
                <Button
                  size="sm"
                  variant="outline"
                  alignSelf="flex-start"
                  color="app.text"
                  borderColor="app.border"
                  _hover={{ bg: 'app.surfaceHover' }}
                  // Retry whatever failed: a regenerate if one already exists.
                  onClick={() => void (entry.explanation ? regenerate() : open(entry.id))}
                >
                  <LuRefreshCw /> Try again
                </Button>
              </Stack>
            )}
            {bodyState === 'ready' && entry.explanation && (
              <Content explanation={entry.explanation} onRegenerate={() => void regenerate()} />
            )}
          </motion.div>
        </AnimatePresence>
      </Stack>
    )
  }

  return (
    <Box maxW="720px" mx="auto">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screenKey} variants={crossfade} initial="hidden" animate="shown" exit="exit">
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </Box>
  )
}
