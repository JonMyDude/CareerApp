import { useState } from 'react'
import { Button, Flex, Input } from '@chakra-ui/react'
import { LuPlus } from 'react-icons/lu'
import { MAX_TITLE_LENGTH } from '@shared/types'
import { useInterestsStore } from '../store/useInterestsStore'

export default function AddInterestForm(): React.JSX.Element {
  const add = useInterestsStore((state) => state.add)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0 && !saving

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      await add({ title: trimmed })
      setTitle('')
    } catch {
      // The store already surfaced the message; keep what was typed.
    } finally {
      setSaving(false)
    }
  }

  return (
    <Flex as="form" gap="2" onSubmit={handleSubmit}>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Something you want to learn…"
        maxLength={MAX_TITLE_LENGTH}
        aria-label="New interest"
        bg="app.surface"
        color="app.text"
        borderColor="app.border"
        _placeholder={{ color: 'app.textFaint' }}
        _hover={{ borderColor: 'app.borderStrong' }}
      />
      <Button
        type="submit"
        disabled={!canSubmit}
        loading={saving}
        bg="app.accent"
        color="app.accentFg"
        _hover={{ bg: 'app.accentHover' }}
        px="5"
      >
        <LuPlus /> Add
      </Button>
    </Flex>
  )
}
