import { Box, Flex, IconButton, Tabs } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { LuMoon, LuSun } from 'react-icons/lu'
import { SETTINGS_TAB, TABS } from '../tabs/config'
import UsageMeter from './UsageMeter'
import { useNavStore } from '../store/useNavStore'
import { springSnappy } from '../theme/motion'
import { useColorMode } from '../theme/useColorMode'

/** The chip behind the selected rail icon. One layoutId, so it glides between icons. */
function SelectedChip(): React.JSX.Element {
  return (
    <motion.div
      layoutId="rail-selected"
      transition={springSnappy}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 10,
        background: 'var(--app-rail-active-bg)'
      }}
    />
  )
}

interface Props {
  /** The selected tab id, so the indicator can be rendered in the right trigger. */
  selected: string
}

/**
 * Icon-only vertical nav. Must be rendered inside <Tabs.Root> — Tabs.List and
 * Tabs.Trigger read the tab state from its context.
 *
 * Icon-only means the visible label is gone, so every control carries an
 * aria-label (screen readers) and a title (hover tooltip).
 *
 * The selected chip is one shared-layout element (`layoutId`) rendered inside
 * whichever trigger is active, so Motion glides it between icons rather than
 * one chip vanishing and another appearing.
 */
export default function SideRail({ selected }: Props): React.JSX.Element {
  const { resolved, toggle } = useColorMode()
  const nextMode = resolved === 'dark' ? 'light' : 'dark'
  const setTab = useNavStore((state) => state.setTab)
  const settingsOpen = selected === SETTINGS_TAB.id

  return (
    <Flex
      direction="column"
      align="center"
      flexShrink="0"
      w="60px"
      py="3"
      bg="app.railBg"
      borderRightWidth="1px"
      borderColor="app.border"
    >
      <Tabs.List
        flexDirection="column"
        gap="1"
        border="none"
        bg="transparent"
        p="0"
        w="full"
        alignItems="center"
      >
        {TABS.map(({ id, label, icon }, position) => (
          <Tabs.Trigger
            key={id}
            value={id}
            aria-label={label}
            // The shortcut goes in the tooltip only; the accessible name stays the label.
            title={`${label} (Ctrl+${position + 1})`}
            position="relative"
            justifyContent="center"
            w="42px"
            h="42px"
            p="0"
            fontSize="lg"
            borderRadius="10px"
            color="app.railIcon"
            _hover={{ bg: 'app.railHoverBg', color: 'app.text' }}
            // No `bg` here any more — the gliding chip below paints it.
            _selected={{ color: 'app.railActiveFg' }}
          >
            {selected === id && <SelectedChip />}
            {/* Above the chip, which is absolutely positioned behind it. */}
            <Box as="span" position="relative" zIndex="1" display="flex">
              {icon}
            </Box>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Flex flex="1" />

      {/* Sits directly above the theme toggle, like Claude Code's context bar. */}
      <Box mb="1">
        <UsageMeter />
      </Box>

      <IconButton
        aria-label={`Switch to ${nextMode} mode`}
        title={`Switch to ${nextMode} mode`}
        onClick={toggle}
        variant="ghost"
        w="42px"
        h="42px"
        fontSize="lg"
        borderRadius="10px"
        color="app.railIcon"
        _hover={{ bg: 'app.railHoverBg', color: 'app.text' }}
      >
        {resolved === 'dark' ? <LuSun /> : <LuMoon />}
      </IconButton>

      {/* Not a Tabs.Trigger — Settings sits apart from the tab list — but it
          shows the same chip, so the selection glides down here too. */}
      <IconButton
        aria-label={SETTINGS_TAB.label}
        aria-current={settingsOpen ? 'page' : undefined}
        title={`${SETTINGS_TAB.label} (Ctrl+,)`}
        onClick={() => setTab('settings')}
        variant="ghost"
        position="relative"
        mt="1"
        w="42px"
        h="42px"
        fontSize="lg"
        borderRadius="10px"
        color={settingsOpen ? 'app.railActiveFg' : 'app.railIcon'}
        _hover={{ bg: settingsOpen ? 'transparent' : 'app.railHoverBg', color: 'app.text' }}
      >
        {settingsOpen && <SelectedChip />}
        <Box as="span" position="relative" zIndex="1" display="flex">
          {SETTINGS_TAB.icon}
        </Box>
      </IconButton>
    </Flex>
  )
}
