import { Box, chakra, Flex, Image, Tabs, Text } from '@chakra-ui/react'
import logo from '../logo.png'
import { SETTINGS_TAB, TABS, type TabDef } from '../tabs/config'
import UsageMeter from './UsageMeter'
import { useNavStore } from '../store/useNavStore'
import { wideRailOnly } from '../theme/styles'

/**
 * The tab triggers and the Settings button look the same. A narrow window
 * folds the rail to its icons, so each item keeps an aria-label and a title.
 */
const itemStyle = {
  position: 'relative',
  justifyContent: 'flex-start',
  gap: '3',
  w: 'full',
  h: '40px',
  px: '11px',
  borderRadius: '8px',
  color: 'app.textMuted',
  textAlign: 'left',
  _hover: { bg: 'app.railHoverBg', color: 'app.text' },
  // The selected item keeps its own background under the pointer. It switches
  // instantly on click: a gliding chip fought the hover background.
  _selected: { bg: 'app.railActiveBg', color: 'app.text', _hover: { bg: 'app.railActiveBg' } },
  css: { WebkitAppRegion: 'no-drag' }
} as const

function ItemContent({
  item,
  selected,
  hint
}: {
  item: TabDef
  selected: boolean
  hint?: string
}): React.JSX.Element {
  return (
    <>
      <Box
        as="span"
        display="flex"
        fontSize="18px"
        color={selected ? 'app.accent' : 'app.railIcon'}
      >
        {item.icon}
      </Box>
      <Text
        as="span"
        flex="1"
        fontSize="14px"
        fontWeight="600"
        whiteSpace="nowrap"
        display={wideRailOnly}
      >
        {item.label}
      </Text>
      {hint && !selected && (
        <Text
          as="span"
          fontSize="11px"
          color="app.textFaint"
          whiteSpace="nowrap"
          display={wideRailOnly}
        >
          {hint}
        </Text>
      )}
    </>
  )
}

interface Props {
  /** The selected tab id, for the icon colour and the Settings item. */
  selected: string
}

/**
 * The labelled nav on the left: brand, the four tabs with their shortcuts,
 * the token meter and Settings. Must be rendered inside <Tabs.Root> — Tabs.List
 * and Tabs.Trigger read the tab state from its context.
 *
 * The native title bar is hidden, so the rail's empty space drags the window;
 * everything clickable in it opts out with `no-drag`.
 */
export default function SideRail({ selected }: Props): React.JSX.Element {
  const setTab = useNavStore((state) => state.setTab)
  const settingsOpen = selected === SETTINGS_TAB.id

  return (
    <Flex
      as="nav"
      direction="column"
      gap="0.5"
      flexShrink="0"
      w={{ base: '64px', lg: '216px' }}
      p="3"
      bg="app.railBg"
      borderRightWidth="1px"
      borderColor="app.border"
      css={{ WebkitAppRegion: 'drag', userSelect: 'none' }}
    >
      <Flex align="center" gap="2.5" h="44px" px="1.5" mb="3.5">
        <Image src={logo} alt="" boxSize="28px" flexShrink="0" />
        <Box minW="0" display={wideRailOnly}>
          <Text fontSize="15px" fontWeight="600" lineHeight="1.2" color="app.text" whiteSpace="nowrap">
            Career App
          </Text>
          <Text fontSize="11px" lineHeight="1.3" color="app.textFaint" whiteSpace="nowrap">
            One nudge at a time
          </Text>
        </Box>
      </Flex>

      <Tabs.List flexDirection="column" gap="0.5" border="none" bg="transparent" p="0" w="full">
        {TABS.map((tab, position) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            aria-label={tab.label}
            title={`${tab.label} (Ctrl+${position + 1})`}
            {...itemStyle}
          >
            <ItemContent item={tab} selected={selected === tab.id} hint={`Ctrl ${position + 1}`} />
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Box flex="1" />

      <UsageMeter />

      {/* Not a Tabs.Trigger — Settings sits apart from the tab list — so it
          marks itself selected with the same data attribute. */}
      <chakra.button
        type="button"
        display="flex"
        alignItems="center"
        cursor="pointer"
        aria-label={SETTINGS_TAB.label}
        aria-current={settingsOpen ? 'page' : undefined}
        data-selected={settingsOpen ? '' : undefined}
        title={`${SETTINGS_TAB.label} (Ctrl+,)`}
        onClick={() => setTab('settings')}
        {...itemStyle}
      >
        <ItemContent item={SETTINGS_TAB} selected={settingsOpen} />
      </chakra.button>
    </Flex>
  )
}
