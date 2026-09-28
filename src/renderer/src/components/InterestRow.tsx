import { useState } from 'react'
import { Box, Button, chakra, Flex, IconButton, Input, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuCheck, LuPencil, LuTrash2, LuX } from 'react-icons/lu'
import { IMPORTANCE_LABELS, MAX_TITLE_LENGTH, type Importance, type Interest } from '@shared/types'
import { useInterestsStore } from '../store/useInterestsStore'
import { crossfade } from '../theme/motion'

interface Props {
  interest: Interest
}

/** Lays a crossfading branch out the same way the row's own Flex did. */
const branchStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  minWidth: 0
}

const LEVELS: Importance[] = [1, 2, 3]

/**
 * Three bars, filled up to the level, then its name. Each bar is a radio, so
 * clicking bar 3 means High. The level also weights the Daily picks.
 */
function ImportanceMeter({
  value,
  onChange
}: {
  value: Importance
  onChange: (next: Importance) => void
}): React.JSX.Element {
  return (
    <Flex align="center" gap="2" flexShrink="0" data-importance={value}>
      <Flex role="radiogroup" aria-label="Importance" align="flex-end" gap="1">
        {LEVELS.map((level) => (
          <chakra.button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            aria-label={IMPORTANCE_LABELS[level]}
            title={`${IMPORTANCE_LABELS[level]} importance`}
            onClick={() => level !== value && onChange(level)}
            // A taller hit area than the bar itself.
            display="flex"
            alignItems="flex-end"
            h="20px"
            px="1px"
            cursor="pointer"
            _focusVisible={{ outline: '2px solid var(--app-focus-ring)', borderRadius: 'sm' }}
          >
            <Box
              w="6px"
              h={`${6 + level * 4}px`}
              borderRadius="sm"
              bg={level <= value ? 'app.accent' : 'app.border'}
              transition="background-color 120ms ease"
            />
          </chakra.button>
        ))}
      </Flex>
      <Text fontSize="xs" color="app.textMuted" w="46px">
        {IMPORTANCE_LABELS[value]}
      </Text>
    </Flex>
  )
}

export default function InterestRow({ interest }: Props): React.JSX.Element {
  const edit = useInterestsStore((state) => state.edit)
  const remove = useInterestsStore((state) => state.remove)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(interest.title)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function startEditing(): void {
    setDraft(interest.title)
    setEditing(true)
  }

  async function save(): Promise<void> {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === interest.title) {
      setEditing(false)
      return
    }
    try {
      await edit(interest.id, { title: trimmed })
      setEditing(false)
    } catch {
      // Stay in edit mode so the typed value isn't lost.
    }
  }

  return (
    <Flex
      position="relative"
      align="center"
      gap="2"
      px="4"
      py="3"
      bg="app.surface"
      borderWidth="1px"
      borderColor="app.border"
      borderRadius="md"
      boxShadow="app"
      _hover={{ borderColor: 'app.borderStrong' }}
    >
      {/* popLayout, not wait: the edit input mounts at once, so autoFocus lands
          immediately and no keystroke typed right after the click is lost. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            variants={crossfade}
            initial="hidden"
            animate="shown"
            exit="exit"
            style={branchStyle}
          >
            <Input
              autoFocus
              value={draft}
              maxLength={MAX_TITLE_LENGTH}
              aria-label="Edit interest"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void save()
                if (event.key === 'Escape') setEditing(false)
              }}
              size="sm"
              bg="app.surfaceSubtle"
              color="app.text"
              borderColor="app.border"
            />
            <IconButton
              aria-label="Save"
              size="sm"
              variant="ghost"
              color="app.success"
              onClick={() => void save()}
            >
              <LuCheck />
            </IconButton>
            <IconButton
              aria-label="Cancel"
              size="sm"
              variant="ghost"
              color="app.textMuted"
              onClick={() => setEditing(false)}
            >
              <LuX />
            </IconButton>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            variants={crossfade}
            initial="hidden"
            animate="shown"
            exit="exit"
            style={branchStyle}
          >
            <Box flex="1" minW="0">
              <Text color="app.text" truncate>
                {interest.title}
              </Text>
            </Box>

            <ImportanceMeter
              value={interest.importance}
              onChange={(importance) => void edit(interest.id, { importance }).catch(() => {})}
            />

            <AnimatePresence mode="wait" initial={false}>
              {confirmingDelete ? (
                <motion.div
                  key="confirm"
                  variants={crossfade}
                  initial="hidden"
                  animate="shown"
                  exit="exit"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Text fontSize="sm" color="app.textMuted">
                    Delete?
                  </Text>
                  <Button
                    size="xs"
                    bg="app.danger"
                    color="app.accentFg"
                    _hover={{ bg: 'app.dangerHover' }}
                    onClick={() => void remove(interest.id)}
                  >
                    Yes
                  </Button>
                  <Button
                    size="xs"
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
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <IconButton
                    aria-label={`Edit ${interest.title}`}
                    size="sm"
                    variant="ghost"
                    color="app.textMuted"
                    _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
                    onClick={startEditing}
                  >
                    <LuPencil />
                  </IconButton>
                  <IconButton
                    aria-label={`Delete ${interest.title}`}
                    size="sm"
                    variant="ghost"
                    color="app.textMuted"
                    _hover={{ bg: 'app.surfaceHover', color: 'app.danger' }}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  )
}
