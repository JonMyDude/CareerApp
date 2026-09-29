import { useState } from 'react'
import { Button, Flex, Input } from '@chakra-ui/react'
import { LuPlus } from 'react-icons/lu'
import { DEFAULT_IMPORTANCE, IMPORTANCE_LABELS, MAX_TITLE_LENGTH, type Importance } from '@shared/types'
import { useInterestsStore } from '../store/useInterestsStore'
import { card, primaryButton } from '../theme/styles'
import SegmentedControl from './SegmentedControl'

const LEVELS: { value: Importance; label: string }[] = ([1, 2, 3] as const).map((value) => ({
  value,
  label: IMPORTANCE_LABELS[value]
}))

/** Title and importance in one bar. The level stays put, for adding several alike. */
export default function AddInterestForm(): React.JSX.Element {
  const add = useInterestsStore((state) => state.add)
  const [title, setTitle] = useState('')
  const [importance, setImportance] = useState<Importance>(DEFAULT_IMPORTANCE)
  const [saving, setSaving] = useState(false)

  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0 && !saving

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      await add({ title: trimmed, importance })
      setTitle('')
    } catch {
      // The store already surfaced the message; keep what was typed.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Flex as="form" {...card} wrap="wrap" gap="2" p="2" onSubmit={handleSubmit}>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Something you want to learn…"
        maxLength={MAX_TITLE_LENGTH}
        aria-label="New interest"
        flex="1 1 240px"
        minW="0"
        h="42px"
        fontSize="15px"
        bg="transparent"
        color="app.text"
        borderColor="transparent"
        borderRadius="9px"
        _placeholder={{ color: 'app.textFaint' }}
      />
      {/* One piece, so a narrow window puts both under the title rather than splitting them. */}
      <Flex gap="2" flexShrink="0">
        <SegmentedControl
          label="Importance of the new interest"
          value={importance}
          options={LEVELS}
          onChange={setImportance}
          h="42px"
          bg="app.surfaceSubtle"
          borderColor="transparent"
        />
        <Button type="submit" h="42px" px="4" gap="2" disabled={!canSubmit} loading={saving} {...primaryButton}>
          <LuPlus /> Add
        </Button>
      </Flex>
    </Flex>
  )
}
