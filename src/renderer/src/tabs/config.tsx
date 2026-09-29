import { LuBookOpen, LuBrain, LuCalendarDays, LuLightbulb, LuSettings } from 'react-icons/lu'
import type { TabId } from '../store/useNavStore'
import InterestsTab from './InterestsTab'
import DailySuggestionTab from './DailySuggestionTab'
import ExplanationTab from './ExplanationTab'
import QuestionGeneratorTab from './QuestionGeneratorTab'
import SettingsTab from './SettingsTab'

export interface TabDef {
  id: TabId
  /** Shown in the rail; also the accessible name, since a narrow window folds the rail to icons. */
  label: string
  icon: React.ReactNode
  Component: () => React.JSX.Element
}

/** One list, read by both the rail and the content area, so they can't drift. */
export const TABS: TabDef[] = [
  { id: 'interests', label: 'Interests', icon: <LuLightbulb />, Component: InterestsTab },
  { id: 'daily', label: 'Daily', icon: <LuCalendarDays />, Component: DailySuggestionTab },
  // Right after Daily: it only ever shows a suggestion sent from there.
  { id: 'explain', label: 'Explanation', icon: <LuBookOpen />, Component: ExplanationTab },
  { id: 'questions', label: 'Quiz', icon: <LuBrain />, Component: QuestionGeneratorTab }
]

/** Opened from the gear at the bottom of the rail rather than from the tab list. */
export const SETTINGS_TAB: TabDef = {
  id: 'settings',
  label: 'Settings',
  icon: <LuSettings />,
  Component: SettingsTab
}

/** Every panel the content area can show. */
export const PANELS: TabDef[] = [...TABS, SETTINGS_TAB]
