import { useEffect } from 'react'
import { Box, Flex, Tabs } from '@chakra-ui/react'
import { motion } from 'motion/react'
import SideRail from './components/SideRail'
import { PANELS, TABS } from './tabs/config'
import { useGlobalHotkeys } from './lib/hotkeys'
import { useDailyStore } from './store/useDailyStore'
import { useInterestsStore } from './store/useInterestsStore'
import { useNavStore, type TabId } from './store/useNavStore'
import { springSnappy } from './theme/motion'

export default function App(): React.JSX.Element {
  const load = useInterestsStore((state) => state.load)
  // Controlled, not `defaultValue`: the rail's gliding indicator and the panel
  // entrance both need the selected tab, and other tabs can change it.
  const selected = useNavStore((state) => state.tab)
  const setSelected = useNavStore((state) => state.setTab)
  // Ctrl+1…4 for the tabs in rail order, Ctrl+, for Settings.
  useGlobalHotkeys(TABS)

  // One load at startup; every tab reads the same store afterwards.
  useEffect(() => {
    void load()
  }, [load])

  // Events from the main process, and the day rolling over while the app
  // sits open in the tray.
  useEffect(() => {
    const offDaily = window.api.on.dailyChanged(() => void useDailyStore.getState().load())
    const offNavigate = window.api.on.navigate((tab) => {
      if (PANELS.some((panel) => panel.id === tab)) setSelected(tab as TabId)
    })
    const onWake = (): void => {
      if (document.visibilityState === 'visible') useDailyStore.getState().refreshIfNewDay()
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      offDaily()
      offNavigate()
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [setSelected])

  return (
    <Tabs.Root
      value={selected}
      onValueChange={(details) => setSelected(details.value as TabId)}
      orientation="vertical"
      variant="plain"
      display="flex"
      h="100vh"
      bg="app.bg"
      color="app.text"
    >
      <SideRail selected={selected} />

      <Flex direction="column" flex="1" minW="0">
        {/* The window's title bar: the native one is hidden, so this strip is
            what you drag the window by, and Electron draws the three caption
            buttons over its right end (height: TITLE_BAR_HEIGHT in main).
            Anything clickable added here needs `WebkitAppRegion: 'no-drag'`. */}
        <Box h="34px" flexShrink="0" css={{ WebkitAppRegion: 'drag' }} />

        <Box as="main" flex="1" minH="0" overflowY="auto" overflowX="hidden">
          <Box maxW="1040px" mx="auto" px="8" pt="1" pb="12">
            {PANELS.map(({ id, Component }) => (
              <Tabs.Content key={id} value={id} p="0">
                {/* Panels stay mounted — the Daily tab loads on mount, so
                    unmounting would re-trigger generation. Inactive panels are
                    display:none, so only the entrance of the new one is seen. */}
                <motion.div
                  initial={false}
                  animate={selected === id ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={springSnappy}
                >
                  <Component />
                </motion.div>
              </Tabs.Content>
            ))}
          </Box>
        </Box>
      </Flex>
    </Tabs.Root>
  )
}
