import { useId, useState } from 'react'
import { Box, Button, chakra, Flex, Grid, Heading, IconButton, Input, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuBookOpen, LuCheck, LuPencilLine, LuShuffle, LuTrash2 } from 'react-icons/lu'
import { MAX_REFLECTION_LENGTH, type DailyEntry } from '@shared/types'
import { formatEntryDate } from '../lib/dates'
import { crossfade, fadeUp, pop, rest, tick } from '../theme/motion'
import { card, field, iconButton, kicker, primaryButton, quietButton, secondaryButton } from '../theme/styles'
import InlineCode from './InlineCode'

/**
 * Today's suggestion as a card, and the earlier ones as rows of one list.
 * Both can be ticked off, noted and explained; only history rows are deleted —
 * today's is rerolled instead.
 */

interface Handlers {
  onToggleDone: (done: boolean) => void
  /** Saves the one-line reflection; '' clears it. Rejects if the save failed. */
  onSaveNote: (note: string) => Promise<void>
  /** Sends the suggestion to the Explanation tab. */
  onExplain: () => void
}

/** The draft of the one-line reflection, and ticking off, which prompts for one. */
function useNote(entry: DailyEntry, { onToggleDone, onSaveNote }: Handlers) {
  /** The note being written; null while the editor is closed. */
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleDone(): void {
    const next = !entry.done
    onToggleDone(next)
    // Ticking off is the moment to jot down how it went — optional, one line.
    if (next && !entry.note) setDraft('')
    // Un-ticked straight away: drop the prompt it just opened.
    if (!next && draft === '') setDraft(null)
  }

  async function save(): Promise<void> {
    if (draft === null || saving) return
    // Nothing changed (including an empty "skip"): just close, no write.
    if (draft.trim() === entry.note) {
      setDraft(null)
      return
    }
    setSaving(true)
    try {
      await onSaveNote(draft)
      setDraft(null)
    } catch {
      // The tab shows the error; the draft stays so nothing typed is lost.
    } finally {
      setSaving(false)
    }
  }

  return { draft, setDraft, saving, toggleDone, save }
}

type NoteState = ReturnType<typeof useNote>

/** The reflection as saved, under the suggestion. */
function NoteLine({ note, compact = false }: { note: string; compact?: boolean }): React.JSX.Element {
  return (
    <Flex gap="2.5" mt={compact ? '2' : '4'} fontSize={compact ? '13px' : '14px'} lineHeight="1.6">
      <Text as="span" {...kicker} fontSize={compact ? '10px' : '11px'} pt="2px" flexShrink="0">
        Note
      </Text>
      <Text as="span" color="app.textMuted" data-note>
        {note}
      </Text>
    </Flex>
  )
}

function NoteEditor({
  entry,
  note,
  compact = false
}: {
  entry: DailyEntry
  note: NoteState
  compact?: boolean
}): React.JSX.Element {
  const id = useId()
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="shown" exit="exit">
      <Flex
        direction="column"
        gap="2"
        mt={compact ? '3' : '5'}
        p={compact ? '3' : '4'}
        bg="app.surfaceSubtle"
        borderWidth="1px"
        borderColor="app.border"
        borderRadius="10px"
      >
        <chakra.label htmlFor={id} fontSize="13px" fontWeight="600" color="app.text">
          How did it go?{' '}
          <Text as="span" fontWeight="400" color="app.textFaint">
            Optional. The next suggestion for this interest takes it into account.
          </Text>
        </chakra.label>
        <Flex gap="2">
          <Input
            id={id}
            autoFocus
            h="38px"
            value={note.draft ?? ''}
            maxLength={MAX_REFLECTION_LENGTH}
            placeholder="What did you do or learn?"
            onChange={(event) => note.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void note.save()
              if (event.key === 'Escape') note.setDraft(null)
            }}
            {...field}
          />
          <Button h="38px" px="4" flexShrink="0" loading={note.saving} onClick={() => void note.save()} {...primaryButton}>
            Save
          </Button>
          <Button h="38px" px="4" flexShrink="0" {...secondaryButton} onClick={() => note.setDraft(null)}>
            {entry.note ? 'Cancel' : 'Skip'}
          </Button>
        </Flex>
      </Flex>
    </motion.div>
  )
}

/** "Done", once ticked: the tint of success rather than the accent's call to action. */
const doneButton = {
  bg: 'app.successSubtle',
  color: 'app.success',
  borderColor: 'app.success',
  fontWeight: '700',
  borderRadius: '9px',
  _hover: { filter: 'brightness(1.1)' }
} as const

interface CardProps extends Handlers {
  entry: DailyEntry
  onReroll: () => void
}

/** Today's suggestion. */
export default function SuggestionCard({ entry, onReroll, ...handlers }: CardProps): React.JSX.Element {
  const note = useNote(entry, handlers)
  // Cached explanations open instantly and free; the rest spend tokens.
  const explained = entry.explanation !== null

  return (
    <Box as="article" {...card} p="6" data-entry-id={entry.id}>
      <Flex align="center" justify="space-between" gap="3">
        <Text {...kicker} color="app.accent">
          Interest
        </Text>
        <Flex align="center" gap="0.5">
          <Text fontSize="12px" color="app.textFaint" mr="1.5" whiteSpace="nowrap">
            Picked {formatEntryDate(entry)}
          </Text>
          <IconButton
            aria-label="Reroll today's suggestion"
            title="Pick a different interest and suggestion for today"
            size="xs"
            {...iconButton}
            _hover={{ bg: 'app.surfaceHover', color: 'app.accent' }}
            onClick={onReroll}
          >
            <LuShuffle />
          </IconButton>
          <IconButton
            aria-label={entry.note ? 'Edit note' : 'Add a note'}
            title="Add a note — the next suggestion for this interest takes it into account"
            size="xs"
            {...iconButton}
            onClick={() => note.setDraft(entry.note)}
          >
            <LuPencilLine />
          </IconButton>
        </Flex>
      </Flex>

      {/* Strikethrough stays on the title: through the whole suggestion it was hard to read. */}
      <Heading
        as="h2"
        mt="1"
        mb="3"
        fontSize="21px"
        fontWeight="600"
        lineHeight="1.3"
        letterSpacing="-0.005em"
        color="app.text"
        textWrap="pretty"
        textDecoration={entry.done ? 'line-through' : undefined}
      >
        {entry.interestTitle}
      </Heading>
      <Text fontSize="16px" lineHeight="1.7" color="app.text" opacity={entry.done ? 0.6 : 1} textWrap="pretty">
        <InlineCode text={entry.suggestion ?? ''} />
      </Text>

      {entry.note && note.draft === null && <NoteLine note={entry.note} />}
      <AnimatePresence initial={false}>
        {note.draft !== null && <NoteEditor key="note-editor" entry={entry} note={note} />}
      </AnimatePresence>

      <Flex wrap="wrap" gap="2" mt="6">
        {/* initial={false}: a suggestion that loads already done doesn't pop. */}
        <motion.div initial={false} animate={entry.done ? pop : rest}>
          <Button
            h="42px"
            px="4"
            gap="2.5"
            fontSize="14px"
            aria-pressed={entry.done}
            onClick={note.toggleDone}
            {...(entry.done ? doneButton : primaryButton)}
          >
            <LuCheck />
            {entry.done ? 'Done' : 'Mark as done'}
          </Button>
        </motion.div>
        <Button
          h="42px"
          px="4"
          gap="2.5"
          fontSize="14px"
          {...secondaryButton}
          title={explained ? 'Open explanation' : 'Explain this suggestion (uses AI)'}
          onClick={handlers.onExplain}
        >
          <LuBookOpen />
          {explained ? 'Open explanation' : 'Explain step by step'}
        </Button>
      </Flex>
    </Box>
  )
}

interface RowProps extends Handlers {
  entry: DailyEntry
  /** The first row has no rule above it. */
  first: boolean
  onDelete: () => void
}

/** An earlier suggestion. Click the text to read it in full. */
export function HistoryRow({ entry, first, onDelete, ...handlers }: RowProps): React.JSX.Element {
  const note = useNote(entry, handlers)
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const explained = entry.explanation !== null
  const date = formatEntryDate(entry)

  function toggleExpanded(): void {
    // A drag that selected some text is not a click to expand.
    if (window.getSelection()?.isCollapsed === false) return
    setExpanded((value) => !value)
  }

  return (
    <Grid
      templateColumns="20px minmax(0, 1fr) auto"
      columnGap="3.5"
      px="4.5"
      py="4"
      borderTopWidth={first ? '0' : '1px'}
      borderColor="app.border"
      transition="background-color 120ms ease"
      _hover={{ bg: 'app.surfaceSubtle' }}
      data-entry-id={entry.id}
    >
      {/* Ticking bumps the box; unticking just settles. */}
      <motion.div initial={false} animate={entry.done ? tick : rest} style={{ display: 'flex', marginTop: 1 }}>
        <chakra.button
          type="button"
          aria-label={entry.done ? 'Mark as not done' : 'Mark as done'}
          aria-pressed={entry.done}
          title={entry.done ? 'Mark as not done' : 'Mark as done'}
          onClick={note.toggleDone}
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="20px"
          h="20px"
          fontSize="12px"
          borderRadius="6px"
          borderWidth="1.5px"
          borderColor={entry.done ? 'app.success' : 'app.borderStrong'}
          bg={entry.done ? 'app.success' : 'transparent'}
          color={entry.done ? 'app.accentFg' : 'transparent'}
          cursor="pointer"
          _hover={{ borderColor: 'app.success', color: entry.done ? 'app.accentFg' : 'app.success' }}
        >
          <LuCheck />
        </chakra.button>
      </motion.div>

      <Box minW="0">
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          cursor="pointer"
          borderRadius="6px"
          onClick={toggleExpanded}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            setExpanded((value) => !value)
          }}
        >
          <Text
            fontSize="14px"
            fontWeight="600"
            lineHeight="1.45"
            color={entry.done ? 'app.textMuted' : 'app.text'}
            truncate
          >
            {entry.interestTitle}
          </Text>
          <Flex wrap="wrap" columnGap="2.5" rowGap="1" mt="0.5" fontSize="12px" color="app.textFaint">
            <Text as="span" _firstLetter={{ textTransform: 'uppercase' }}>
              {date}
            </Text>
            {entry.done && (
              <Text as="span" color="app.success">
                Done
              </Text>
            )}
            {explained && (
              <Text as="span" color="app.accent">
                Explained
              </Text>
            )}
          </Flex>
          <Text mt="2" fontSize="14px" lineHeight="1.6" color="app.textMuted" lineClamp={expanded ? undefined : 2}>
            <InlineCode text={entry.suggestion ?? ''} />
          </Text>
        </Box>

        {entry.note && note.draft === null && <NoteLine note={entry.note} compact />}
        <AnimatePresence initial={false}>
          {note.draft !== null && <NoteEditor key="note-editor" entry={entry} note={note} compact />}
        </AnimatePresence>
      </Box>

      <Flex align="flex-start">
        <AnimatePresence mode="wait" initial={false}>
          {confirmingDelete ? (
            <motion.div
              key="confirm"
              variants={crossfade}
              initial="hidden"
              animate="shown"
              exit="exit"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Text fontSize="12px" color="app.textMuted" mr="1">
                Delete?
              </Text>
              <Button
                size="2xs"
                borderRadius="6px"
                bg="app.danger"
                color="app.accentFg"
                _hover={{ bg: 'app.dangerHover' }}
                onClick={onDelete}
              >
                Yes
              </Button>
              <Button size="2xs" {...quietButton} borderRadius="6px" onClick={() => setConfirmingDelete(false)}>
                No
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              variants={crossfade}
              initial="hidden"
              animate="shown"
              exit="exit"
              style={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <IconButton
                aria-label={entry.note ? 'Edit note' : 'Add a note'}
                title="Add a note — the next suggestion for this interest takes it into account"
                size="xs"
                {...iconButton}
                onClick={() => note.setDraft(entry.note)}
              >
                <LuPencilLine />
              </IconButton>
              <IconButton
                aria-label={explained ? 'Open explanation' : 'Explain this suggestion'}
                title={explained ? 'Open explanation' : 'Explain this suggestion (uses AI)'}
                size="xs"
                {...iconButton}
                // Accent once explained, so it reads as "open", not "spend".
                color={explained ? 'app.accent' : 'app.textFaint'}
                _hover={{ bg: 'app.surfaceHover', color: 'app.accent' }}
                onClick={handlers.onExplain}
              >
                <LuBookOpen />
              </IconButton>
              <IconButton
                aria-label={`Delete suggestion from ${date}`}
                title="Delete this suggestion"
                size="xs"
                {...iconButton}
                _hover={{ bg: 'app.surfaceHover', color: 'app.danger' }}
                onClick={() => setConfirmingDelete(true)}
              >
                <LuTrash2 />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
      </Flex>
    </Grid>
  )
}
