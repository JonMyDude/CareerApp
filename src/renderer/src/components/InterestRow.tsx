import { useState } from 'react'
import { Box, Button, chakra, Flex, IconButton, Input, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuCheck, LuPencil, LuTrash2, LuX } from 'react-icons/lu'
import { IMPORTANCE_LABELS, MAX_TITLE_LENGTH, type Importance, type Interest } from '@shared/types'
import { useInterestsStore } from '../store/useInterestsStore'
import { crossfade } from '../theme/motion'
import { field, iconButton, quietButton } from '../theme/styles'

interface Props {
  interest: Interest
  /** A line under the title: when it was last picked and how much got done. */
  meta: string
  /** The first row of a group has no rule above it. */
  first: boolean
}

/** Lays a crossfading branch out the same way the row's own Flex did. */
const branchStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flex: 1,
  minWidth: 0
}

const LEVELS: Importance[] = [1, 2, 3]

/**
 * Three rising bars, filled up to the level. Each bar is a radio, so clicking
 * bar 3 means High, which moves the row to the High group. The level also
 * weights the Daily picks.
 */
function ImportanceBars({
  value,
  onChange
}: {
  value: Importance
  onChange: (next: Importance) => void
}): React.JSX.Element {
  return (
    <Flex role="radiogroup" aria-label="Importance" align="flex-end" h="22px" flexShrink="0" data-importance={value}>
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
          h="22px"
          px="2px"
          cursor="pointer"
          borderRadius="3px"
        >
          <Box
            w="6px"
            h={`${6 + level * 5}px`}
            borderRadius="3px"
            bg={level <= value ? 'app.accent' : 'app.borderStrong'}
            transition="background-color 120ms ease"
          />
        </chakra.button>
      ))}
    </Flex>
  )
}

export default function InterestRow({ interest, meta, first }: Props): React.JSX.Element {
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
      minH="70px"
      py="3.5"
      pl="4.5"
      pr="3"
      borderTopWidth={first ? '0' : '1px'}
      borderColor="app.border"
      transition="background-color 120ms ease"
      _hover={{ bg: 'app.surfaceSubtle' }}
    >
      {/* popLayout, not wait: the edit input mounts at once, so autoFocus lands
          immediately and no keystroke typed right after the click is lost. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {editing ? (
          <motion.div key="edit" variants={crossfade} initial="hidden" animate="shown" exit="exit" style={{ ...branchStyle, gap: 4 }}>
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
              h="38px"
              mr="2"
              {...field}
              bg="app.surfaceSubtle"
            />
            <IconButton
              aria-label="Save"
              size="xs"
              {...iconButton}
              color="app.success"
              _hover={{ bg: 'app.surfaceHover', color: 'app.success' }}
              onClick={() => void save()}
            >
              <LuCheck />
            </IconButton>
            <IconButton aria-label="Cancel" size="xs" {...iconButton} onClick={() => setEditing(false)}>
              <LuX />
            </IconButton>
          </motion.div>
        ) : (
          <motion.div key="view" variants={crossfade} initial="hidden" animate="shown" exit="exit" style={branchStyle}>
            <Box flex="1" minW="0">
              <Text fontSize="15px" fontWeight="500" lineHeight="1.45" color="app.text" truncate title={interest.title}>
                {interest.title}
              </Text>
              <Text mt="0.5" fontSize="12px" color="app.textFaint" truncate>
                {meta}
              </Text>
            </Box>

            <ImportanceBars
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
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Text fontSize="13px" color="app.textMuted" mr="1">
                    Delete?
                  </Text>
                  <Button
                    size="xs"
                    borderRadius="7px"
                    bg="app.danger"
                    color="app.accentFg"
                    _hover={{ bg: 'app.dangerHover' }}
                    onClick={() => void remove(interest.id)}
                  >
                    Yes
                  </Button>
                  <Button size="xs" {...quietButton} borderRadius="7px" onClick={() => setConfirmingDelete(false)}>
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
                  <IconButton aria-label={`Edit ${interest.title}`} title="Edit" size="xs" {...iconButton} onClick={startEditing}>
                    <LuPencil />
                  </IconButton>
                  <IconButton
                    aria-label={`Delete ${interest.title}`}
                    title="Delete"
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
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  )
}
