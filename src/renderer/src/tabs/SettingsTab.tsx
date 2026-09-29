import { useEffect, useState } from 'react'
import { Box, Button, Flex, Heading, Input, Spinner, Stack, Text } from '@chakra-ui/react'
import { LuBellRing, LuCheck, LuFileDown, LuMonitor, LuMoon, LuSun } from 'react-icons/lu'
import { TIME_PATTERN } from '@shared/reminder'
import type { SettingsInfo, SettingsPatch } from '@shared/types'
import ApiKeyPanel from '../components/ApiKeyPanel'
import Page from '../components/Page'
import SegmentedControl from '../components/SegmentedControl'
import ToggleSwitch from '../components/ToggleSwitch'
import { useHistoryExport } from '../lib/exportHistory'
import { ipcErrorMessage } from '../store/ipcError'
import { useSettingsStore } from '../store/useSettingsStore'
import { card, field, primaryButton, quietButton, secondaryButton } from '../theme/styles'
import { useColorMode, type ColorModePreference } from '../theme/useColorMode'

/**
 * Everything that used to mean editing config.json by hand. Each field saves
 * on its own and is validated in the main process; what's shown afterwards is
 * read back from disk.
 */

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Box as="section" {...card} p="6">
      <Heading as="h2" fontSize="17px" fontWeight="600" color="app.text" mb="1">
        {title}
      </Heading>
      {description && (
        <Text fontSize="13px" color="app.textMuted" mb="5">
          {description}
        </Text>
      )}
      <Stack gap="5">{children}</Stack>
    </Box>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Box>
      <Text asChild display="block" fontSize="13px" fontWeight="600" color="app.text" mb="1.5">
        <label htmlFor={htmlFor}>{label}</label>
      </Text>
      {children}
      {error ? (
        <Text fontSize="12px" color="app.danger" mt="1.5" role="alert">
          {error}
        </Text>
      ) : (
        hint && (
          <Text fontSize="12px" color="app.textFaint" mt="1.5" lineHeight="1.5">
            {hint}
          </Text>
        )
      )}
    </Box>
  )
}

/** Inputs sit on a card here, so they take the subtle surface to stand apart from it. */
const inputStyle = { ...field, h: '38px', bg: 'app.surfaceSubtle' }

function SaveButton({
  onClick,
  disabled,
  loading
}: {
  onClick: () => void
  disabled: boolean
  loading: boolean
}): React.JSX.Element {
  return (
    <Button h="38px" px="4" flexShrink="0" onClick={onClick} disabled={disabled} loading={loading} {...primaryButton}>
      Save
    </Button>
  )
}

const THEME_OPTIONS: { value: ColorModePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <LuSun /> },
  { value: 'dark', label: 'Dark', icon: <LuMoon /> },
  { value: 'system', label: 'System', icon: <LuMonitor /> }
]

function ThemePicker(): React.JSX.Element {
  const { preference, setPreference } = useColorMode()
  return (
    <SegmentedControl
      label="Theme"
      value={preference}
      options={THEME_OPTIONS}
      onChange={setPreference}
      bg="app.surfaceSubtle"
    />
  )
}

function ModelField({ settings }: { settings: SettingsInfo }): React.JSX.Element {
  const update = useSettingsStore((state) => state.update)
  const custom = settings.model !== settings.defaultModel
  const saved = custom ? settings.model : ''
  const [value, setValue] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(next: string): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await update({ model: next })
      const trimmed = next.trim()
      setValue(trimmed === settings.defaultModel ? '' : trimmed)
    } catch (failure) {
      setError(ipcErrorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Field
      label="Model"
      htmlFor="settings-model"
      error={error}
      hint={`Leave empty for the default, ${settings.defaultModel}. A name Google doesn't recognise shows up as "model unavailable" on the next AI call.`}
    >
      <Flex gap="2">
        <Input
          id="settings-model"
          value={value}
          placeholder={settings.defaultModel}
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim() !== saved) void save(value)
          }}
          {...inputStyle}
        />
        <SaveButton
          onClick={() => void save(value)}
          disabled={value.trim() === saved || saving}
          loading={saving}
        />
        {custom && (
          <Button h="38px" px="3.5" flexShrink="0" {...quietButton} onClick={() => void save('')} disabled={saving}>
            Use default
          </Button>
        )}
      </Flex>
    </Field>
  )
}

function BudgetField({ settings }: { settings: SettingsInfo }): React.JSX.Element {
  const update = useSettingsStore((state) => state.update)
  const saved = settings.dailyTokenBudget === null ? '' : String(settings.dailyTokenBudget)
  const [value, setValue] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(raw: string): Promise<void> {
    // "50,000", "50.000" and "50 000" all mean fifty thousand.
    const digits = raw.trim().replace(/[\s,._']/g, '')
    const budget = digits === '' ? null : Number(digits)
    if (budget !== null && !Number.isFinite(budget)) {
      setError('Enter a number of tokens, like 50000.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await update({ dailyTokenBudget: budget })
      setValue(budget === null ? '' : String(budget))
    } catch (failure) {
      setError(ipcErrorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Field
      label="Daily token budget"
      htmlFor="settings-budget"
      error={error}
      hint="Only fills the token meter in the rail, and turns it red once passed. Google doesn't enforce it. Leave empty for none."
    >
      <Flex gap="2" maxW="360px">
        <Input
          id="settings-budget"
          value={value}
          placeholder="No budget"
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim() !== saved) void save(value)
          }}
          {...inputStyle}
        />
        <SaveButton
          onClick={() => void save(value)}
          disabled={value.trim() === saved || saving}
          loading={saving}
        />
      </Flex>
    </Field>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <Flex align="flex-start" justify="space-between" gap="6">
      <Box>
        <Text fontSize="14px" fontWeight="600" color="app.text">
          {label}
        </Text>
        <Text fontSize="12px" color="app.textFaint" mt="0.5" lineHeight="1.5">
          {hint}
        </Text>
      </Box>
      <ToggleSwitch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </Flex>
  )
}

const TEST_MESSAGES = {
  shown: 'Sent. Look in the Windows notification area.',
  refused: 'Windows refused it. Check that notifications are on for Career App in Windows Settings.',
  unknown: "Sent, but Windows didn't confirm it. If nothing appeared, check Focus assist."
} as const

function ReminderSection({ settings }: { settings: SettingsInfo }): React.JSX.Element {
  const update = useSettingsStore((state) => state.update)
  const [time, setTime] = useState(settings.reminder.time)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState<keyof typeof TEST_MESSAGES | null>(null)

  async function save(patch: SettingsPatch): Promise<void> {
    setError(null)
    try {
      await update(patch)
    } catch (failure) {
      setError(ipcErrorMessage(failure))
    }
  }

  function saveTime(): void {
    if (time === settings.reminder.time) return
    if (!TIME_PATTERN.test(time)) {
      setError('Pick a reminder time like 09:00.')
      return
    }
    void save({ reminder: { enabled: settings.reminder.enabled, time } })
  }

  async function sendTest(): Promise<void> {
    setTesting(true)
    setTested(null)
    try {
      const { shown } = await window.api.reminder.test()
      setTested(shown === true ? 'shown' : shown === false ? 'refused' : 'unknown')
    } catch (failure) {
      setError(ipcErrorMessage(failure))
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <SwitchRow
        label="Remind me each day"
        hint="A Windows notification with today's suggestion. If today's isn't written yet, it's generated then — the same single call opening the app would make."
        checked={settings.reminder.enabled}
        onChange={(enabled) => void save({ reminder: { enabled, time: settings.reminder.time } })}
      />
      <Field label="Time" htmlFor="settings-reminder-time">
        <Input
          id="settings-reminder-time"
          type="time"
          value={time}
          disabled={!settings.reminder.enabled}
          onChange={(event) => setTime(event.target.value)}
          // Saved once the user leaves the field; a time input changes per segment.
          onBlur={saveTime}
          onKeyDown={(event) => {
            if (event.key === 'Enter') saveTime()
          }}
          maxW="140px"
          {...inputStyle}
        />
      </Field>
      <SwitchRow
        label="Keep running in the tray"
        hint="Closing the window hides it to the notification area instead of quitting, so the reminder can still fire. Quit from the tray icon's menu."
        checked={settings.closeToTray}
        onChange={(closeToTray) => void save({ closeToTray })}
      />
      {settings.reminder.enabled && !settings.closeToTray && (
        <Text fontSize="12px" color="app.textMuted" data-tray-hint>
          Reminders only fire while the app is open. Turn on the tray to get them after closing the
          window.
        </Text>
      )}
      <SwitchRow
        label="Start with Windows"
        hint={
          settings.openAtLogin === null
            ? 'Available in the installed app.'
            : 'Starts when you sign in. With the tray on, it waits there instead of opening a window.'
        }
        checked={settings.openAtLogin === true}
        disabled={settings.openAtLogin === null}
        onChange={(openAtLogin) => void save({ openAtLogin })}
      />
      <Box>
        <Button h="36px" px="3.5" gap="2" {...secondaryButton} loading={testing} onClick={() => void sendTest()}>
          <LuBellRing /> Send a test notification
        </Button>
        {tested && (
          <Text
            fontSize="12px"
            mt="1.5"
            color={tested === 'shown' ? 'app.success' : 'app.textMuted'}
            data-test-result
          >
            {TEST_MESSAGES[tested]}
          </Text>
        )}
      </Box>
      {error && (
        <Text fontSize="12px" color="app.danger" role="alert">
          {error}
        </Text>
      )}
    </>
  )
}

function ExportRow(): React.JSX.Element {
  const { run, busy, saved, error } = useHistoryExport()

  return (
    <Field
      label="Export history"
      error={error}
      hint="Every daily suggestion with its note and explanation, newest first, as a Markdown file you choose where to save."
    >
      <Flex align="center" gap="3" wrap="wrap">
        <Button h="36px" px="3.5" gap="2" {...secondaryButton} loading={busy} onClick={() => void run()}>
          <LuFileDown /> Export to Markdown…
        </Button>
        {saved && (
          <Flex align="center" gap="1" fontSize="13px" color="app.success" data-export-result>
            <LuCheck />
            <Text>Saved {saved}</Text>
            <Button
              variant="plain"
              size="xs"
              color="app.accent"
              _hover={{ textDecoration: 'underline' }}
              onClick={() => void window.api.export.reveal()}
            >
              Show in folder
            </Button>
          </Flex>
        )}
      </Flex>
    </Field>
  )
}

export default function SettingsTab(): React.JSX.Element {
  const settings = useSettingsStore((state) => state.settings)
  const load = useSettingsStore((state) => state.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Page eyebrow="Each change saves on its own" title="Settings">
      <Stack gap="4" maxW="720px">
        <Section title="Appearance" description="System follows Windows' own light or dark setting.">
          <ThemePicker />
        </Section>

        <Section
          title="Gemini"
          description="Used for daily suggestions, explanations and quiz questions. The only network calls the app makes go to Google's API."
        >
          {!settings ? (
            <Spinner color="app.accent" size="sm" />
          ) : (
            <>
              <Box>
                <Flex
                  align="center"
                  gap="1.5"
                  fontSize="14px"
                  mb="3"
                  color={settings.hasApiKey ? 'app.success' : 'app.textMuted'}
                >
                  {settings.hasApiKey && <LuCheck />}
                  <Text>
                    {settings.hasApiKey
                      ? 'An API key is saved. It never leaves the background process.'
                      : 'No API key yet. Suggestions, explanations and quizzes need one.'}
                  </Text>
                </Flex>
                <ApiKeyPanel variant={settings.hasApiKey ? 'replace' : 'setup'} />
              </Box>
              {/* Keyed on the saved value, so a change from elsewhere resets the draft. */}
              <ModelField key={`model:${settings.model}`} settings={settings} />
              <BudgetField key={`budget:${settings.dailyTokenBudget}`} settings={settings} />
            </>
          )}
        </Section>

        <Section title="Daily reminder" description="A nudge at the time you pick, while the app is running.">
          {settings ? (
            <ReminderSection
              // Remount when the saved time changes elsewhere, so the draft follows it.
              key={`reminder:${settings.reminder.time}`}
              settings={settings}
            />
          ) : (
            <Spinner color="app.accent" size="sm" />
          )}
        </Section>

        <Section
          title="Data"
          description="Everything the app keeps is stored on this computer, in its app data folder."
        >
          <ExportRow />
        </Section>
      </Stack>
    </Page>
  )
}
