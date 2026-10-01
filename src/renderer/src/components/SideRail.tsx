import { useState } from 'react'
import { Box, chakra, Flex, Image, Tabs, Text } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import logo from '../logo.png'
import { SETTINGS_TAB, TABS, type TabDef } from '../tabs/config'
import UsageMeter from './UsageMeter'
import { refreshAll } from '../lib/refresh'
import { useNavStore } from '../store/useNavStore'
import { wideRailOnly } from '../theme/styles'

/**
 * The tab triggers and the Settings button look the same. A narrow window
 * folds the rail to its icons, so each item keeps an aria-label and a title.
 */
const itemStyle = {
  position: 'relative',
  // On a phone the items share the bottom bar equally, icons centred.
  justifyContent: { base: 'center', md: 'flex-start' },
  gap: '3',
  flex: { base: '1', md: 'none' },
  w: { base: 'auto', md: 'full' },
  h: { base: '56px', md: '40px' },
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
  item: Pick<TabDef, 'icon' | 'label'>
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
 * the token meter and Settings. On a phone (below Chakra's `md`, 768px) it is a
 * bottom tab bar instead: the four tabs and Settings as icons.
 * Must be rendered inside <Tabs.Root> — Tabs.List
 * and Tabs.Trigger read the tab state from its context.
 *
 * The native title bar is hidden, so the rail's empty space drags the window;
 * everything clickable in it opts out with `no-drag`.
 */
export default function SideRail({ selected }: Props): React.JSX.Element {
  const setTab = useNavStore((state) => state.setTab)
  const settingsOpen = selected === SETTINGS_TAB.id
  const [refreshing, setRefreshing] = useState(false)

  async function refresh(): Promise<void> {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refreshAll(true)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Flex
      as="nav"
      direction={{ base: 'row', md: 'column' }}
      gap="0.5"
      flexShrink="0"
      position={{ base: 'fixed', md: 'static' }}
      insetX="0"
      bottom="0"
      zIndex="10"
      w={{ base: 'full', md: '64px', lg: '216px' }}
      px={{ base: '2', md: '3' }}
      // 12 + 56 + 12: Android's own 80dp navigation-bar height.
      pt="3"
      // Clear of Android's navigation buttons, which are drawn over the page.
      pb={{ base: 'calc(12px + env(safe-area-inset-bottom))', md: '3' }}
      bg="app.railBg"
      borderRightWidth={{ base: '0', md: '1px' }}
      borderTopWidth={{ base: '1px', md: '0' }}
      borderColor="app.border"
      css={{ WebkitAppRegion: 'drag', userSelect: 'none' }}
    >
      <Flex display={{ base: 'none', md: 'flex' }} align="center" gap="2.5" h="44px" px="1.5" mb="3.5">
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

      {/* On a phone the list steps aside (`contents`), so its four tabs and
          Settings share the bar as five equal slots. */}
      <Tabs.List
        display={{ base: 'contents', md: 'flex' }}
        flexDirection={{ base: 'row', md: 'column' }}
        gap="0.5"
        border="none"
        bg="transparent"
        p="0"
        w={{ base: 'auto', md: 'full' }}
      >
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

      <Box flex="1" display={{ base: 'none', md: 'block' }} />

      {/* Re-reads everything from the cloud. Phones pull the page down instead. */}
      <chakra.button
        type="button"
        display={{ base: 'none', md: 'flex' }}
        alignItems="center"
        cursor="pointer"
        aria-label="Refresh"
        aria-busy={refreshing}
        title="Refresh — fetch the latest from the cloud"
        onClick={() => void refresh()}
        {...itemStyle}
        css={{ WebkitAppRegion: 'no-drag', '& svg': refreshing ? { animation: 'app-spin 0.8s linear infinite' } : {} }}
      >
        <ItemContent item={{ label: refreshing ? 'Refreshing…' : 'Refresh', icon: <LuRefreshCw /> }} selected={false} />
      </chakra.button>

      {/* A phone's bar has no room for it; Settings shows it there instead. */}
      <Box display={{ base: 'none', md: 'block' }}>
        <UsageMeter />
      </Box>

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
