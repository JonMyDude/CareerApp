import { useState } from 'react'
import { Box, Button, Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuLightbulb } from 'react-icons/lu'
import { IMPORTANCE_LABELS, type Importance } from '@shared/types'
import AddInterestForm from '../components/AddInterestForm'
import ErrorBanner from '../components/ErrorBanner'
import InterestRow from '../components/InterestRow'
import SegmentedControl from '../components/SegmentedControl'
import { useInterestsStore } from '../store/useInterestsStore'
import { fadeUp, listItem, springGentle } from '../theme/motion'

type LevelFilter = 'all' | Importance

const FILTER_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 3, label: IMPORTANCE_LABELS[3] },
  { value: 2, label: IMPORTANCE_LABELS[2] },
  { value: 1, label: IMPORTANCE_LABELS[1] }
]

/**
 * Flat list with an importance level per interest. Per CLAUDE.md this tab is
 * still dumb storage — no tree UI, no generated breakdowns, no AI calls.
 */
export default function InterestsTab(): React.JSX.Element {
  const interests = useInterestsStore((state) => state.interests)
  const status = useInterestsStore((state) => state.status)
  const error = useInterestsStore((state) => state.error)
  const clearError = useInterestsStore((state) => state.clearError)
  const [level, setLevel] = useState<LevelFilter>('all')

  const shown =
    level === 'all' ? interests : interests.filter((interest) => interest.importance === level)
  const noun = interests.length === 1 ? 'interest' : 'interests'

  return (
    <Stack gap="5" maxW="720px" mx="auto">
      <Flex align="baseline" justify="space-between">
        <Heading size="sm" color="app.text">
          Interests
        </Heading>
        <Text fontSize="sm" color="app.textMuted" data-interest-count>
          {level === 'all' ? `${interests.length} ${noun}` : `${shown.length} of ${interests.length} ${noun}`}
        </Text>
      </Flex>

      <AddInterestForm />

      {/* Filtering a list of one is pointless. */}
      {interests.length > 1 && (
        <SegmentedControl label="Importance" value={level} options={FILTER_OPTIONS} onChange={setLevel} />
      )}

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {status === 'ready' && interests.length > 0 && shown.length === 0 && (
        <Flex direction="column" align="center" gap="2" py="10" color="app.textMuted" data-no-match>
          <Text fontSize="sm">No interests at this level.</Text>
          <Button
            size="xs"
            variant="ghost"
            color="app.accent"
            _hover={{ bg: 'app.surfaceHover' }}
            onClick={() => setLevel('all')}
          >
            Show all
          </Button>
        </Flex>
      )}

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
            align="center"
            gap="2"
            py="14"
            color="app.textMuted"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="app.border"
            borderRadius="md"
          >
            <Box fontSize="2xl" color="app.textFaint">
              <LuLightbulb />
            </Box>
            <Text fontWeight="medium" color="app.text">
              No interests yet
            </Text>
            <Text fontSize="sm">Add the first thing you want to learn above.</Text>
          </Flex>
        </motion.div>
      )}

      {/* popLayout lifts a deleted row out of the flow so the rows below close
          the gap by layout transform; it positions against this relative box.
          initial={false}: rows already there on load don't all slide in. */}
      <Stack gap="2" position="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((interest) => (
            <motion.div
              key={interest.id}
              layout
              variants={listItem}
              initial="hidden"
              animate="shown"
              exit="exit"
              transition={{ layout: springGentle }}
            >
              <InterestRow interest={interest} />
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>
    </Stack>
  )
}
