import { useEffect, useState } from 'react'
import { Box, Button, Flex, Input, Stack, Text } from '@chakra-ui/react'
import { LuCheck, LuCloudUpload } from 'react-icons/lu'
import type { CloudInfo } from '@shared/types'
import { ipcErrorMessage } from '../store/ipcError'
import { useDailyStore } from '../store/useDailyStore'
import { useInterestsStore } from '../store/useInterestsStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { refreshUsage } from '../store/useUsageStore'
import { field, primaryButton, secondaryButton } from '../theme/styles'

/** Once connected, or after an upload, everything on screen comes from the cloud. */
function reloadAll(): void {
  void useSettingsStore.getState().load()
  void useInterestsStore.getState().load()
  void useDailyStore.getState().load()
  refreshUsage()
}

const inputStyle = { ...field, h: '38px', bg: 'app.surfaceSubtle' }

/**
 * Desktop only: where the cloud is, and the Cloudflare Access service token
 * that lets this device in. The secret is write-only, like the Gemini key —
 * the page is told only whether one is saved.
 */
export default function CloudSection(): React.JSX.Element | null {
  const cloud = window.api.cloud
  const [info, setInfo] = useState<CloudInfo | null>(null)
  const [url, setUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  useEffect(() => {
    void cloud?.get().then((next) => {
      setInfo(next)
      setUrl(next.url)
    })
  }, [cloud])

  if (!cloud) return null

  async function connect(): Promise<void> {
    setSaving(true)
    setMessage(null)
    try {
      const next = await cloud!.set({ url, clientId, clientSecret })
      setInfo(next)
      setUrl(next.url)
      setClientId('')
      setClientSecret('')
      setMessage({ tone: 'success', text: 'Connected.' })
      reloadAll()
    } catch (failure) {
      setMessage({ tone: 'danger', text: ipcErrorMessage(failure) })
    } finally {
      setSaving(false)
    }
  }

  async function upload(): Promise<void> {
    setUploading(true)
    setMessage(null)
    try {
      const { imported } = await cloud!.upload()
      setInfo(await cloud!.get())
      setMessage({ tone: 'success', text: `Uploaded: ${imported.join(', ')}.` })
      reloadAll()
    } catch (failure) {
      setMessage({ tone: 'danger', text: ipcErrorMessage(failure) })
    } finally {
      setUploading(false)
    }
  }

  const savedToken = info?.hasToken ? 'Saved — leave empty to keep' : undefined

  return (
    <Stack gap="4">
      <Box>
        <Text asChild display="block" fontSize="13px" fontWeight="600" color="app.text" mb="1.5">
          <label htmlFor="cloud-url">Address</label>
        </Text>
        <Input
          id="cloud-url"
          value={url}
          placeholder="https://career-app.you.workers.dev"
          spellCheck={false}
          onChange={(event) => setUrl(event.target.value)}
          {...inputStyle}
        />
      </Box>
      <Box>
        <Text fontSize="13px" fontWeight="600" color="app.text" mb="1.5">
          Service token
        </Text>
        <Flex gap="2" wrap="wrap">
          <Input
            aria-label="Client ID"
            value={clientId}
            placeholder={savedToken ?? 'Client ID'}
            spellCheck={false}
            onChange={(event) => setClientId(event.target.value)}
            flex="1 1 200px"
            {...inputStyle}
          />
          <Input
            aria-label="Client secret"
            type="password"
            value={clientSecret}
            placeholder={savedToken ?? 'Client secret'}
            onChange={(event) => setClientSecret(event.target.value)}
            flex="1 1 200px"
            {...inputStyle}
          />
        </Flex>
        <Text fontSize="12px" color="app.textFaint" mt="1.5" lineHeight="1.5">
          From Cloudflare Zero Trust → Access → Service credentials. The browser signs in with an email
          code instead; this app uses the token.
        </Text>
      </Box>

      <Flex align="center" gap="3" wrap="wrap">
        <Button h="38px" px="4" {...primaryButton} loading={saving} disabled={!url.trim()} onClick={() => void connect()}>
          {info?.url ? 'Save and reconnect' : 'Connect'}
        </Button>
        {message && (
          <Flex align="center" gap="1.5" fontSize="13px" color={message.tone === 'success' ? 'app.success' : 'app.danger'}>
            {message.tone === 'success' && <LuCheck />}
            <Text role={message.tone === 'danger' ? 'alert' : undefined}>{message.text}</Text>
          </Flex>
        )}
      </Flex>

      {info?.url && info.canUpload && (
        <Box p="4" bg="app.surfaceSubtle" borderWidth="1px" borderColor="app.border" borderRadius="10px">
          <Text fontSize="14px" fontWeight="600" color="app.text">
            This computer has data from before the cloud
          </Text>
          <Text fontSize="13px" color="app.textMuted" mt="1" mb="3">
            Upload your interests, suggestions, quiz history and Gemini key once. The cloud refuses if it
            already has data, so nothing there is overwritten; the files stay here as a backup.
          </Text>
          <Button h="36px" px="3.5" gap="2" {...secondaryButton} loading={uploading} onClick={() => void upload()}>
            <LuCloudUpload /> Upload to the cloud
          </Button>
        </Box>
      )}
    </Stack>
  )
}
