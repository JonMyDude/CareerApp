import { useState } from 'react'
import { Box, chakra, Flex, Text } from '@chakra-ui/react'
import { LuBell, LuDownload } from 'react-icons/lu'
import { useHistoryExport } from '../lib/exportHistory'
import { ipcErrorMessage } from '../store/ipcError'
import { useSettingsStore } from '../store/useSettingsStore'
import { card } from '../theme/styles'
import { SwitchTrack } from './ToggleSwitch'

/** A whole row that acts: icon, title, one line of detail, and an optional control at the end. */
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  w: 'full',
  px: '3',
  py: '2.5',
  borderRadius: '9px',
  color: 'app.text',
  textAlign: 'left',
  cursor: 'pointer',
  _hover: { bg: 'app.surfaceHover' },
  _disabled: { cursor: 'progress', opacity: 0.7 }
} as const

function RowText({ title, detail, tone }: { title: string; detail: string; tone?: 'danger' }): React.JSX.Element {
  return (
    <Box as="span" flex="1" minW="0">
      <Text as="span" display="block" fontSize="13px" fontWeight="600">
        {title}
      </Text>
      <Text as="span" display="block" fontSize="12px" color={tone === 'danger' ? 'app.danger' : 'app.textFaint'}>
        {detail}
      </Text>
    </Box>
  )
}

/**
 * The reminder switch and the Markdown export, next to the Daily feed. Both
 * also live in Settings, which has the reminder's time and the tray options.
 */
export default function DailyActions({ total }: { total: number }): React.JSX.Element | null {
  const settings = useSettingsStore((state) => state.settings)
  const update = useSettingsStore((state) => state.update)
  const [reminderError, setReminderError] = useState<string | null>(null)
  const exporter = useHistoryExport()
  // The reminder is a notification on the desktop or phone; a browser tab has no way to nudge you.
  const reminder = window.api.platform !== 'web' ? settings?.reminder : undefined

  async function toggleReminder(): Promise<void> {
    if (!reminder) return
    setReminderError(null)
    try {
      await update({ reminder: { enabled: !reminder.enabled, time: reminder.time } })
    } catch (failure) {
      setReminderError(ipcErrorMessage(failure))
    }
  }

  // Settings not loaded yet and nothing to export: no empty card.
  if (!reminder && total === 0) return null

  return (
    <Box {...card} p="1.5">
      {reminder && (
        <chakra.button
          type="button"
          role="switch"
          aria-checked={reminder.enabled}
          onClick={() => void toggleReminder()}
          {...rowStyle}
        >
          <Box as="span" display="flex" color="app.textMuted">
            <LuBell />
          </Box>
          <RowText
            title="Daily reminder"
            detail={reminderError ?? (reminder.enabled ? `Every day at ${reminder.time}` : 'Off')}
            tone={reminderError ? 'danger' : undefined}
          />
          <SwitchTrack checked={reminder.enabled} />
        </chakra.button>
      )}

      {total > 0 && (
        <chakra.button
          type="button"
          disabled={exporter.busy}
          onClick={() => void exporter.run()}
          {...rowStyle}
        >
          <Flex as="span" color="app.textMuted">
            <LuDownload />
          </Flex>
          <RowText
            title="Export to Markdown"
            detail={
              exporter.error ??
              (exporter.busy
                ? 'Exporting…'
                : exporter.saved
                  ? `Saved ${exporter.saved}`
                  : `All ${total} ${total === 1 ? 'suggestion' : 'suggestions'} and notes`)
            }
            tone={exporter.error ? 'danger' : undefined}
          />
        </chakra.button>
      )}
    </Box>
  )
}
