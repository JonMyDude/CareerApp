import { useState } from 'react'
import { Box, Button, Flex, Input, Text } from '@chakra-ui/react'
import { LuKey } from 'react-icons/lu'
import { ipcErrorMessage } from '../store/ipcError'
import { useDailyStore } from '../store/useDailyStore'
import { card, field, primaryButton } from '../theme/styles'

interface Props {
  /** Prominent when there's no key at all; quiet when replacing an existing one. */
  variant: 'setup' | 'replace'
}

/**
 * The one place a key is entered. It goes straight to the main process and is
 * written to userData — the renderer never reads it back, and `settings.get()`
 * only ever reports whether one exists.
 */
export default function ApiKeyPanel({ variant }: Props): React.JSX.Element {
  const saveApiKey = useDailyStore((state) => state.saveApiKey)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  async function save(): Promise<void> {
    if (!key.trim() || saving) return
    setSaving(true)
    setFailed(null)
    try {
      await saveApiKey(key)
      setKey('')
    } catch (error) {
      setFailed(ipcErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box
      {...card}
      bg={variant === 'setup' ? 'app.surface' : 'app.surfaceSubtle'}
      p={variant === 'setup' ? '6' : '4'}
    >
      <Flex align="center" gap="2" mb="1" color="app.text">
        <LuKey />
        <Text fontWeight="600">{variant === 'setup' ? 'Add your Gemini API key' : 'Replace API key'}</Text>
      </Flex>
      <Text fontSize="13px" color="app.textMuted" mb="3">
        Stored locally in your app data folder and used only by the background process.
      </Text>

      <Flex gap="2">
        <Input
          type="password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save()
          }}
          placeholder="Paste your API key"
          aria-label="Gemini API key"
          h="38px"
          {...field}
        />
        <Button
          h="38px"
          px="4"
          onClick={() => void save()}
          disabled={!key.trim() || saving}
          loading={saving}
          {...primaryButton}
        >
          Save
        </Button>
      </Flex>

      {failed && (
        <Text fontSize="13px" color="app.danger" mt="2">
          {failed}
        </Text>
      )}
    </Box>
  )
}
