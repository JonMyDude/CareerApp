import { useState } from 'react'
import { Box, Button, Flex, IconButton, Input, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuBookOpen, LuCheck, LuPencilLine, LuTrash2 } from 'react-icons/lu'
import { MAX_REFLECTION_LENGTH, type DailyEntry } from '@shared/types'
import { formatEntryDate } from '../lib/dates'
import { crossfade, fadeUp, rest, tick } from '../theme/motion'

interface Props {
  entry: DailyEntry
  /** Today's entry gets the full card; past ones sit flatter in the feed. */
  featured?: boolean
  /** Rendered at the card's top-right, e.g. the reroll button. */
  action?: React.ReactNode
  onToggleDone: (done: boolean) => void
  /** Omitted for today's entry — that one is rerolled, not deleted. */
  onDelete?: () => void
  /** Sends the suggestion to the Explanation tab. */
  onExplain?: () => void
  /** Saves the one-line reflection; '' clears it. Rejects if the save failed. */
  onSaveNote?: (note: string) => Promise<void>
}

export default function SuggestionCard({
  entry,
  featured = false,
  action,
  onToggleDone,
  onDelete,
  onExplain,
  onSaveNote
}: Props): React.JSX.Element {
  // Cached explanations open instantly and free; the rest spend tokens.
  const explained = entry.explanation !== null
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  /** The note being written; null while the editor is closed. */
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [savingNote, setSavingNote] = useState(false)

  function toggleDone(): void {
    const next = !entry.done
    onToggleDone(next)
    // Ticking off is the moment to jot down how it went — optional, one line.
    if (next && onSaveNote && !entry.note) setNoteDraft('')
    // Un-ticked straight away: drop the prompt it just opened.
    if (!next && noteDraft === '') setNoteDraft(null)
  }

  async function saveNote(): Promise<void> {
    if (!onSaveNote || noteDraft === null || savingNote) return
    // Nothing changed (including an empty "skip"): just close, no write.
    if (noteDraft.trim() === entry.note) {
      setNoteDraft(null)
      return
    }
    setSavingNote(true)
    try {
      await onSaveNote(noteDraft)
      setNoteDraft(null)
    } catch {
      // The tab shows the error; the draft stays so nothing typed is lost.
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <Box
      data-entry-id={entry.id}
      bg={featured ? 'app.surface' : 'transparent'}
      borderWidth={featured ? '1px' : '0'}
      borderColor="app.border"
      borderRadius="md"
      boxShadow={featured ? 'app' : 'none'}
      p={featured ? '5' : '0'}
    >
      {/* Finished entries fade back — but not the note editor below, which
          would otherwise look disabled right when it asks for input. */}
      <Box opacity={entry.done ? 0.65 : 1}>
        <Flex align="center" justify="space-between" gap="3" mb="2">
          <Flex align="center" gap="2" minW="0">
            {/* Ticking bumps the box; unticking just settles. initial={false} so
                suggestions that load already ticked don't all pop at once. */}
            <motion.div
              initial={false}
              animate={entry.done ? tick : rest}
              style={{ display: 'flex', flexShrink: 0 }}
            >
              {/* A real toggle button, so screen readers get the pressed state. */}
              <IconButton
                aria-label={entry.done ? 'Mark as not done' : 'Mark as done'}
                aria-pressed={entry.done}
                title={entry.done ? 'Mark as not done' : 'Mark as done'}
                size="2xs"
                variant="outline"
                borderRadius="sm"
                borderColor={entry.done ? 'app.success' : 'app.borderStrong'}
                bg={entry.done ? 'app.success' : 'transparent'}
                color={entry.done ? 'app.accentFg' : 'transparent'}
                _hover={{
                  borderColor: 'app.success',
                  color: entry.done ? 'app.accentFg' : 'app.success'
                }}
                onClick={toggleDone}
              >
                <LuCheck />
              </IconButton>
            </motion.div>

            <Text
              fontSize="sm"
              fontWeight="medium"
              color={featured ? 'app.accent' : 'app.textMuted'}
              textDecoration={entry.done ? 'line-through' : undefined}
              truncate
            >
              {entry.interestTitle}
            </Text>
          </Flex>

          <Flex align="center" gap="1" flexShrink="0">
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
                  <Text fontSize="xs" color="app.textMuted">
                    Delete?
                  </Text>
                  <Button
                    size="2xs"
                    bg="app.danger"
                    color="app.accentFg"
                    _hover={{ bg: 'app.dangerHover' }}
                    onClick={onDelete}
                  >
                    Yes
                  </Button>
                  <Button
                    size="2xs"
                    variant="ghost"
                    color="app.textMuted"
                    _hover={{ bg: 'app.surfaceHover' }}
                    onClick={() => setConfirmingDelete(false)}
                  >
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
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Text fontSize="xs" color="app.textFaint">
                    {formatEntryDate(entry)}
                  </Text>
                  {action}
                  {onSaveNote && !entry.note && noteDraft === null && (
                    <IconButton
                      aria-label="Add a note"
                      title="Add a note — the next suggestion for this interest takes it into account"
                      size="xs"
                      variant="ghost"
                      ml="1"
                      color="app.textFaint"
                      _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
                      onClick={() => setNoteDraft('')}
                    >
                      <LuPencilLine />
                    </IconButton>
                  )}
                  {onExplain && (
                    <Button
                      size="2xs"
                      variant="ghost"
                      ml="1"
                      px="1.5"
                      // Accent once explained, so it reads as "open", not "spend".
                      color={explained ? 'app.accent' : 'app.textFaint'}
                      _hover={{ bg: 'app.surfaceHover', color: 'app.accent' }}
                      aria-label={explained ? 'Open explanation' : 'Explain this suggestion'}
                      title={explained ? 'Open explanation' : 'Explain this suggestion (uses AI)'}
                      onClick={onExplain}
                    >
                      <LuBookOpen /> Explain
                    </Button>
                  )}
                  {onDelete && (
                    <IconButton
                      aria-label={`Delete suggestion from ${formatEntryDate(entry)}`}
                      title="Delete this suggestion"
                      size="xs"
                      variant="ghost"
                      ml="1"
                      color="app.textFaint"
                      _hover={{ bg: 'app.surfaceHover', color: 'app.danger' }}
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <LuTrash2 />
                    </IconButton>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Flex>
        </Flex>

        {/* Strikethrough stays on the topic line only — running it through the whole
            suggestion made finished entries genuinely hard to read. */}
        <Text
          color={entry.done ? 'app.textFaint' : featured ? 'app.text' : 'app.textMuted'}
          lineHeight="1.7"
          fontSize={featured ? 'md' : 'sm'}
        >
          {entry.suggestion}
        </Text>

        {entry.note && noteDraft === null && (
          <Flex mt="2" align="flex-start" gap="1">
            <Text
              data-note
              flex="1"
              fontSize="sm"
              fontStyle="italic"
              color="app.textMuted"
              lineHeight="1.6"
              borderLeftWidth="2px"
              borderColor="app.borderStrong"
              pl="3"
            >
              {entry.note}
            </Text>
            {onSaveNote && (
              <IconButton
                aria-label="Edit note"
                title="Edit note"
                size="2xs"
                variant="ghost"
                color="app.textFaint"
                _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
                onClick={() => setNoteDraft(entry.note)}
              >
                <LuPencilLine />
              </IconButton>
            )}
          </Flex>
        )}
      </Box>

      <AnimatePresence initial={false}>
        {noteDraft !== null && (
          <motion.div key="note-editor" variants={fadeUp} initial="hidden" animate="shown" exit="exit">
            <Flex gap="2" mt="3">
              <Input
                autoFocus
                size="sm"
                value={noteDraft}
                maxLength={MAX_REFLECTION_LENGTH}
                placeholder="What did you do or learn? (optional)"
                aria-label="Note on this suggestion"
                onChange={(event) => setNoteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveNote()
                  if (event.key === 'Escape') setNoteDraft(null)
                }}
                bg="app.surfaceSubtle"
                color="app.text"
                borderColor="app.border"
                _placeholder={{ color: 'app.textFaint' }}
              />
              <Button
                size="sm"
                onClick={() => void saveNote()}
                loading={savingNote}
                bg="app.accent"
                color="app.accentFg"
                _hover={{ bg: 'app.accentHover' }}
                px="4"
                flexShrink="0"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                color="app.textMuted"
                _hover={{ bg: 'app.surfaceHover' }}
                onClick={() => setNoteDraft(null)}
                flexShrink="0"
              >
                {entry.note ? 'Cancel' : 'Skip'}
              </Button>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
