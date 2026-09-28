import { create } from 'zustand'

/**
 * Which tab is showing. Lives in a store rather than App's state so that a tab
 * can send the user to another one — the Daily tab opens the Explanation tab.
 *
 * The ids are declared here rather than read from tabs/config: that file
 * imports every tab component, and the tabs import this store, so importing it
 * back would make a cycle.
 */
export type TabId = 'interests' | 'daily' | 'explain' | 'questions' | 'settings'

interface NavState {
  tab: TabId
  setTab: (tab: TabId) => void
}

export const useNavStore = create<NavState>((set) => ({
  tab: 'interests',
  setTab: (tab) => set({ tab })
}))
