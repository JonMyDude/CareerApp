import { useDailyStore } from '../store/useDailyStore'
import { useInterestsStore } from '../store/useInterestsStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useUsageStore } from '../store/useUsageStore'

/**
 * Re-read everything from the cloud without spinners, so a change made on
 * another device shows up: on returning to the window, from the rail's Refresh
 * and from Android's pull-to-refresh.
 *
 * `retry` (the explicit refreshes) also reloads what failed to load, e.g. after
 * the cloud was unreachable or just connected. Returning to the window doesn't,
 * so a broken connection isn't retried on every focus.
 */
export async function refreshAll(retry = false): Promise<void> {
  const daily = useDailyStore.getState()
  const interests = useInterestsStore.getState()
  await Promise.all([
    retry && (daily.status === 'error' || !daily.loadedDay) ? daily.load() : daily.refresh(),
    retry && interests.status !== 'ready' ? interests.load() : interests.refresh(),
    useUsageStore.getState().refresh(),
    retry ? useSettingsStore.getState().load() : undefined
  ])
}
